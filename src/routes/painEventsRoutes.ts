import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listPainEventsSchema = z.object({
  status: z.enum(["pending_ai", "needs_triage", "auto_merged"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

const mergePainEventSchema = z.object({
  painEventID: z.string().min(1),
  postID: z.string().min(1)
});

const createPostFromEventSchema = z.object({
  painEventID: z.string().min(1),
  boardID: z.string().min(1),
  categoryID: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional()
});

export const painEventsRoutes = Router();

function formatPainEvent(event: {
  id: string;
  userId: string;
  source: string;
  sourceReferenceId: string;
  rawText: string;
  status: string;
  matchedPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>): Record<string, unknown> {
  return {
    id: event.id,
    painEventID: event.id,
    userID: event.userId,
    userId: event.userId,
    source: event.source,
    sourceReferenceId: event.sourceReferenceId,
    rawText: event.rawText,
    status: event.status,
    matchedPostID: event.matchedPostId,
    matchedPostId: event.matchedPostId,
    user: event.user,
    matchedPost: event.matchedPost,
    aiActionLog: event.aiActionLog,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}

painEventsRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listPainEventsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const limit = parsed.data.limit ?? 100;
  const skip = parsed.data.skip ?? 0;

  const [events, total] = await Promise.all([
    prisma.painEvent.findMany({
      where: {
        status: parsed.data.status
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          include: {
            company: true
          }
        },
        matchedPost: {
          select: {
            id: true,
            title: true,
            status: true,
            totalAttachedMrr: true
          }
        },
        aiActionLog: true
      }
    }),
    prisma.painEvent.count({
      where: {
        status: parsed.data.status
      }
    })
  ]);

  res.status(200).json({
    painEvents: events.map((event) => formatPainEvent(event)),
    hasMore: skip + events.length < total
  });
});

painEventsRoutes.post("/merge", requireApiKey, async (req, res) => {
  const parsed = mergePainEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid merge payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const painEvent = await tx.painEvent.findUnique({
        where: { id: parsed.data.painEventID },
        include: {
          user: {
            include: {
              company: true
            }
          }
        }
      });

      if (!painEvent) {
        throw new Error("PainEvent not found");
      }

      const post = await tx.post.findUnique({ where: { id: parsed.data.postID } });
      if (!post) {
        throw new Error("Post not found");
      }

      const actionLog = await tx.aiActionLog.upsert({
        where: { painEventId: painEvent.id },
        update: {
          actionTaken: "auto_upvote",
          confidenceScore: 1,
          status: "approved"
        },
        create: {
          painEventId: painEvent.id,
          actionTaken: "auto_upvote",
          confidenceScore: 1,
          status: "approved"
        }
      });

      const existingVote = await tx.vote.findUnique({
        where: {
          userId_postId: {
            userId: painEvent.userId,
            postId: post.id
          }
        }
      });

      if (!existingVote) {
        await tx.vote.create({
          data: {
            userId: painEvent.userId,
            postId: post.id,
            voteType: "implicit",
            aiActionLogId: actionLog.id
          }
        });

        await tx.post.update({
          where: { id: post.id },
          data: {
            implicitVoteCount: { increment: 1 },
            totalAttachedMrr: { increment: painEvent.user.company.monthlySpend }
          }
        });
      }

      const updatedPainEvent = await tx.painEvent.update({
        where: { id: painEvent.id },
        data: {
          status: "auto_merged",
          matchedPostId: post.id
        }
      });

      return updatedPainEvent;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    res.status(200).json({ painEvent: formatPainEvent(result) });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("not found") || error.message.includes("Post"))) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("PainEvent merge failed", error);
    res.status(500).json({ error: "Failed to merge pain event" });
  }
});

painEventsRoutes.post("/create_post", requireApiKey, async (req, res) => {
  const parsed = createPostFromEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid create_post payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const payload = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const painEvent = await tx.painEvent.findUnique({
        where: { id: payload.painEventID },
        include: {
          user: {
            include: {
              company: true
            }
          }
        }
      });

      if (!painEvent) {
        throw new Error("PainEvent not found");
      }

      let categoryId = payload.categoryID;
      if (!categoryId) {
        const fallbackCategory = await tx.category.findFirst({
          where: { boardId: payload.boardID },
          orderBy: { createdAt: "asc" }
        });

        if (fallbackCategory) {
          categoryId = fallbackCategory.id;
        } else {
          const newCategory = await tx.category.create({
            data: {
              boardId: payload.boardID,
              name: "General"
            }
          });
          categoryId = newCategory.id;
        }
      }

      if (!categoryId) {
        throw new Error("Unable to resolve category");
      }

      const post = await tx.post.create({
        data: {
          boardId: payload.boardID,
          categoryId,
          title: payload.title,
          description: payload.description ?? painEvent.rawText,
          status: "backlog"
        }
      });

      await tx.aiActionLog.upsert({
        where: { painEventId: painEvent.id },
        update: {
          actionTaken: "suggested_new",
          confidenceScore: 1,
          status: "approved"
        },
        create: {
          painEventId: painEvent.id,
          actionTaken: "suggested_new",
          confidenceScore: 1,
          status: "approved"
        }
      });

      await tx.painEvent.update({
        where: { id: painEvent.id },
        data: {
          status: "auto_merged",
          matchedPostId: post.id
        }
      });

      return post;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    res.status(201).json({ post: result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("Create post from pain event failed", error);
    res.status(500).json({ error: "Failed to create post from pain event" });
  }
});
