import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { signSdkToken, verifySdkToken } from "../lib/hash";
import { verifyIdentifyHmac } from "../middleware/verifyIdentifyHmac";
import { requireApiKey } from "../middleware/requireApiKey";
import { createOrUpgradeVote, listPostsWithVotes } from "../services/postService";

const sdkUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().optional(),
    appUserId: z.string().optional(),
    id: z.string().optional(),
    customFields: z.record(z.unknown()).optional()
  })
  .passthrough();

const sdkCompanySchema = z
  .object({
    name: z.string().min(1),
    monthlySpend: z.number().nonnegative().optional(),
    healthStatus: z.string().optional(),
    stripeCustomerId: z.string().optional(),
    id: z.string().optional(),
    customFields: z.record(z.unknown()).optional()
  })
  .passthrough();

const sdkIdentifyPayloadSchema = z
  .object({
    user: sdkUserSchema,
    company: sdkCompanySchema
  })
  .passthrough();

const identifySchema = sdkIdentifyPayloadSchema
  .extend({
    hash: z.string().min(1),
    mode: z.enum(["append", "replace", "override"]).optional(),
    companies: z.array(sdkCompanySchema).optional(),
    customFields: z.record(z.unknown()).optional()
  })
  .passthrough();

const sdkVoteSchema = z
  .object({
    userId: z.string().min(1).optional(),
    postId: z.string().min(1),
    ssoToken: z.string().min(1).optional()
  })
  .passthrough();

const sdkPostsQuerySchema = z.object({
  userId: z.string().optional(),
  boardId: z.string().optional(),
  boardToken: z.string().optional(),
  ssoToken: z.string().optional()
});

const sdkChangelogQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  boardId: z.string().optional(),
  boardToken: z.string().optional(),
  ssoToken: z.string().optional(),
  userId: z.string().optional()
});

const sdkChangelogSeenSchema = z.object({
  userId: z.string().optional(),
  ssoToken: z.string().optional(),
  boardId: z.string().optional(),
  boardToken: z.string().optional(),
  seenAt: z.string().optional()
});

const sdkSsoTokenSchema = sdkIdentifyPayloadSchema
  .extend({
    expiresInSeconds: z.coerce.number().int().min(60).max(60 * 60 * 24 * 90).optional()
  })
  .passthrough();

const sdkBoardTokenSchema = z.object({
  boardId: z.string().min(1),
  expiresInSeconds: z.coerce.number().int().min(60).max(60 * 60 * 24 * 90).optional()
});

const sdkConsumeSsoSchema = z.object({
  ssoToken: z.string().min(1)
});

interface NormalizedIdentifyInput {
  user: {
    email: string;
    name: string;
    appUserId?: string;
  };
  company: {
    name: string;
    monthlySpend?: number;
    healthStatus?: string;
    stripeCustomerId?: string;
  };
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function queryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseSeenDate(value: string | undefined): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid seenAt timestamp");
  }

  return parsed;
}

function normalizeIdentifyInput(input: {
  user: {
    email: string;
    name?: string;
    appUserId?: string;
    id?: string;
  };
  company: {
    name: string;
    monthlySpend?: number;
    healthStatus?: string;
    stripeCustomerId?: string;
  };
}): NormalizedIdentifyInput {
  return {
    user: {
      email: input.user.email.toLowerCase().trim(),
      name: input.user.name?.trim() || input.user.email.toLowerCase().trim(),
      appUserId: input.user.appUserId?.trim() || input.user.id?.trim() || undefined
    },
    company: {
      name: input.company.name.trim(),
      monthlySpend: input.company.monthlySpend,
      healthStatus: input.company.healthStatus,
      stripeCustomerId: input.company.stripeCustomerId
    }
  };
}

async function upsertIdentity(
  input: NormalizedIdentifyInput
): Promise<{ userId: string; companyId: string; email: string; companyName: string }> {
  return prisma.$transaction(
    async (tx) => {
      let company = input.company.stripeCustomerId
        ? await tx.company.findUnique({
            where: { stripeCustomerId: input.company.stripeCustomerId }
          })
        : null;

      if (!company) {
        company = await tx.company.findUnique({
          where: { name: input.company.name }
        });
      }

      if (!company) {
        company = await tx.company.create({
          data: {
            name: input.company.name,
            monthlySpend: input.company.monthlySpend ?? 0,
            healthStatus: input.company.healthStatus ?? "unknown",
            stripeCustomerId: input.company.stripeCustomerId
          }
        });
      } else {
        company = await tx.company.update({
          where: { id: company.id },
          data: {
            monthlySpend: input.company.monthlySpend ?? company.monthlySpend,
            healthStatus: input.company.healthStatus ?? company.healthStatus,
            stripeCustomerId: input.company.stripeCustomerId ?? company.stripeCustomerId
          }
        });
      }

      const existingUser = await tx.user.findUnique({
        where: {
          email: input.user.email
        }
      });

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: input.user.name,
              appUserId: input.user.appUserId ?? existingUser.appUserId,
              companyId: company.id
            }
          })
        : await tx.user.create({
            data: {
              email: input.user.email,
              name: input.user.name,
              appUserId: input.user.appUserId,
              companyId: company.id
            }
          });

      return {
        userId: user.id,
        companyId: company.id,
        email: user.email,
        companyName: company.name
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}

function seenStateName(boardId: string | null): string {
  return `__sdk_changelog_seen__:${boardId ?? "all"}`;
}

async function resolveScopedBoardId(input: {
  boardToken?: string;
  boardId?: string;
}): Promise<string | null> {
  const boardToken = input.boardToken?.trim();
  const boardId = input.boardId?.trim();

  if (boardToken) {
    const verified = verifySdkToken(boardToken, env.PAINSOLVER_CLIENT_SECRET);
    if (!verified.valid || verified.payload.type !== "board" || !verified.payload.boardId) {
      throw new HttpError(401, "Invalid board token");
    }

    const board = await prisma.board.findUnique({
      where: { id: verified.payload.boardId }
    });

    if (!board) {
      throw new HttpError(404, "Board not found");
    }

    return board.id;
  }

  if (boardId) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      throw new HttpError(404, "Board not found");
    }

    if (board.isPrivate) {
      throw new HttpError(403, "Private boards require a board token");
    }

    return board.id;
  }

  return null;
}

function resolveIdentityFromSsoToken(ssoToken: string): NormalizedIdentifyInput {
  const verified = verifySdkToken(ssoToken, env.PAINSOLVER_CLIENT_SECRET);
  if (!verified.valid || verified.payload.type !== "sso" || !verified.payload.identify) {
    throw new HttpError(401, "Invalid SSO token");
  }

  return normalizeIdentifyInput(verified.payload.identify);
}

async function resolveSdkUserId(input: {
  userId?: string;
  ssoToken?: string;
}): Promise<string | undefined> {
  if (input.userId?.trim()) {
    return input.userId.trim();
  }

  if (input.ssoToken?.trim()) {
    const identity = resolveIdentityFromSsoToken(input.ssoToken.trim());
    const session = await upsertIdentity(identity);
    return session.userId;
  }

  return undefined;
}

async function readLastSeenAt(userId: string, boardId: string | null): Promise<Date | null> {
  const state = await prisma.savedFilter.findFirst({
    where: {
      userId,
      name: seenStateName(boardId)
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const lastSeenAt = (state?.criteria as { lastSeenAt?: string } | null)?.lastSeenAt;
  if (!lastSeenAt) {
    return null;
  }

  const parsed = new Date(lastSeenAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function writeLastSeenAt(userId: string, boardId: string | null, seenAt: Date): Promise<void> {
  const name = seenStateName(boardId);
  const existing = await prisma.savedFilter.findFirst({
    where: {
      userId,
      name
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (existing) {
    await prisma.savedFilter.update({
      where: {
        id: existing.id
      },
      data: {
        criteria: {
          lastSeenAt: seenAt.toISOString()
        }
      }
    });
    return;
  }

  await prisma.savedFilter.create({
    data: {
      userId,
      name,
      criteria: {
        lastSeenAt: seenAt.toISOString()
      }
    }
  });
}

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
    const normalized = normalizeIdentifyInput(parsed.data);
    const result = await upsertIdentity(normalized);

    res.status(200).json(result);
  } catch (error) {
    console.error("SDK identify failed", error);
    res.status(500).json({ error: "Failed to identify user" });
  }
});

sdkRoutes.post("/sso-token", requireApiKey, async (req, res) => {
  const parsed = sdkSsoTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid SSO token payload", details: parsed.error.flatten() });
    return;
  }

  const expiresInSeconds = parsed.data.expiresInSeconds ?? 60 * 60;
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const identify = normalizeIdentifyInput(parsed.data);
  const ssoToken = signSdkToken(
    {
      type: "sso",
      exp,
      identify
    },
    env.PAINSOLVER_CLIENT_SECRET
  );

  res.status(201).json({
    ssoToken,
    expiresAt: new Date(exp * 1000).toISOString()
  });
});

sdkRoutes.post("/sso/consume", async (req, res) => {
  const parsed = sdkConsumeSsoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid SSO consume payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const identity = resolveIdentityFromSsoToken(parsed.data.ssoToken);
    const result = await upsertIdentity(identity);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("SDK SSO consume failed", error);
    res.status(500).json({ error: "Failed to consume SSO token" });
  }
});

sdkRoutes.post("/board-token", requireApiKey, async (req, res) => {
  const parsed = sdkBoardTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid board token payload", details: parsed.error.flatten() });
    return;
  }

  const board = await prisma.board.findUnique({
    where: { id: parsed.data.boardId }
  });

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const expiresInSeconds = parsed.data.expiresInSeconds ?? 60 * 60 * 24 * 30;
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const boardToken = signSdkToken(
    {
      type: "board",
      exp,
      boardId: board.id
    },
    env.PAINSOLVER_CLIENT_SECRET
  );

  res.status(201).json({
    boardToken,
    boardId: board.id,
    expiresAt: new Date(exp * 1000).toISOString()
  });
});

sdkRoutes.get("/posts", async (req, res) => {
  const parsed = sdkPostsQuerySchema.safeParse({
    userId: queryValue(req.query.userId),
    boardId: queryValue(req.query.boardId),
    boardToken: queryValue(req.query.boardToken),
    ssoToken: queryValue(req.query.ssoToken)
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid posts query", details: parsed.error.flatten() });
    return;
  }

  try {
    const userId = await resolveSdkUserId({
      userId: parsed.data.userId,
      ssoToken: parsed.data.ssoToken
    });

    const boardId = await resolveScopedBoardId({
      boardId: parsed.data.boardId,
      boardToken: parsed.data.boardToken
    });

    const posts = await listPostsWithVotes(userId, boardId ?? undefined);

    res.status(200).json({ posts, boardId });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("SDK posts failed", error);
    res.status(500).json({ error: "Failed to list posts" });
  }
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
    const userId = await resolveSdkUserId({
      userId: parsed.data.userId,
      ssoToken: parsed.data.ssoToken
    });

    if (!userId) {
      res.status(400).json({ error: "Missing userId or ssoToken" });
      return;
    }

    const result = await createOrUpgradeVote(userId, parsed.data.postId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("SDK vote failed", error);
    res.status(500).json({ error: "Failed to create vote" });
  }
});

sdkRoutes.get("/changelog", async (req, res) => {
  const parsed = sdkChangelogQuerySchema.safeParse({
    q: queryValue(req.query.q),
    limit: queryValue(req.query.limit),
    boardId: queryValue(req.query.boardId),
    boardToken: queryValue(req.query.boardToken),
    ssoToken: queryValue(req.query.ssoToken),
    userId: queryValue(req.query.userId)
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid changelog query", details: parsed.error.flatten() });
    return;
  }

  try {
    const boardId = await resolveScopedBoardId({
      boardId: parsed.data.boardId,
      boardToken: parsed.data.boardToken
    });

    const search = parsed.data.q?.trim();
    const where: Prisma.ChangelogEntryWhereInput = {
      isPublished: true,
      ...(boardId ? { boardId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
              { tags: { has: search.toLowerCase() } }
            ]
          }
        : {})
    };

    const limit = parsed.data.limit ?? 20;

    const entries = await prisma.changelogEntry.findMany({
      where,
      include: {
        board: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit
    });

    res.status(200).json({
      entries: entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
        boardId: entry.boardId,
        boardName: entry.board?.name ?? null,
        releasedAt: (entry.publishedAt ?? entry.createdAt).toISOString()
      }))
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("SDK changelog list failed", error);
    res.status(500).json({ error: "Failed to list changelog" });
  }
});

sdkRoutes.get("/changelog/unseen", async (req, res) => {
  const parsed = sdkChangelogQuerySchema.safeParse({
    boardId: queryValue(req.query.boardId),
    boardToken: queryValue(req.query.boardToken),
    userId: queryValue(req.query.userId),
    ssoToken: queryValue(req.query.ssoToken)
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid unseen query", details: parsed.error.flatten() });
    return;
  }

  try {
    const userId = await resolveSdkUserId({
      userId: parsed.data.userId,
      ssoToken: parsed.data.ssoToken
    });

    const boardId = await resolveScopedBoardId({
      boardId: parsed.data.boardId,
      boardToken: parsed.data.boardToken
    });

    if (!userId) {
      res.status(200).json({
        hasUnseenEntries: false,
        unseenCount: 0,
        requiresIdentify: true,
        lastSeenAt: null,
        latestPublishedAt: null
      });
      return;
    }

    const latestEntry = await prisma.changelogEntry.findFirst({
      where: {
        isPublished: true,
        ...(boardId ? { boardId } : {})
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        publishedAt: true,
        createdAt: true
      }
    });

    const latestPublishedAt = latestEntry ? latestEntry.publishedAt ?? latestEntry.createdAt : null;
    if (!latestPublishedAt) {
      res.status(200).json({
        hasUnseenEntries: false,
        unseenCount: 0,
        requiresIdentify: false,
        lastSeenAt: null,
        latestPublishedAt: null
      });
      return;
    }

    const lastSeenAt = await readLastSeenAt(userId, boardId);

    const unseenCount = await prisma.changelogEntry.count({
      where: {
        isPublished: true,
        ...(boardId ? { boardId } : {}),
        ...(lastSeenAt
          ? {
              OR: [{ publishedAt: { gt: lastSeenAt } }, { publishedAt: null, createdAt: { gt: lastSeenAt } }]
            }
          : {})
      }
    });

    res.status(200).json({
      hasUnseenEntries: unseenCount > 0,
      unseenCount,
      requiresIdentify: false,
      lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
      latestPublishedAt: latestPublishedAt.toISOString()
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("SDK changelog unseen failed", error);
    res.status(500).json({ error: "Failed to compute unseen changelog state" });
  }
});

sdkRoutes.post("/changelog/seen", async (req, res) => {
  const parsed = sdkChangelogSeenSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid changelog seen payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const userId = await resolveSdkUserId({
      userId: parsed.data.userId,
      ssoToken: parsed.data.ssoToken
    });

    if (!userId) {
      res.status(400).json({ error: "Missing userId or ssoToken" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const boardId = await resolveScopedBoardId({
      boardId: parsed.data.boardId,
      boardToken: parsed.data.boardToken
    });

    const seenAt = parseSeenDate(parsed.data.seenAt);
    await writeLastSeenAt(user.id, boardId, seenAt);

    res.status(200).json({
      ok: true,
      lastSeenAt: seenAt.toISOString(),
      boardId
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("SDK changelog seen failed", error);
    res.status(500).json({ error: "Failed to mark changelog as seen" });
  }
});
