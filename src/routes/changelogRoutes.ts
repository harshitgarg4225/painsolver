import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listChangelogSchema = z.object({
  postID: z.string().optional(),
  publishedOnly: z.boolean().optional()
});

const createEntrySchema = z.object({
  postID: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  isPublished: z.boolean().optional()
});

const publishEntrySchema = z.object({
  entryID: z.string().min(1),
  isPublished: z.boolean()
});

export const changelogRoutes = Router();

function formatEntry(entry: {
  id: string;
  postId: string | null;
  boardId: string | null;
  title: string;
  content: string;
  tags: string[];
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>): Record<string, unknown> {
  return {
    id: entry.id,
    postID: entry.postId,
    postId: entry.postId,
    boardId: entry.boardId,
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    isPublished: entry.isPublished,
    publishedAt: entry.publishedAt,
    post: entry.post,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

changelogRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listChangelogSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const entries = await prisma.changelogEntry.findMany({
    where: {
      postId: parsed.data.postID,
      isPublished: parsed.data.publishedOnly ? true : undefined
    },
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        select: {
          id: true,
          title: true,
          status: true
        }
      }
    }
  });

  res.status(200).json({ entries: entries.map((entry) => formatEntry(entry)) });
});

changelogRoutes.post("/create", requireApiKey, async (req, res) => {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid create payload", details: parsed.error.flatten() });
    return;
  }

  const shouldPublish = parsed.data.isPublished ?? false;

  const entry = await prisma.changelogEntry.create({
    data: {
      postId: parsed.data.postID,
      title: parsed.data.title,
      content: parsed.data.content,
      isPublished: shouldPublish,
      publishedAt: shouldPublish ? new Date() : null
    }
  });

  res.status(201).json({ entry: formatEntry(entry) });
});

changelogRoutes.post("/publish", requireApiKey, async (req, res) => {
  const parsed = publishEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid publish payload", details: parsed.error.flatten() });
    return;
  }

  const entry = await prisma.changelogEntry.update({
    where: { id: parsed.data.entryID },
    data: {
      isPublished: parsed.data.isPublished,
      publishedAt: parsed.data.isPublished ? new Date() : null
    }
  });

  res.status(200).json({ entry: formatEntry(entry) });
});
