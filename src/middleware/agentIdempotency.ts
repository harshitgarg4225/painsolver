import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { redisConnection } from "../config/redis";

const LOCK_TTL_SECONDS = 30;

interface CachedIdempotentResponse {
  requestHash: string;
  statusCode: number;
  body: unknown;
}

const memoryStore = new Map<string, { expiresAt: number; value: CachedIdempotentResponse }>();
const memoryLocks = new Map<string, number>();

function isMutatingMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function hashRequestBody(body: unknown): string {
  const serialized = body == null ? "" : JSON.stringify(body);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function keyPrefix(req: Request, idempotencyKey: string): string {
  const credentialFingerprint = req.apiCredential?.id ?? "anonymous";
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split("?")[0];

  return `idemp:${credentialFingerprint}:${method}:${path}:${idempotencyKey}`;
}

function coerceBody(value: unknown): unknown {
  if (typeof value === "undefined") {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return value;
}

function clearExpiredMemoryEntries(now: number): void {
  for (const [key, item] of memoryStore.entries()) {
    if (item.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }

  for (const [key, expiresAt] of memoryLocks.entries()) {
    if (expiresAt <= now) {
      memoryLocks.delete(key);
    }
  }
}

async function getCachedResponse(key: string): Promise<CachedIdempotentResponse | null> {
  try {
    const raw = await redisConnection.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CachedIdempotentResponse;
  } catch (_error) {
    const now = Date.now();
    clearExpiredMemoryEntries(now);
    const local = memoryStore.get(key);
    if (!local || local.expiresAt <= now) {
      memoryStore.delete(key);
      return null;
    }
    return local.value;
  }
}

async function setCachedResponse(
  key: string,
  value: CachedIdempotentResponse,
  ttlSeconds: number
): Promise<void> {
  try {
    await redisConnection.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (_error) {
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }
}

async function acquireLock(key: string): Promise<boolean> {
  try {
    const result = await redisConnection.set(key, "1", "EX", LOCK_TTL_SECONDS, "NX");
    return result === "OK";
  } catch (_error) {
    const now = Date.now();
    clearExpiredMemoryEntries(now);
    const current = memoryLocks.get(key);
    if (current && current > now) {
      return false;
    }
    memoryLocks.set(key, now + LOCK_TTL_SECONDS * 1000);
    return true;
  }
}

async function releaseLock(key: string): Promise<void> {
  try {
    await redisConnection.del(key);
  } catch (_error) {
    memoryLocks.delete(key);
  }
}

export async function enforceAgentIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isMutatingMethod(req.method.toUpperCase())) {
    next();
    return;
  }

  const headerValue = req.header("idempotency-key");
  const idempotencyKey = headerValue?.trim();

  if (!idempotencyKey) {
    if (env.AGENT_REQUIRE_IDEMPOTENCY) {
      res.status(400).json({ error: "Missing Idempotency-Key header" });
      return;
    }
    next();
    return;
  }

  if (idempotencyKey.length > 200) {
    res.status(400).json({ error: "Idempotency-Key is too long" });
    return;
  }

  const requestHash = hashRequestBody(req.body);
  const prefix = keyPrefix(req, idempotencyKey);
  const responseKey = `${prefix}:response`;
  const lockKey = `${prefix}:lock`;

  const cached = await getCachedResponse(responseKey);
  if (cached) {
    if (cached.requestHash !== requestHash) {
      res.status(409).json({
        error: "Idempotency-Key already used with a different payload"
      });
      return;
    }

    res.setHeader("x-idempotent-replay", "true");
    if (typeof cached.body === "string") {
      res.status(cached.statusCode).send(cached.body);
      return;
    }

    res.status(cached.statusCode).json(cached.body);
    return;
  }

  const hasLock = await acquireLock(lockKey);
  if (!hasLock) {
    res.status(409).json({
      error: "Request with this Idempotency-Key is already processing"
    });
    return;
  }

  let capturedBody: unknown = null;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = ((body: unknown) => {
    capturedBody = body;
    return originalJson(body);
  }) as Response["json"];

  res.send = ((body: unknown) => {
    if (capturedBody == null) {
      capturedBody = body;
    }
    return originalSend(body);
  }) as Response["send"];

  res.on("finish", () => {
    const statusCode = res.statusCode;
    const body = coerceBody(capturedBody);
    const responsePayload: CachedIdempotentResponse = {
      requestHash,
      statusCode,
      body
    };

    void releaseLock(lockKey);

    if (statusCode >= 200 && statusCode < 500) {
      void setCachedResponse(responseKey, responsePayload, env.AGENT_IDEMPOTENCY_TTL_SECONDS);
    }
  });

  next();
}
