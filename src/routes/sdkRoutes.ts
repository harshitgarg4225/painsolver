import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { verifyIdentifyHmac } from "../middleware/verifyIdentifyHmac";
import { createOrUpgradeVote, listPostsWithVotes } from "../services/postService";

const identifySchema = z.object({
  user: z.object({
    email: z.string().email(),
    name: z.string().optional(),
    appUserId: z.string().optional()
  }),
  company: z.object({
    name: z.string().min(1),
    monthlySpend: z.number().nonnegative().optional(),
    healthStatus: z.string().optional(),
    stripeCustomerId: z.string().optional()
  }),
  hash: z.string().min(1)
});

const sdkVoteSchema = z.object({
  userId: z.string().min(1),
  postId: z.string().min(1)
});

export const sdkRoutes = Router();

sdkRoutes.post("/identify", verifyIdentifyHmac, async (req, res) => {
  const parsed = identifySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid identify payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const { user: userInput, company: companyInput, hash } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      let company = companyInput.stripeCustomerId
        ? await tx.company.findUnique({
            where: { stripeCustomerId: companyInput.stripeCustomerId }
          })
        : null;

      if (!company) {
        company = await tx.company.findUnique({
          where: { name: companyInput.name }
        });
      }

      if (!company) {
        company = await tx.company.create({
          data: {
            name: companyInput.name,
            monthlySpend: companyInput.monthlySpend ?? 0,
            healthStatus: companyInput.healthStatus ?? "unknown",
            stripeCustomerId: companyInput.stripeCustomerId
          }
        });
      } else {
        company = await tx.company.update({
          where: { id: company.id },
          data: {
            monthlySpend: companyInput.monthlySpend ?? company.monthlySpend,
            healthStatus: companyInput.healthStatus ?? company.healthStatus,
            stripeCustomerId: companyInput.stripeCustomerId ?? company.stripeCustomerId
          }
        });
      }

      const existingUser = await tx.user.findUnique({
        where: {
          email: userInput.email.toLowerCase()
        }
      });

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: userInput.name ?? existingUser.name,
              appUserId: userInput.appUserId ?? existingUser.appUserId,
              hmacHash: hash,
              companyId: company.id
            }
          })
        : await tx.user.create({
            data: {
              email: userInput.email.toLowerCase(),
              name: userInput.name ?? userInput.email,
              appUserId: userInput.appUserId,
              hmacHash: hash,
              companyId: company.id
            }
          });

      return {
        userId: user.id,
        companyId: company.id
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("SDK identify failed", error);
    res.status(500).json({ error: "Failed to identify user" });
  }
});

sdkRoutes.get("/posts", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const posts = await listPostsWithVotes(userId);

  res.status(200).json({ posts });
});

sdkRoutes.post("/votes/create", async (req, res) => {
  const parsed = sdkVoteSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid vote payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const result = await createOrUpgradeVote(parsed.data.userId, parsed.data.postId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Failed to create vote" });
  }
});
