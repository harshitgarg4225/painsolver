import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

export type ActorRole = "anonymous" | "customer" | "member" | "admin";

export interface ActorContext {
  userId: string | null;
  appUserId: string | null;
  email: string | null;
  displayName: string | null;
  segments: string[];
  role: ActorRole;
  isAuthenticated: boolean;
  accessLevel: "read" | "request" | "write";
}

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
    }
  }
}

function resolveAccessLevel(role: ActorRole, isAuthenticated: boolean): ActorContext["accessLevel"] {
  if (role === "member" || role === "admin") {
    return "write";
  }

  if (isAuthenticated && role === "customer") {
    return "request";
  }

  return "read";
}

function parseRole(rawRole: string | undefined): ActorRole {
  if (rawRole === "customer" || rawRole === "member" || rawRole === "admin") {
    return rawRole;
  }

  return "anonymous";
}

function parseSegments(rawSegments: string | undefined): string[] {
  if (!rawSegments) {
    return [];
  }

  return rawSegments
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function resolveActor(req: Request, _res: Response, next: NextFunction): void {
  const allowHeaderIdentity = env.ALLOW_INSECURE_ACTOR_HEADERS || Boolean(req.apiCredential);
  if (!allowHeaderIdentity) {
    req.actor = {
      userId: null,
      appUserId: null,
      email: null,
      displayName: null,
      segments: [],
      role: "anonymous",
      isAuthenticated: false,
      accessLevel: "read"
    };
    next();
    return;
  }

  const roleHeader = req.header("x-painsolver-role") ?? undefined;
  const authHeader = req.header("x-painsolver-auth") ?? undefined;
  const userHeader = req.header("x-painsolver-user-id") ?? undefined;
  const appUserIdHeader = req.header("x-painsolver-app-user-id") ?? undefined;
  const emailHeader = req.header("x-painsolver-email") ?? undefined;
  const nameHeader = req.header("x-painsolver-name") ?? undefined;
  const segmentsHeader = req.header("x-painsolver-segments") ?? undefined;

  const role = parseRole(roleHeader);
  const isAuthenticated = authHeader === "true" || Boolean(userHeader) || Boolean(appUserIdHeader);

  req.actor = {
    userId: userHeader ?? appUserIdHeader ?? null,
    appUserId: appUserIdHeader ?? null,
    email: emailHeader ?? null,
    displayName: nameHeader ?? null,
    segments: parseSegments(segmentsHeader),
    role,
    isAuthenticated,
    accessLevel: resolveAccessLevel(role, isAuthenticated)
  };

  next();
}

export function ensureAgentActor(req: Request, res: Response, next: NextFunction): void {
  if (req.actor && (req.actor.role === "member" || req.actor.role === "admin")) {
    next();
    return;
  }

  const credential = req.apiCredential;
  if (!credential) {
    res.status(401).json({ error: "Missing API credential for agent actor context." });
    return;
  }

  const userId = req.header("x-painsolver-user-id") ?? `agent:${credential.id}`;
  const appUserId = req.header("x-painsolver-app-user-id") ?? userId;
  const email = req.header("x-painsolver-email") ?? `agent+${credential.id}@agents.painsolver.local`;
  const displayName = req.header("x-painsolver-name") ?? `${credential.name} Agent`;
  const segmentsHeader = req.header("x-painsolver-segments") ?? undefined;

  req.actor = {
    userId,
    appUserId,
    email,
    displayName,
    segments: parseSegments(segmentsHeader),
    role: "member",
    isAuthenticated: true,
    accessLevel: "write"
  };

  next();
}

export function requireAuthenticatedActor(req: Request, res: Response, next: NextFunction): void {
  if (!req.actor?.isAuthenticated) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  next();
}

export function requireCompanyWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const actor = req.actor;
  if (!actor || (actor.role !== "member" && actor.role !== "admin")) {
    res.status(403).json({ error: "Company member write access required" });
    return;
  }

  next();
}
