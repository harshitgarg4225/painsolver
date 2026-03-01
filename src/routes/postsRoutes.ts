import { Prisma, PostStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";
import { listPostsWithVotes } from "../services/postService";

const postStatusSchema = z.enum(["backlog", "planned", "in_progress", "shipped"]);

const listPostsSchema = z.object({
  boardID: z.string().optional(),
  categoryID: z.string().optional(),
  status: postStatusSchema.optional(),
  userID: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(["mrr", "votes", "new"]).optional()
});

const retrievePostSchema = z.object({
  postID: z.string().min(1)
});

const createPostSchema = z.object({
  boardID: z.string().min(1),
  categoryID: z.string().optional(),
  title: z.string().min(1),
  details: z.string().optional(),
  status: postStatusSchema.optional()
});

const updatePostSchema = z.object({
  postID: z.string().min(1),
  title: z.string().optional(),
  details: z.string().optional(),
  categoryID: z.string().optional()
});

const changeStatusSchema = z.object({
  postID: z.string().min(1),
  status: postStatusSchema
});

const deletePostSchema = z.object({
  postID: z.string().min(1)
});

export const postsRoutes = Router();

function formatPost(post: {
  id: string;
  title: string;
  description: string;
  boardId: string;
  categoryId: string;
  status: PostStatus;
  score: number;
  totalAttachedMrr: number;
  implicitVoteCount: number;
  explicitVoteCount: number;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: post.id,
    title: post.title,
    details: post.description,
    description: post.description,
    boardID: post.boardId,
    categoryID: post.categoryId,
    status: post.status,
    score: post.score,
    totalAttachedMrr: post.totalAttachedMrr,
    implicitVoteCount: post.implicitVoteCount,
    explicitVoteCount: post.explicitVoteCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
}

postsRoutes.get("/list", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const posts = await listPostsWithVotes(userId);

  res.status(200).json({ posts });
});

postsRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listPostsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const limit = parsed.data.limit ?? 50;
  const skip = parsed.data.skip ?? 0;
  const voteLookupUserId = parsed.data.userID ?? "__no_user__";

  const where: Prisma.PostWhereInput = {
    boardId: parsed.data.boardID,
    categoryId: parsed.data.categoryID,
    status: parsed.data.status
  };

  const orderBy: Prisma.PostOrderByWithRelationInput =
    parsed.data.sortBy === "new"
      ? { createdAt: "desc" }
      : parsed.data.sortBy === "votes"
        ? { explicitVoteCount: "desc" }
        : { totalAttachedMrr: "desc" };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        board: true,
        category: true,
        _count: {
          select: { votes: true, comments: true }
        },
        votes: {
          where: { userId: voteLookupUserId },
          select: { voteType: true }
        }
      }
    }),
    prisma.post.count({ where })
  ]);

  res.status(200).json({
    posts: posts.map((post) => ({
      ...formatPost(post),
      board: {
        id: post.board.id,
        name: post.board.name
      },
      category: {
        id: post.category.id,
        name: post.category.name
      },
      score: post.score,
      totalAttachedMrr: post.totalAttachedMrr,
      voteCount: post._count.votes,
      commentCount: post._count.comments,
      viewerVoteType: parsed.data.userID ? post.votes[0]?.voteType ?? null : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    })),
    hasMore: skip + posts.length < total
  });
});

postsRoutes.post("/retrieve", requireApiKey, async (req, res) => {
  const parsed = retrievePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid retrieve payload", details: parsed.error.flatten() });
    return;
  }

  const post = await prisma.post.findUnique({
    where: { id: parsed.data.postID },
    include: {
      board: true,
      category: true,
      votes: true,
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(200).json({
    post: {
      ...formatPost(post),
      board: post.board,
      category: post.category,
      votes: post.votes,
      comments: post.comments
    }
  });
});

postsRoutes.post("/create", requireApiKey, async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid create payload", details: parsed.error.flatten() });
    return;
  }

  const { boardID, categoryID, title, details, status } = parsed.data;

  try {
    const post = await prisma.$transaction(async (tx) => {
      let resolvedCategoryId = categoryID;

      if (!resolvedCategoryId) {
        const existingCategory = await tx.category.findFirst({
          where: { boardId: boardID },
          orderBy: { createdAt: "asc" }
        });

        if (existingCategory) {
          resolvedCategoryId = existingCategory.id;
        } else {
          const createdCategory = await tx.category.create({
            data: {
              boardId: boardID,
              name: "General"
            }
          });
          resolvedCategoryId = createdCategory.id;
        }
      }

      if (!resolvedCategoryId) {
        throw new Error("Unable to resolve category");
      }

      return tx.post.create({
        data: {
          boardId: boardID,
          categoryId: resolvedCategoryId,
          title,
          description: details ?? "",
          status: status ?? PostStatus.backlog
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    res.status(201).json({ post: formatPost(post) });
  } catch (error) {
    console.error("Post create failed", error);
    res.status(400).json({ error: "Could not create post" });
  }
});

postsRoutes.post("/update", requireApiKey, async (req, res) => {
  const parsed = updatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update payload", details: parsed.error.flatten() });
    return;
  }

  const post = await prisma.post.update({
    where: { id: parsed.data.postID },
    data: {
      title: parsed.data.title,
      description: parsed.data.details,
      categoryId: parsed.data.categoryID
    }
  });

  res.status(200).json({ post: formatPost(post) });
});

postsRoutes.post("/change_status", requireApiKey, async (req, res) => {
  const parsed = changeStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid change_status payload",
      details: parsed.error.flatten()
    });
    return;
  }

  const post = await prisma.post.update({
    where: { id: parsed.data.postID },
    data: {
      status: parsed.data.status
    }
  });

  res.status(200).json({ post: formatPost(post) });
});

postsRoutes.post("/delete", requireApiKey, async (req, res) => {
  const parsed = deletePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid delete payload", details: parsed.error.flatten() });
    return;
  }

  await prisma.post.delete({ where: { id: parsed.data.postID } });
  res.status(200).json({ ok: true });
});
