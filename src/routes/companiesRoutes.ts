import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listCompaniesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

const createOrUpdateCompanySchema = z.object({
  companyID: z.string().optional(),
  name: z.string().min(1),
  monthlySpend: z.number().nonnegative().optional(),
  healthStatus: z.string().optional(),
  stripeCustomerId: z.string().optional()
});

export const companiesRoutes = Router();

function formatCompany(company: {
  id: string;
  name: string;
  monthlySpend: number;
  healthStatus: string;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    users: number;
  };
}): Record<string, unknown> {
  return {
    id: company.id,
    companyID: company.id,
    name: company.name,
    monthlySpend: company.monthlySpend,
    healthStatus: company.healthStatus,
    stripeCustomerId: company.stripeCustomerId,
    userCount: company._count?.users,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt
  };
}

companiesRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listCompaniesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const limit = parsed.data.limit ?? 100;
  const skip = parsed.data.skip ?? 0;

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      skip,
      take: limit,
      orderBy: { monthlySpend: "desc" },
      include: {
        _count: {
          select: { users: true }
        }
      }
    }),
    prisma.company.count()
  ]);

  res.status(200).json({
    companies: companies.map((company) => formatCompany(company)),
    hasMore: skip + companies.length < total
  });
});

companiesRoutes.post("/create_or_update", requireApiKey, async (req, res) => {
  const parsed = createOrUpdateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid create_or_update payload",
      details: parsed.error.flatten()
    });
    return;
  }

  const payload = parsed.data;

  const existing = payload.companyID
    ? await prisma.company.findUnique({ where: { id: payload.companyID } })
    : await prisma.company.findUnique({ where: { name: payload.name } });

  const company = existing
    ? await prisma.company.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          monthlySpend: payload.monthlySpend ?? existing.monthlySpend,
          healthStatus: payload.healthStatus ?? existing.healthStatus,
          stripeCustomerId: payload.stripeCustomerId ?? existing.stripeCustomerId
        }
      })
    : await prisma.company.create({
        data: {
          name: payload.name,
          monthlySpend: payload.monthlySpend ?? 0,
          healthStatus: payload.healthStatus ?? "unknown",
          stripeCustomerId: payload.stripeCustomerId
        }
      });

  res.status(200).json({ company: formatCompany(company) });
});
