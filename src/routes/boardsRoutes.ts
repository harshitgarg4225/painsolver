import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listBoardsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

const retrieveBoardSchema = z.object({
  boardID: z.string().min(1)
});

const createBoardSchema = z.object({
  name: z.string().min(1),
  isPrivate: z.boolean().optional()
});

export const boardsRoutes = Router();

function formatBoard(board: {
  id: string;
  name: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>): Record<string, unknown> {
  return {
    id: board.id,
    boardID: board.id,
    name: board.name,
    isPrivate: board.isPrivate,
    postCount: board.postCount,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    categories: board.categories,
    posts: board.posts
  };
}

boardsRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listBoardsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const limit = parsed.data.limit ?? 50;
  const skip = parsed.data.skip ?? 0;

  const [boards, total] = await Promise.all([
    prisma.board.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    }),
    prisma.board.count()
  ]);

  res.status(200).json({
    boards: boards.map((board) =>
      formatBoard({
        ...board,
        postCount: board._count.posts
      })
    ),
    hasMore: skip + boards.length < total
  });
});

boardsRoutes.post("/retrieve", requireApiKey, async (req, res) => {
  const parsed = retrieveBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid retrieve payload", details: parsed.error.flatten() });
    return;
  }

  const board = await prisma.board.findUnique({
    where: { id: parsed.data.boardID },
    include: {
      categories: true,
      posts: {
        orderBy: { totalAttachedMrr: "desc" }
      }
    }
  });

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  res.status(200).json({ board: formatBoard(board) });
});

boardsRoutes.post("/create", requireApiKey, async (req, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid create payload", details: parsed.error.flatten() });
    return;
  }

  const companyId = (req as any).companyId ?? "default";
  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const board = await prisma.board.create({
    data: {
      name: parsed.data.name,
      slug,
      isPrivate: parsed.data.isPrivate ?? false,
      companyId
    }
  });

  res.status(201).json({ board: formatBoard(board) });
});
