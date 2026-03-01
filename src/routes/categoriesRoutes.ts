import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { requireApiKey } from "../middleware/requireApiKey";

const listCategoriesSchema = z.object({
  boardID: z.string().optional()
});

const createCategorySchema = z.object({
  boardID: z.string().min(1),
  name: z.string().min(1)
});

const updateCategorySchema = z.object({
  categoryID: z.string().min(1),
  name: z.string().min(1)
});

export const categoriesRoutes = Router();

function formatCategory(category: {
  id: string;
  boardId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: category.id,
    boardID: category.boardId,
    boardId: category.boardId,
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

categoriesRoutes.post("/list", requireApiKey, async (req, res) => {
  const parsed = listCategoriesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid list payload", details: parsed.error.flatten() });
    return;
  }

  const categories = await prisma.category.findMany({
    where: {
      boardId: parsed.data.boardID
    },
    orderBy: { createdAt: "asc" }
  });

  res.status(200).json({ categories: categories.map(formatCategory) });
});

categoriesRoutes.post("/create", requireApiKey, async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid create payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const category = await prisma.category.create({
      data: {
        boardId: parsed.data.boardID,
        name: parsed.data.name
      }
    });

    res.status(201).json({ category: formatCategory(category) });
  } catch (error) {
    console.error("Category create failed", error);
    res.status(400).json({ error: "Could not create category" });
  }
});

categoriesRoutes.post("/update", requireApiKey, async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update payload", details: parsed.error.flatten() });
    return;
  }

  const category = await prisma.category.update({
    where: {
      id: parsed.data.categoryID
    },
    data: {
      name: parsed.data.name
    }
  });

  res.status(200).json({ category: formatCategory(category) });
});
