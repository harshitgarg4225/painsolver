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
 * Resolves tenant context from various sources:
 * 1. X-Company-ID header (for API calls)
 * 2. X-Company-Slug header (for API calls)
 * 3. Subdomain (e.g., acme.painsolver.vercel.app)
 * 4. Custom domain lookup
 * 5. Actor's company (if authenticated)
 */
export async function resolveTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let company = null;

    // 1. Check X-Company-ID header
    const companyIdHeader = req.headers["x-company-id"];
    if (companyIdHeader && typeof companyIdHeader === "string") {
      company = await prisma.company.findUnique({
        where: { id: companyIdHeader },
        select: { id: true, slug: true, name: true }
      });
    }

    // 2. Check X-Company-Slug header
    if (!company) {
      const companySlugHeader = req.headers["x-company-slug"];
      if (companySlugHeader && typeof companySlugHeader === "string") {
        company = await prisma.company.findUnique({
          where: { slug: companySlugHeader },
          select: { id: true, slug: true, name: true }
        });
      }
    }

    // 3. Check subdomain
    if (!company) {
      const host = req.headers.host || "";
      const subdomain = extractSubdomain(host);
      if (subdomain && subdomain !== "www" && subdomain !== "painsolver") {
        company = await prisma.company.findUnique({
          where: { slug: subdomain },
          select: { id: true, slug: true, name: true }
        });
      }
    }

    // 4. Check custom domain
    if (!company) {
      const host = req.headers.host || "";
      if (host && !host.includes("localhost") && !host.includes("vercel.app")) {
        const customDomain = await prisma.customDomain.findFirst({
          where: { 
            domain: host.split(":")[0],
            status: "active"
          },
          include: {
            company: {
              select: { id: true, slug: true, name: true }
            }
          }
        });
        if (customDomain) {
          company = customDomain.company;
        }
      }
    }

    // 5. Use actor's company if authenticated
    if (!company && req.actor?.isAuthenticated && req.actor.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.actor.userId },
        include: {
          company: {
            select: { id: true, slug: true, name: true }
          }
        }
      });
      if (user) {
        company = user.company;
      }
    }

    // Set tenant context if found
    if (company) {
      req.tenant = {
        companyId: company.id,
        companySlug: company.slug,
        companyName: company.name
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

