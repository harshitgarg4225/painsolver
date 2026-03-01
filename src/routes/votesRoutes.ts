import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { isApiKeyValid } from "../lib/apiKey";
import { requireApiKey } from "../middleware/requireApiKey";
import { createOrUpgradeVote } from "../services/postService";

const createVoteSchema = z.object({
  userId: z.string().optional(),
  userID: z.string().optional(),
  voterID: z.string().optional(),
  postId: z.string().optional(),
  postID: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  companyName: z.string().optional()
});

const listVotesSchema = z.object({
  userID: z.string().optional(),
  postID: z.string().optional()
});

const retrieveVoteSchema = z.object({
  userID: z.string().min(1),
  postID: z.string().min(1)
});

const deleteVoteSchema = z.object({
  userID: z.string().optional(),
  postID: z.string().optional(),
  voteID: z.string().optional(),
  userId: z.string().optional(),
  postId: z.string().optional()
});

async function resolveUserId(payload: z.infer<typeof createVoteSchema>): Promise<string> {
  const explicitUserId = payload.userId ?? payload.userID ?? payload.voterID;
  if (explicitUserId) {
    return explicitUserId;
  }

  if (!payload.email) {
    throw new Error("Missing user identifier");
  }

  const email = payload.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    return existing.id;
  }

  const company = await prisma.company.upsert({
    where: { name: payload.companyName ?? "unassigned" },
    update: {},
    create: {
      name: payload.companyName ?? "unassigned",
      monthlySpend: 0,
      healthStatus: "unknown"
    }
  });

  const created = await prisma.user.create({
    data: {
      email,
      name: payload.name ?? payload.email,
      companyId: company.id
    }
  });

  return created.id;
}

export const votesRoutes = Router();

function formatVote(vote: {
  id: string;
  userId: string;
  postId: string;
  voteType: string;
  aiActionLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>): Record<string, unknown> {
  return {
    id: vote.id,
    userID: vote.userId,
    userId: vote.userId,
    postID: vote.postId,
    postId: vote.postId,
    voteType: vote.voteType,
    aiActionLogId: vote.aiActionLogId,
    createdAt: vote.createdAt,
    updatedAt: vote.updatedAt,
    user: vote.user,
    post: vote.post
  };
}

votesRoutes.post("/create", async (req, res) => {
  const parsed = createVoteSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vote payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const postId = parsed.data.postId ?? parsed.data.postID;
    if (!postId) {
      res.status(400).json({ error: "Missing postID" });
      return;
    }

    const providedApiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : null;
    if (providedApiKey) {
      const isValid =
        (env.PAINSOLVER_MASTER_API_KEY && providedApiKey === env.PAINSOLVER_MASTER_API_KEY) ||
        (await isApiKeyValid(providedApiKey));

      if (!isValid) {
        res.status(401).json({ error: "Invalid apiKey" });
        return;
      }
    }

    const userId = await resolveUserId(parsed.data);
    const result = await createOrUpgradeVote(userId, postId);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Failed to create vote" });
  }
});

votesRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listVotesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const votes = await prisma.vote.findMany({
    where: {
      userId: parsed.data.userID,
      postId: parsed.data.postID
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          appUserId: true
        }
      },
      post: {
        select: {
          id: true,
          title: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({ votes: votes.map((vote) => formatVote(vote)) });
});

votesRoutes.post("/retrieve", requireApiKey, async (req, res) => {
  const parsed = retrieveVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid retrieve payload", details: parsed.error.flatten() });
    return;
  }

  const vote = await prisma.vote.findUnique({
    where: {
      userId_postId: {
        userId: parsed.data.userID,
        postId: parsed.data.postID
      }
    }
  });

  if (!vote) {
    res.status(404).json({ error: "Vote not found" });
    return;
  }

  res.status(200).json({ vote: formatVote(vote) });
});

votesRoutes.post("/delete", async (req, res) => {
  const parsed = deleteVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid delete payload", details: parsed.error.flatten() });
    return;
  }

  const voteId = parsed.data.voteID;
  const userId = parsed.data.userId ?? parsed.data.userID;
  const postId = parsed.data.postId ?? parsed.data.postID;

  const providedApiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : null;
  if (providedApiKey) {
    const isValid =
      (env.PAINSOLVER_MASTER_API_KEY && providedApiKey === env.PAINSOLVER_MASTER_API_KEY) ||
      (await isApiKeyValid(providedApiKey));

    if (!isValid) {
      res.status(401).json({ error: "Invalid apiKey" });
      return;
    }
  }

  const vote = voteId
    ? await prisma.vote.findUnique({ where: { id: voteId } })
    : userId && postId
      ? await prisma.vote.findUnique({
          where: {
            userId_postId: {
              userId,
              postId
            }
          }
        })
      : null;

  if (!vote) {
    res.status(404).json({ error: "Vote not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.vote.delete({
      where: { id: vote.id }
    });

    const user = await tx.user.findUnique({
      where: { id: vote.userId },
      include: { company: true }
    });

    if (!user) {
      return;
    }

    const adjustment: Prisma.PostUpdateInput =
      vote.voteType === "explicit"
        ? {
            explicitVoteCount: { decrement: 1 },
            totalAttachedMrr: { decrement: user.company.monthlySpend }
          }
        : {
            implicitVoteCount: { decrement: 1 },
            totalAttachedMrr: { decrement: user.company.monthlySpend }
          };

    await tx.post.update({
      where: { id: vote.postId },
      data: adjustment
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  res.status(200).json({ ok: true });
});
