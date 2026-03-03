import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { createApiCredential } from "../lib/apiKey";
import { signSdkToken } from "../lib/hash";

export const onboardingRoutes = Router();

const setupSchema = z.object({
  companyName: z.string().min(1).max(200),
  boardName: z.string().min(1).max(200).default("Feature Requests"),
  adminEmail: z.string().email(),
  adminName: z.string().max(200).optional(),
  mrrRange: z.enum(["0-1k", "1k-10k", "10k-50k", "50k-100k", "100k+"]).optional(),
  tools: z.array(z.string()).optional(),
  currentProcess: z.string().optional()
});

function mrrRangeToMonthlySpend(range: string | undefined): number {
  switch (range) {
    case "0-1k":
      return 500;
    case "1k-10k":
      return 5000;
    case "10k-50k":
      return 25000;
    case "50k-100k":
      return 75000;
    case "100k+":
      return 150000;
    default:
      return 0;
  }
}

/**
 * POST /api/onboarding/setup
 * Creates a workspace: company, admin user, board, API credential, board token.
 */
onboardingRoutes.post("/setup", async (req, res) => {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid setup payload", details: parsed.error.flatten() });
    return;
  }

  const { companyName, boardName, adminEmail, adminName, mrrRange, tools } = parsed.data;
  const normalizedEmail = adminEmail.trim().toLowerCase();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create or update company
      const company = await tx.company.upsert({
        where: { name: companyName },
        update: {
          monthlySpend: mrrRangeToMonthlySpend(mrrRange)
        },
        create: {
          name: companyName,
          monthlySpend: mrrRangeToMonthlySpend(mrrRange),
          healthStatus: "active"
        }
      });

      // 2. Create or update admin user
      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: adminName || normalizedEmail,
          role: "admin"
        },
        create: {
          email: normalizedEmail,
          name: adminName || normalizedEmail,
          companyId: company.id,
          role: "admin",
          segments: []
        }
      });

      // 3. Create default board with categories
      const existingBoard = await tx.board.findFirst({
        where: { name: boardName }
      });

      let board;
      if (existingBoard) {
        board = existingBoard;
      } else {
        board = await tx.board.create({
          data: {
            name: boardName,
            visibility: "public",
            isPrivate: false,
            allowedSegments: []
          }
        });

        const defaultCategories = ["Feature Request", "Bug Report", "Improvement"];
        for (const catName of defaultCategories) {
          await tx.category.upsert({
            where: { boardId_name: { boardId: board.id, name: catName } },
            update: {},
            create: { boardId: board.id, name: catName }
          });
        }
      }

      return { company, user, board };
    });

    // 4. Generate API key (outside transaction to avoid holding locks)
    const rawApiKey = "ps_live_" + crypto.randomBytes(24).toString("hex");
    await createApiCredential(companyName + " API Key", rawApiKey, ["*"]);

    // 5. Generate board token (90-day expiry)
    const boardToken = signSdkToken(
      {
        type: "board",
        boardId: result.board.id,
        exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
      },
      env.PAINSOLVER_CLIENT_SECRET
    );

    // 6. Build SDK snippet
    const host = `${req.protocol}://${req.get("host") ?? "localhost:3000"}`;
    const sdkSnippet = `<script src="${host}/sdk/painsolver.js"></script>
<div id="painsolver-board"></div>
<script>
  PainSolver("init", {
    apiBaseUrl: "${host}",
    boardToken: "${boardToken}"
  });
  PainSolver("identify", {
    user: { email: "USER_EMAIL", name: "USER_NAME" },
    company: { name: "${companyName}" },
    hash: "SERVER_GENERATED_HMAC"
  }).then(function() {
    PainSolver("render", { selector: "#painsolver-board" });
  });
</script>`;

    // 7. Build integration URLs
    const integrationUrls: Record<string, string> = {};
    if (tools?.includes("slack")) {
      integrationUrls.slack = `${host}/company#ai-inbox`;
    }
    if (tools?.includes("freshdesk")) {
      integrationUrls.freshdesk = `${host}/company#ai-inbox`;
    }
    if (tools?.includes("zoom")) {
      integrationUrls.zoom = `${host}/company#ai-inbox`;
    }

    res.status(201).json({
      companyId: result.company.id,
      userId: result.user.id,
      boardId: result.board.id,
      boardName: result.board.name,
      apiKey: rawApiKey,
      boardToken,
      clientSecret: env.PAINSOLVER_CLIENT_SECRET,
      sdkSnippet,
      integrationUrls
    });
  } catch (error) {
    console.error("[Onboarding] Setup failed:", error);
    res.status(500).json({ error: "Setup failed. Please try again." });
  }
});

/**
 * POST /api/onboarding/test-event
 * Creates a test post to verify SDK integration.
 */
onboardingRoutes.post("/test-event", async (req, res) => {
  const schema = z.object({
    boardId: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "boardId is required" });
    return;
  }

  const board = await prisma.board.findUnique({
    where: { id: parsed.data.boardId },
    include: { categories: { take: 1 } }
  });

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const categoryId = board.categories[0]?.id;
  if (!categoryId) {
    res.status(400).json({ error: "Board has no categories" });
    return;
  }

  const post = await prisma.post.create({
    data: {
      boardId: board.id,
      categoryId,
      title: "[Test] SDK Integration Verified",
      description: "This test post was created to verify your PainSolver SDK integration is working correctly. You can safely delete this post.",
      status: "under_review",
      ownerName: "PainSolver Setup"
    }
  });

  res.status(201).json({
    success: true,
    postId: post.id,
    message: "Test post created successfully! Your integration is working."
  });
});
