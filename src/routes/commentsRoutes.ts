import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listCommentsSchema = z.object({
  postID: z.string().min(1),
  limit: z.coerce.number().min(1).max(200).default(50),
  cursor: z.string().optional()
});

const createCommentSchema = z.object({
  postID: z.string().min(1),
  authorID: z.string().min(1),
  value: z.string().min(1),
  isPrivate: z.boolean().optional()
});

const deleteCommentSchema = z.object({
  commentID: z.string().min(1)
});

export const commentsRoutes = Router();

function formatComment(comment: {
  id: string;
  postId: string;
  authorId: string;
  value: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>): Record<string, unknown> {
  return {
    id: comment.id,
    postID: comment.postId,
    postId: comment.postId,
    authorID: comment.authorId,
    authorId: comment.authorId,
    value: comment.value,
    isPrivate: comment.isPrivate,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.author
  };
}

commentsRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listCommentsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const take = parsed.data.limit;
  const comments = await prisma.comment.findMany({
    where: { postId: parsed.data.postID },
    orderBy: { createdAt: "asc" },
    take: take + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    include: {
      author: {
        select: {
          id: true,
          email: true,
          name: true,
          appUserId: true
        }
      }
    }
  });

  const hasMore = comments.length > take;
  const page = hasMore ? comments.slice(0, take) : comments;
  const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

  res.status(200).json({
    comments: page.map((comment) => formatComment(comment)),
    nextCursor
  });
});

commentsRoutes.post("/create", requireApiKey, async (req, res) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid create payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        postId: parsed.data.postID,
        authorId: parsed.data.authorID,
        value: parsed.data.value,
        isPrivate: parsed.data.isPrivate ?? false
      }
    });

    res.status(201).json({ comment: formatComment(comment) });
  } catch (error) {
    console.error("Comment create failed", error);
    res.status(400).json({ error: "Could not create comment" });
  }
});

commentsRoutes.post("/delete", requireApiKey, async (req, res) => {
  const parsed = deleteCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid delete payload", details: parsed.error.flatten() });
    return;
  }

  await prisma.comment.delete({
    where: { id: parsed.data.commentID }
  });

  res.status(200).json({ ok: true });
});
