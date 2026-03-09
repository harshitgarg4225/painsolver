import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listUsersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

const createOrUpdateUserSchema = z.object({
  userID: z.string().optional(),
  email: z.string().email(),
  name: z.string().optional(),
  companyID: z.string().optional(),
  companyName: z.string().optional()
});

export const usersRoutes = Router();

function formatUser(user: {
  id: string;
  email: string;
  name: string;
  appUserId: string | null;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>): Record<string, unknown> {
  return {
    id: user.id,
    userID: user.appUserId ?? user.id,
    appUserId: user.appUserId,
    email: user.email,
    name: user.name,
    companyID: user.companyId,
    companyId: user.companyId,
    company: user.company,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

usersRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listUsersSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const limit = parsed.data.limit ?? 100;
  const skip = parsed.data.skip ?? 0;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            monthlySpend: true,
            healthStatus: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.count()
  ]);

  res.status(200).json({
    users: users.map((user) => formatUser(user)),
    hasMore: skip + users.length < total
  });
});

usersRoutes.post("/create_or_update", requireApiKey, async (req, res) => {
  const parsed = createOrUpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid create_or_update payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const { email, name, userID, companyID, companyName } = parsed.data;

    const user = await prisma.$transaction(async (tx) => {
      let company = companyID
        ? await tx.company.findUnique({ where: { id: companyID } })
        : null;

      if (!company && companyName) {
        company = await tx.company.findFirst({ where: { name: companyName } });
      }

      if (!company) {
        const cName = companyName ?? "unassigned";
        const slug = cName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unassigned";
        company = await tx.company.create({
          data: {
            name: cName,
            slug,
            monthlySpend: 0,
            healthStatus: "unknown"
          }
        });
      }

      const existing = userID
        ? await tx.user.findFirst({
            where: {
              OR: [
                { appUserId: userID },
                { email: email.toLowerCase() }
              ]
            }
          })
        : await tx.user.findFirst({
            where: { email: email.toLowerCase() }
          });

      if (existing) {
        return tx.user.update({
          where: { id: existing.id },
          data: {
            email: email.toLowerCase(),
            name: name ?? existing.name,
            appUserId: userID ?? existing.appUserId,
            companyId: company.id
          },
          include: {
            company: true
          }
        });
      }

      return tx.user.create({
        data: {
          email: email.toLowerCase(),
          name: name ?? email,
          appUserId: userID,
          companyId: company.id
        },
        include: {
          company: true
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    res.status(200).json({ user: formatUser(user) });
  } catch (error) {
    console.error("User create_or_update failed", error);
    res.status(500).json({ error: "Failed to create_or_update user" });
  }
});
