import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireAdminKey } from "../middleware/requireAdminKey";

const mergeSchema = z.object({
  postId: z.string().min(1)
});

const createPostFromEventSchema = z.object({
  boardId: z.string().min(1),
  categoryId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional()
});

const createPostSchema = z.object({
  boardId: z.string().min(1),
  categoryId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["backlog", "planned", "in_progress", "shipped"]).optional()
});

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAdminKey);

dashboardRoutes.get("/summary", async (_req, res) => {
  const [postCount, boardCount, companyCount, userCount, painEventCount, triageCount, mrr] =
    await Promise.all([
      prisma.post.count(),
      prisma.board.count(),
      prisma.company.count(),
      prisma.user.count(),
      prisma.painEvent.count(),
      prisma.painEvent.count({ where: { status: "needs_triage" } }),
      prisma.post.aggregate({ _sum: { totalAttachedMrr: true } })
    ]);

  const topPosts = await prisma.post.findMany({
    take: 5,
    orderBy: { totalAttachedMrr: "desc" },
    include: {
      board: {
        select: { id: true, name: true }
      },
      category: {
        select: { id: true, name: true }
      }
    }
  });

  res.status(200).json({
    metrics: {
      postCount,
      boardCount,
      companyCount,
      userCount,
      painEventCount,
      triageCount,
      totalAttachedMrr: mrr._sum.totalAttachedMrr ?? 0
    },
    topPosts
  });
});

dashboardRoutes.get("/boards", async (_req, res) => {
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      categories: {
        orderBy: { createdAt: "asc" }
      },
      _count: {
        select: { posts: true }
      }
    }
  });

  res.status(200).json({ boards });
});

dashboardRoutes.get("/posts", async (req, res) => {
  const statusQuery = typeof req.query.status === "string" ? req.query.status : undefined;
  const status =
    statusQuery && ["backlog", "planned", "in_progress", "shipped"].includes(statusQuery)
      ? (statusQuery as "backlog" | "planned" | "in_progress" | "shipped")
      : undefined;
  const posts = await prisma.post.findMany({
    where: {
      status
    },
    orderBy: [
      { totalAttachedMrr: "desc" },
      { explicitVoteCount: "desc" }
    ],
    include: {
      board: true,
      category: true,
      _count: {
        select: {
          votes: true,
          comments: true
        }
      }
    }
  });

  res.status(200).json({ posts });
});

dashboardRoutes.post("/posts", async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid post payload", details: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;

  const post = await prisma.$transaction(async (tx) => {
    let categoryId = payload.categoryId;

    if (!categoryId) {
      const category = await tx.category.findFirst({
        where: { boardId: payload.boardId },
        orderBy: { createdAt: "asc" }
      });

      if (category) {
        categoryId = category.id;
      } else {
        const fallback = await tx.category.create({
          data: {
            boardId: payload.boardId,
            name: "General"
          }
        });
        categoryId = fallback.id;
      }
    }

    if (!categoryId) {
      throw new Error("Unable to resolve category");
    }

    return tx.post.create({
      data: {
        boardId: payload.boardId,
        categoryId,
        title: payload.title,
        description: payload.description ?? "",
        status: payload.status ?? "backlog"
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  res.status(201).json({ post });
});

dashboardRoutes.get("/pain-events", async (req, res) => {
  const statusQuery = typeof req.query.status === "string" ? req.query.status : "needs_triage";
  const status =
    statusQuery && ["pending_ai", "needs_triage", "auto_merged"].includes(statusQuery)
      ? (statusQuery as "pending_ai" | "needs_triage" | "auto_merged")
      : "needs_triage";
  const painEvents = await prisma.painEvent.findMany({
    where: {
      status
    },
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
          status: true
        }
      },
      aiActionLog: true
    }
  });

  res.status(200).json({ painEvents });
});

dashboardRoutes.post("/pain-events/:id/merge", async (req, res) => {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid merge payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const painEventId = req.params.id;
    const postId = parsed.data.postId;

    const result = await prisma.$transaction(async (tx) => {
      const painEvent = await tx.painEvent.findUnique({
        where: { id: painEventId },
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

      const post = await tx.post.findUnique({ where: { id: postId } });
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

      return tx.painEvent.update({
        where: { id: painEvent.id },
        data: {
          status: "auto_merged",
          matchedPostId: post.id
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    res.status(200).json({ painEvent: result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("Dashboard merge failed", error);
    res.status(500).json({ error: "Failed to merge pain event" });
  }
});

dashboardRoutes.post("/pain-events/:id/create-post", async (req, res) => {
  const parsed = createPostFromEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const painEventId = req.params.id;
  const payload = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const painEvent = await tx.painEvent.findUnique({ where: { id: painEventId } });
      if (!painEvent) {
        throw new Error("PainEvent not found");
      }

      let categoryId = payload.categoryId;
      if (!categoryId) {
        const fallback = await tx.category.findFirst({
          where: { boardId: payload.boardId },
          orderBy: { createdAt: "asc" }
        });

        if (fallback) {
          categoryId = fallback.id;
        } else {
          const created = await tx.category.create({
            data: {
              boardId: payload.boardId,
              name: "General"
            }
          });
          categoryId = created.id;
        }
      }

      if (!categoryId) {
        throw new Error("Unable to resolve category");
      }

      const post = await tx.post.create({
        data: {
          boardId: payload.boardId,
          categoryId,
          title: payload.title,
          description: payload.description ?? painEvent.rawText,
          status: "backlog"
        }
      });

      await tx.painEvent.update({
        where: { id: painEvent.id },
        data: {
          status: "auto_merged",
          matchedPostId: post.id
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

    console.error("Dashboard create-post failed", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

dashboardRoutes.get("/activity", async (_req, res) => {
  const [logs, comments, changelog] = await Promise.all([
    prisma.aiActionLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        painEvent: {
          select: {
            id: true,
            rawText: true
          }
        }
      }
    }),
    prisma.comment.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { id: true, title: true } },
        author: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.changelogEntry.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { id: true, title: true } }
      }
    })
  ]);

  res.status(200).json({ logs, comments, changelog });
});
