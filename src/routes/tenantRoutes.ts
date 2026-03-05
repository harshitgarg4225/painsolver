import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCompanyWriteAccess, resolveActor } from "../middleware/actorAccess";
import { resolveTenantContext, requireTenantContext, getCompanyId } from "../middleware/tenantContext";

export const tenantRoutes = Router();

const createCompanySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
});

const updateCompanySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  stripeCustomerId: z.string().optional()
});

// =============================================
// Public: List companies (for company selector)
// =============================================
tenantRoutes.get("/companies", async (req, res) => {
  // For authenticated users, list companies they have access to
  if (req.actor?.isAuthenticated && req.actor.userId) {
    const user = await prisma.user.findUnique({
      where: { id: req.actor.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (user) {
      res.status(200).json({
        companies: [user.company],
        currentCompanyId: user.companyId
      });
      return;
    }
  }

  // For API credentials, they might have access to multiple companies
  // For now, return empty list for anonymous users
  res.status(200).json({
    companies: [],
    currentCompanyId: null
  });
});

// =============================================
// Create new company (for onboarding)
// =============================================
tenantRoutes.post("/companies", async (req, res) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid company data", details: parsed.error.flatten() });
    return;
  }

  try {
    // Check if slug is already taken
    const existing = await prisma.company.findUnique({
      where: { slug: parsed.data.slug }
    });

    if (existing) {
      res.status(409).json({ error: "Company slug already exists" });
      return;
    }

    // Create company with default board and portal settings
    const company = await prisma.company.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        boards: {
          create: {
            name: "Feature Requests",
            slug: "feature-requests",
            visibility: "public",
            categories: {
              create: {
                name: "General"
              }
            }
          }
        },
        portalSettings: {
          create: {
            portalName: parsed.data.name + " Feedback"
          }
        }
      },
      include: {
        boards: true,
        portalSettings: true
      }
    });

    res.status(201).json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug
      },
      defaultBoardId: company.boards[0]?.id
    });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// =============================================
// Company-scoped routes (require tenant context)
// =============================================
tenantRoutes.use(requireCompanyWriteAccess);
tenantRoutes.use(requireTenantContext);

// =============================================
// Get current company details
// =============================================
tenantRoutes.get("/company", async (req, res) => {
  const companyId = getCompanyId(req);
  
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      _count: {
        select: {
          boards: true,
          users: true
        }
      },
      portalSettings: true
    }
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.status(200).json({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      monthlySpend: company.monthlySpend,
      healthStatus: company.healthStatus,
      stripeCustomerId: company.stripeCustomerId,
      boardCount: company._count.boards,
      userCount: company._count.users,
      portalSettings: company.portalSettings,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    }
  });
});

// =============================================
// Update company settings
// =============================================
tenantRoutes.patch("/company", async (req, res) => {
  const companyId = getCompanyId(req);
  const parsed = updateCompanySchema.safeParse(req.body);
  
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
    return;
  }

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.stripeCustomerId && { stripeCustomerId: parsed.data.stripeCustomerId })
    }
  });

  res.status(200).json({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      stripeCustomerId: company.stripeCustomerId
    }
  });
});

// =============================================
// Get company stats
// =============================================
tenantRoutes.get("/company/stats", async (req, res) => {
  const companyId = getCompanyId(req);

  const [boardCount, postCount, userCount, voteCount, recentActivity] = await Promise.all([
    prisma.board.count({ where: { companyId } }),
    prisma.post.count({ where: { board: { companyId }, mergedIntoPostId: null } }),
    prisma.user.count({ where: { companyId } }),
    prisma.vote.count({ where: { user: { companyId } } }),
    prisma.post.findMany({
      where: { board: { companyId }, mergedIntoPostId: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true
      }
    })
  ]);

  res.status(200).json({
    stats: {
      boardCount,
      postCount,
      userCount,
      voteCount,
      recentPosts: recentActivity
    }
  });
});

// =============================================
// Invite user to company
// =============================================
tenantRoutes.post("/company/invite", async (req, res) => {
  const companyId = getCompanyId(req);
  
  const schema = z.object({
    email: z.string().email(),
    role: z.enum(["admin", "member"]).default("member"),
    name: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid invite data", details: parsed.error.flatten() });
    return;
  }

  try {
    // Check if user already exists in this company
    const existingUser = await prisma.user.findFirst({
      where: {
        companyId,
        email: parsed.data.email
      }
    });

    if (existingUser) {
      res.status(409).json({ error: "User already exists in this company" });
      return;
    }

    // Create user in company
    const user = await prisma.user.create({
      data: {
        companyId,
        email: parsed.data.email,
        name: parsed.data.name || "",
        role: parsed.data.role
      }
    });

    // TODO: Send invitation email

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Error inviting user:", error);
    res.status(500).json({ error: "Failed to invite user" });
  }
});

// =============================================
// List company members
// =============================================
tenantRoutes.get("/company/members", async (req, res) => {
  const companyId = getCompanyId(req);

  const members = await prisma.user.findMany({
    where: { companyId },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    }
  });

  res.status(200).json({
    members: members.map(m => ({
      id: m.id,
      email: m.email,
      name: m.name || m.email,
      role: m.role,
      createdAt: m.createdAt.toISOString()
    }))
  });
});

