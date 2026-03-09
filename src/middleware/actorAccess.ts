import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { prisma } from "../db/prisma";

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
      authUser?: {
        id: string;
        email: string;
        name: string;
        role: string;
        companyId: string;
        companySlug: string;
        companyName: string;
        emailVerified: boolean;
      };
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

/**
 * Map database user role to ActorRole
 * Database roles: owner, admin, member, customer
 * Actor roles: admin, member, customer, anonymous
 */
function mapDbRoleToActorRole(dbRole: string): ActorRole {
  if (dbRole === "owner" || dbRole === "admin") return "admin";
  if (dbRole === "member") return "member";
  if (dbRole === "customer") return "customer";
  return "anonymous";
}

/**
 * Resolve actor identity from multiple sources:
 * 1. Session cookie (ps_session) — real authenticated users
 * 2. API key + headers — programmatic agent access
 * 3. Insecure headers (dev only) — legacy/demo mode
 * 4. Anonymous fallback
 */
export async function resolveActor(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // ── 1. Check session cookie (real auth) ──
    const sessionToken = req.cookies?.ps_session;
    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { token: sessionToken },
        include: {
          user: {
            include: { company: true }
          }
        }
      });

      if (session && session.expiresAt > new Date()) {
        const user = session.user;
        const actorRole = mapDbRoleToActorRole(user.role);

        req.actor = {
          userId: user.id,
          appUserId: user.appUserId || user.id,
          email: user.email,
          displayName: user.name,
          segments: user.segments || [],
          role: actorRole,
          isAuthenticated: true,
          accessLevel: resolveAccessLevel(actorRole, true)
        };

        // Also set authUser for route handlers that need it
        req.authUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companySlug: user.company.slug,
          companyName: user.company.name,
          emailVerified: user.emailVerified
        };

        next();
        return;
      }
    }

    // ── 2. API key-based actor (agents/SDKs) ──
    if (req.apiCredential) {
      const roleHeader = req.header("x-painsolver-role") ?? undefined;
      const userHeader = req.header("x-painsolver-user-id") ?? undefined;
      const appUserIdHeader = req.header("x-painsolver-app-user-id") ?? undefined;
      const emailHeader = req.header("x-painsolver-email") ?? undefined;
      const nameHeader = req.header("x-painsolver-name") ?? undefined;
      const segmentsHeader = req.header("x-painsolver-segments") ?? undefined;

      const role = parseRole(roleHeader);
      const isAuthenticated = Boolean(userHeader) || Boolean(appUserIdHeader);

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
      return;
    }

    // ── 3. Insecure header identity (dev/demo ONLY) ──
    if (env.ALLOW_INSECURE_ACTOR_HEADERS) {
      const roleHeader = req.header("x-painsolver-role") ?? undefined;
      const authHeader = req.header("x-painsolver-auth") ?? undefined;
      const userHeader = req.header("x-painsolver-user-id") ?? undefined;
      const appUserIdHeader = req.header("x-painsolver-app-user-id") ?? undefined;
      const emailHeader = req.header("x-painsolver-email") ?? undefined;
      const nameHeader = req.header("x-painsolver-name") ?? undefined;
      const segmentsHeader = req.header("x-painsolver-segments") ?? undefined;

      const role = parseRole(roleHeader);
      const isAuthenticated = authHeader === "true" || Boolean(userHeader) || Boolean(appUserIdHeader);

      if (isAuthenticated) {
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
        return;
      }
    }

    // ── 4. Anonymous fallback ──
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
  } catch (error) {
    console.error("Error resolving actor:", error);
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
  }
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
