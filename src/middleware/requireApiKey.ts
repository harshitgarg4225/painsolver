import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import {
  ApiCredentialAuth,
  getApiCredentialByApiKey,
  hasAnyApiScope
} from "../lib/apiKey";

declare global {
  namespace Express {
    interface Request {
      apiCredential?: ApiCredentialAuth;
    }
  }
}

function extractApiKey(req: Request): string | undefined {
  const fromBody = typeof req.body?.apiKey === "string" ? req.body.apiKey : undefined;
  const authHeader = req.header("authorization") || req.header("Authorization");
  const fromBearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  const fromHeader = req.header("x-api-key") ?? req.header("x-painsolver-api-key") ?? undefined;

  return fromBody ?? fromBearer ?? fromHeader;
}

async function resolveCredential(req: Request): Promise<ApiCredentialAuth | null> {
  if (req.apiCredential) {
    return req.apiCredential;
  }

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return null;
  }

  if (env.PAINSOLVER_MASTER_API_KEY && apiKey === env.PAINSOLVER_MASTER_API_KEY) {
    const masterCredential: ApiCredentialAuth = {
      id: "master",
      name: "Master key",
      isActive: true,
      scopes: ["*"]
    };
    req.apiCredential = masterCredential;
    return masterCredential;
  }

  const credential = await getApiCredentialByApiKey(apiKey);
  if (!credential || !credential.isActive) {
    return null;
  }

  req.apiCredential = credential;
  return credential;
}

export async function resolveApiCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    next();
    return;
  }

  const credential = await resolveCredential(req);
  if (!credential) {
    res.status(401).json({ error: "Invalid apiKey" });
    return;
  }

  next();
}

export function requireApiKeyWithScopes(requiredScopes: string[] = []) {
  return async function requireScopedApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    const credential = await resolveCredential(req);

    if (!credential) {
      res.status(401).json({ error: "Missing or invalid apiKey" });
      return;
    }

    if (!hasAnyApiScope(credential.scopes, requiredScopes)) {
      res.status(403).json({
        error: "Insufficient API key scope",
        requiredScopes
      });
      return;
    }

    next();
  };
}

export const requireApiKey = requireApiKeyWithScopes();
