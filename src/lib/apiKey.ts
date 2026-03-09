import crypto from "crypto";

import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { redisConnection } from "../config/redis";

const API_KEY_CACHE_TTL_SECONDS = 60;
const API_KEY_CACHE_PREFIX = "apicred:";

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export interface ApiCredentialAuth {
  id: string;
  name: string;
  isActive: boolean;
  scopes: string[];
}

function normalizeScope(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizeScopes(rawScopes: Prisma.JsonValue | null | undefined): string[] {
  if (!rawScopes) {
    return ["*"];
  }

  if (!Array.isArray(rawScopes)) {
    return ["*"];
  }

  const scopes = rawScopes
    .filter((value): value is string => typeof value === "string")
    .map(normalizeScope)
    .filter(Boolean);

  if (!scopes.length) {
    return ["*"];
  }

  return Array.from(new Set(scopes));
}

function scopeMatches(granted: string, required: string): boolean {
  if (granted === "*" || required === "*") {
    return true;
  }

  if (granted === required) {
    return true;
  }

  if (granted.endsWith(":*")) {
    const prefix = granted.slice(0, -1);
    return required.startsWith(prefix);
  }

  return false;
}

export function hasApiScope(scopes: string[], requiredScope: string): boolean {
  const required = normalizeScope(requiredScope);
  return scopes.some((scope) => scopeMatches(normalizeScope(scope), required));
}

export function hasAnyApiScope(scopes: string[], requiredScopes: string[]): boolean {
  if (!requiredScopes.length) {
    return true;
  }

  return requiredScopes.some((requiredScope) => hasApiScope(scopes, requiredScope));
}

export async function getApiCredentialByApiKey(apiKey: string): Promise<ApiCredentialAuth | null> {
  if (!apiKey || typeof apiKey !== "string") {
    return null;
  }

  const keyHash = hashApiKey(apiKey);
  const cacheKey = `${API_KEY_CACHE_PREFIX}${keyHash}`;

  // Try Redis cache first
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached !== null) {
      if (cached === "null") {
        return null;
      }
      return JSON.parse(cached) as ApiCredentialAuth;
    }
  } catch {
    // Redis unavailable - fall through to DB
  }

  const credential = await prisma.apiCredential.findUnique({
    where: { keyHash },
    select: {
      id: true,
      name: true,
      isActive: true,
      scopes: true
    }
  });

  if (!credential) {
    // Cache miss result too to avoid repeated DB hits for invalid keys
    try {
      await redisConnection.set(cacheKey, "null", "EX", API_KEY_CACHE_TTL_SECONDS);
    } catch {
      // Redis unavailable - continue without cache
    }
    return null;
  }

  const result: ApiCredentialAuth = {
    id: credential.id,
    name: credential.name,
    isActive: credential.isActive,
    scopes: normalizeScopes(credential.scopes)
  };

  try {
    await redisConnection.set(cacheKey, JSON.stringify(result), "EX", API_KEY_CACHE_TTL_SECONDS);
  } catch {
    // Redis unavailable - continue without cache
  }

  return result;
}

export async function isApiKeyValid(apiKey: string): Promise<boolean> {
  const credential = await getApiCredentialByApiKey(apiKey);
  return credential?.isActive ?? false;
}

export async function createApiCredential(
  name: string,
  apiKey: string,
  scopes: string[] = ["*"]
): Promise<void> {
  const keyHash = hashApiKey(apiKey);
  const normalizedScopes = Array.from(
    new Set(
      scopes
        .map(normalizeScope)
        .filter(Boolean)
    )
  );

  // Find or create a default company for API credentials
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: "Default", slug: "default" }
    });
  }

  await prisma.apiCredential.upsert({
    where: { keyHash },
    update: {
      name,
      isActive: true,
      scopes: normalizedScopes.length ? normalizedScopes : ["*"]
    },
    create: {
      name,
      keyHash,
      isActive: true,
      scopes: normalizedScopes.length ? normalizedScopes : ["*"],
      companyId: company.id
    }
  });
}
