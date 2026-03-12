import { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma";

export interface TenantContext {
  companyId: string;
  companySlug: string;
  companyName: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Safely fetch a company by ID.
 * Uses a minimal select to avoid failing on missing columns.
 */
async function findCompanyById(id: string): Promise<{ id: string; slug: string; name: string } | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true }
    });
    return company;
  } catch {
    // slug column might not exist yet — try without it
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, name FROM "Company" WHERE id = $1 LIMIT 1`,
        id
      );
      if (rows.length > 0) {
        return { id: rows[0].id, slug: rows[0].slug || "", name: rows[0].name };
      }
    } catch {
      // Table might not exist or other error
    }
    return null;
  }
}

/**
 * Safely fetch the first company (fallback for single-tenant/demo mode).
 */
async function findFirstCompany(): Promise<{ id: string; slug: string; name: string } | null> {
  try {
    const company = await prisma.company.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, name: true }
    });
    return company;
  } catch {
    // slug column might not exist — try raw query
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, name FROM "Company" ORDER BY "createdAt" ASC LIMIT 1`
      );
      if (rows.length > 0) {
        return { id: rows[0].id, slug: rows[0].slug || "", name: rows[0].name };
      }
    } catch {
      // Table might not exist
    }
    return null;
  }
}

/**
 * Resolves tenant context from various sources:
 * 1. X-Company-ID header (for API calls)
 * 2. X-Company-Slug header (for API calls)
 * 3. Subdomain (e.g., acme.painsolver.vercel.app)
 * 4. Actor's company (if authenticated)
 * 5. Fallback: first company (demo/single-tenant mode)
 */
export async function resolveTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let company: { id: string; slug: string; name: string } | null = null;

    // 1. Check X-Company-ID header
    const companyIdHeader = req.headers["x-company-id"];
    if (!company && companyIdHeader && typeof companyIdHeader === "string") {
      company = await findCompanyById(companyIdHeader);
    }

    // 2. Check X-Company-Slug header
    if (!company) {
      const companySlugHeader = req.headers["x-company-slug"];
      if (companySlugHeader && typeof companySlugHeader === "string") {
        try {
          company = await prisma.company.findUnique({
            where: { slug: companySlugHeader },
            select: { id: true, slug: true, name: true }
          });
        } catch {
          // slug column might not exist — skip
        }
      }
    }

    // 3. Check subdomain
    if (!company) {
      const host = req.headers.host || "";
      const subdomain = extractSubdomain(host);
      if (subdomain && subdomain !== "www" && subdomain !== "painsolver") {
        try {
          company = await prisma.company.findUnique({
            where: { slug: subdomain },
            select: { id: true, slug: true, name: true }
          });
        } catch {
          // slug column might not exist — skip
        }
      }
    }

    // 4. Use actor's company if authenticated (session-based auth)
    if (!company && req.authUser?.companyId) {
      company = await findCompanyById(req.authUser.companyId);
    }

    // 4b. Fallback: use actor's userId to find their company
    if (!company && req.actor?.isAuthenticated && req.actor.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.actor.userId },
          include: {
            company: {
              select: { id: true, slug: true, name: true }
            }
          }
        });
        if (user?.company) {
          company = user.company;
        }
      } catch {
        // company relation might not exist yet — skip
      }
    }

    // 5. NO fallback — each request must have a tenant context
    // (removed first-company fallback to prevent cross-tenant data leakage)

    // Set tenant context if found
    if (company) {
      req.tenant = {
        companyId: company.id,
        companySlug: company.slug || "",
        companyName: company.name || "Company"
      };
    }

    next();
  } catch (error) {
    console.error("Error resolving tenant context:", error);
    next();
  }
}

/**
 * Middleware that requires a tenant context to be present
 */
export function requireTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant) {
    res.status(400).json({ 
      error: "Company context required",
      hint: "Provide X-Company-ID or X-Company-Slug header, or access via subdomain"
    });
    return;
  }
  next();
}

/**
 * Extract subdomain from host
 * e.g., "acme.painsolver.vercel.app" -> "acme"
 */
function extractSubdomain(host: string): string | null {
  const parts = host.split(".");
  
  // Handle vercel.app subdomains: acme.painsolver.vercel.app
  if (host.includes("vercel.app") && parts.length >= 4) {
    return parts[0];
  }
  
  // Handle custom domains: feedback.acme.com -> null (use custom domain lookup)
  // Handle local: localhost:3000 -> null
  if (parts.length >= 3 && !host.includes("localhost")) {
    return parts[0];
  }
  
  return null;
}

/**
 * Helper to get company ID from request (for use in route handlers)
 */
export function getCompanyId(req: Request): string {
  if (!req.tenant) {
    throw new Error("Tenant context not available");
  }
  return req.tenant.companyId;
}

/**
 * Helper to scope Prisma queries by company
 */
export function withTenant<T extends Record<string, unknown>>(
  req: Request,
  where: T
): T & { companyId: string } {
  return {
    ...where,
    companyId: getCompanyId(req)
  };
}
