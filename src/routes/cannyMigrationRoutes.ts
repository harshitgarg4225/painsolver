/**
 * Canny → PainSolver Migration Endpoint
 * 
 * POST /api/v1/migrate/canny
 * Body: { cannyApiKey: string }
 * Auth: x-admin-key header with PAINSOLVER_ADMIN_KEY
 * 
 * Migrates: boards, categories, users, companies, posts (with status),
 *           votes, comments, and changelog entries.
 */

import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { getCompanyId } from "../middleware/tenantContext";

const router = Router();

// ─── Canny API helpers ───

const CANNY_BASE = "https://canny.io/api/v1";
const CANNY_V2 = "https://canny.io/api/v2";

async function cannyPost(apiKey: string, endpoint: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${CANNY_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, ...body }),
  });
  if (!res.ok) throw new Error(`Canny ${endpoint}: ${res.status}`);
  return res.json();
}

async function cannyV2Post(apiKey: string, endpoint: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${CANNY_V2}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, ...body }),
  });
  if (!res.ok) throw new Error(`Canny v2 ${endpoint}: ${res.status}`);
  return res.json();
}

/** Paginate Canny v1 endpoints (skip-based) */
async function cannyFetchAll(
  apiKey: string,
  endpoint: string,
  key: string,
  extra: Record<string, unknown> = {},
  limit = 100,
  maxPages = 100
) {
  const all: unknown[] = [];
  let skip = 0;
  let page = 0;
  let hasMore = true;
  while (hasMore && page < maxPages) {
    const res = await cannyPost(apiKey, endpoint, { limit, skip, ...extra });
    const items = (res as Record<string, unknown>)[key] as unknown[] || [];
    all.push(...items);
    hasMore = (res as { hasMore?: boolean }).hasMore === true && items.length === limit;
    skip += limit;
    page++;
  }
  return all;
}

/** Paginate Canny v2 endpoints (cursor-based) */
async function cannyFetchAllV2(
  apiKey: string,
  endpoint: string,
  key: string,
  extra: Record<string, unknown> = {},
  limit = 100,
  maxPages = 100
) {
  const all: unknown[] = [];
  let cursor: string | undefined;
  let page = 0;
  while (page < maxPages) {
    const body: Record<string, unknown> = { limit, ...extra };
    if (cursor) body.cursor = cursor;
    const res = await cannyV2Post(apiKey, endpoint, body) as Record<string, unknown>;
    const items = (res[key] as unknown[]) || (res.items as unknown[]) || [];
    all.push(...items);
    if (!res.hasNextPage && !res.hasMore) break;
    cursor = res.cursor as string | undefined;
    if (!cursor) break;
    page++;
  }
  return all;
}

// ─── Status mapping (Canny → PainSolver) ───

const STATUS_MAP: Record<string, string> = {
  "open": "under_review",
  "under review": "under_review",
  "planned": "planned",
  "in progress": "in_progress",
  "complete": "complete",
  "closed": "complete",
};

// ─── Helper to create slug from name ───

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "default";
}

// ─── Migration result interface ───

interface MigrationResult {
  success: boolean;
  boards: number;
  categories: number;
  users: number;
  companies: number;
  posts: number;
  votes: number;
  comments: number;
  changelog: number;
  errors: string[];
  durationMs: number;
}

// ─── Types for Canny data ───

interface CannyBoard {
  id: string;
  name: string;
  isPrivate?: boolean;
}

interface CannyCategory {
  id: string;
  name: string;
}

interface CannyCompany {
  id: string;
  name: string;
  monthlySpend?: number;
}

interface CannyUser {
  id: string;
  email: string;
  name?: string;
  userID?: string;
}

interface CannyPost {
  id: string;
  title: string;
  details?: string;
  status?: string;
  author?: { id: string };
  category?: { id: string };
  created?: string;
}

interface CannyVote {
  voter?: { id: string };
  created?: string;
}

interface CannyComment {
  author?: { id: string };
  value?: string;
  internal?: boolean;
  created?: string;
}

interface CannyChangelogEntry {
  title: string;
  markdownDetails?: string;
  plaintextDetails?: string;
  status?: string;
  publishedAt?: string;
  created?: string;
}

// ─── Migration endpoint ───

router.post("/migrate/canny", async (req: Request, res: Response) => {
  const start = Date.now();
  const { cannyApiKey } = req.body as { cannyApiKey?: string };

  // Validate API key
  if (!cannyApiKey) {
    res.status(400).json({ error: "cannyApiKey is required" });
    return;
  }

  // Auth check - require admin key
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (!adminKey || adminKey !== env.PAINSOLVER_ADMIN_KEY) {
    res.status(401).json({ error: "Invalid or missing admin key" });
    return;
  }

  // Get the company ID for multi-tenancy
  const companyId = getCompanyId(req);

  const errors: string[] = [];
  const map = {
    boards: {} as Record<string, string>,
    categories: {} as Record<string, string>,
    users: {} as Record<string, string>,
    posts: {} as Record<string, string>,
    defaultCategoryId: null as string | null,
  };
  const counts = { boards: 0, categories: 0, users: 0, companies: 0, posts: 0, votes: 0, comments: 0, changelog: 0 };

  try {
    // ─── 1. BOARDS ───
    console.log("[canny-migrate] Step 1: Boards");
    const cannyBoards = ((await cannyPost(cannyApiKey, "boards/list")).boards || []) as CannyBoard[];

    for (const b of cannyBoards) {
      try {
        const board = await prisma.board.upsert({
          where: {
            companyId_name: { companyId, name: b.name }
          },
          update: {
            isPrivate: b.isPrivate || false,
          },
          create: {
            companyId,
            name: b.name,
            slug: slugify(b.name),
            isPrivate: b.isPrivate || false,
          },
        });
        map.boards[b.id] = board.id;
        counts.boards++;
      } catch (e) {
        const error = e as Error;
        errors.push(`Board "${b.name}": ${error.message}`);
      }
    }

    // ─── 2. CATEGORIES ───
    console.log("[canny-migrate] Step 2: Categories");
    for (const b of cannyBoards) {
      const cats = await cannyFetchAll(cannyApiKey, "categories/list", "categories", { boardID: b.id }) as CannyCategory[];
      
      // Ensure we have a default category for this board
      const boardId = map.boards[b.id];
      if (boardId && !map.defaultCategoryId) {
        const defaultCat = await prisma.category.upsert({
          where: { boardId_name: { boardId, name: "General" } },
          update: {},
          create: { boardId, name: "General" },
        });
        map.defaultCategoryId = defaultCat.id;
      }

      for (const c of cats) {
        try {
          const cat = await prisma.category.upsert({
            where: {
              boardId_name: { name: c.name, boardId: map.boards[b.id] },
            },
            update: {},
            create: {
              name: c.name,
              boardId: map.boards[b.id],
            },
          });
          map.categories[c.id] = cat.id;
          counts.categories++;
        } catch (e) {
          const error = e as Error;
          errors.push(`Category "${c.name}": ${error.message}`);
        }
      }
    }

    // ─── 3. COMPANIES (End-user companies) ───
    console.log("[canny-migrate] Step 3: Companies");
    const cannyCompanies = await cannyFetchAllV2(cannyApiKey, "companies/list", "companies") as CannyCompany[];

    for (const co of cannyCompanies) {
      try {
        // Note: These are the end-user's companies, not tenant companies
        // We'll create them but they won't have boards/etc - just for MRR tracking
        await prisma.company.upsert({
          where: { cannyCompanyId: co.id },
          update: {
            name: co.name,
            monthlySpend: co.monthlySpend || 0,
          },
          create: {
            cannyCompanyId: co.id,
            name: co.name,
            slug: slugify(co.name) + "-" + Date.now().toString(36),
            monthlySpend: co.monthlySpend || 0,
          },
        });
        counts.companies++;
      } catch (e) {
        const error = e as Error;
        errors.push(`Company "${co.name}": ${error.message}`);
      }
    }

    // ─── 4. USERS ───
    console.log("[canny-migrate] Step 4: Users");
    const cannyUsers = await cannyFetchAllV2(cannyApiKey, "users/list", "users") as CannyUser[];

    for (const u of cannyUsers) {
      try {
        // Find or create user under the tenant company
        const user = await prisma.user.upsert({
          where: { 
            companyId_email: { companyId, email: u.email }
          },
          update: { 
            name: u.name || u.email,
            cannyUserId: u.id,
          },
          create: {
            companyId,
            email: u.email,
            name: u.name || u.email,
            cannyUserId: u.id,
            appUserId: u.userID || u.id,
          },
        });
        map.users[u.id] = user.id;
        counts.users++;
      } catch (e) {
        // Users may already exist — not a critical error
        const error = e as Error;
        console.log(`User "${u.email}" skipped: ${error.message}`);
      }
    }

    // ─── 5. POSTS ───
    console.log("[canny-migrate] Step 5: Posts");
    for (const b of cannyBoards) {
      const posts = await cannyFetchAll(cannyApiKey, "posts/list", "posts", { boardID: b.id }) as CannyPost[];
      const boardId = map.boards[b.id];

      // Get the default category for this board
      const defaultCategory = await prisma.category.findFirst({
        where: { boardId, name: "General" }
      });
      const defaultCategoryId = defaultCategory?.id || map.defaultCategoryId;

      for (const p of posts) {
        try {
          // Check if post already exists (by cannyId)
          const existing = await prisma.post.findUnique({
            where: { cannyId: p.id }
          });
          
          if (existing) {
            map.posts[p.id] = existing.id;
            continue; // Skip duplicate
          }

          const categoryId = p.category?.id ? map.categories[p.category.id] : defaultCategoryId;
          
          if (!categoryId) {
            errors.push(`Post "${p.title?.slice(0, 50)}": No category found`);
            continue;
          }

          const post = await prisma.post.create({
            data: {
              boardId,
              categoryId,
              cannyId: p.id,
              title: p.title,
              description: p.details || "",
              status: (STATUS_MAP[p.status?.toLowerCase() || "open"] || "under_review") as "under_review" | "upcoming" | "planned" | "in_progress" | "complete",
              createdAt: p.created ? new Date(p.created) : undefined,
            },
          });
          map.posts[p.id] = post.id;
          counts.posts++;
        } catch (e) {
          const error = e as Error;
          errors.push(`Post "${p.title?.slice(0, 50)}": ${error.message}`);
        }
      }
    }

    // ─── 6. VOTES ───
    console.log("[canny-migrate] Step 6: Votes");
    for (const [cannyPostId, psPostId] of Object.entries(map.posts)) {
      try {
        const votes = await cannyFetchAll(cannyApiKey, "votes/list", "votes", { postID: cannyPostId }) as CannyVote[];
        for (const v of votes) {
          try {
            const voterId = v.voter?.id ? map.users[v.voter.id] : undefined;
            if (!voterId) continue;

            await prisma.vote.upsert({
              where: {
                userId_postId: { postId: psPostId, userId: voterId },
              },
              update: {},
              create: {
                postId: psPostId,
                userId: voterId,
                voteType: "explicit",
                createdAt: v.created ? new Date(v.created) : undefined,
              },
            });
            counts.votes++;
          } catch {
            // Vote may already exist — skip
          }
        }
      } catch (e) {
        const error = e as Error;
        errors.push(`Votes for post ${cannyPostId}: ${error.message}`);
      }
    }

    // Update vote counts on posts
    for (const psPostId of Object.values(map.posts)) {
      const voteCount = await prisma.vote.count({
        where: { postId: psPostId, voteType: "explicit" }
      });
      await prisma.post.update({
        where: { id: psPostId },
        data: { explicitVoteCount: voteCount }
      });
    }

    // ─── 7. COMMENTS ───
    console.log("[canny-migrate] Step 7: Comments");
    for (const [cannyPostId, psPostId] of Object.entries(map.posts)) {
      try {
        const commentsRes = await cannyV2Post(cannyApiKey, "comments/list", {
          postID: cannyPostId,
          limit: 100,
        }) as { items?: CannyComment[] };
        const comments = commentsRes.items || [];

        for (const c of comments) {
          try {
            const authorId = c.author?.id ? map.users[c.author.id] : undefined;
            if (!authorId) continue; // Skip comments without valid author
            
            await prisma.comment.create({
              data: {
                postId: psPostId,
                value: c.value || "",
                authorId,
                isPrivate: c.internal || false,
                createdAt: c.created ? new Date(c.created) : undefined,
              },
            });
            counts.comments++;
          } catch {
            // Skip duplicate comments
          }
        }
      } catch (e) {
        const error = e as Error;
        errors.push(`Comments for post ${cannyPostId}: ${error.message}`);
      }
    }

    // ─── 8. CHANGELOG ───
    console.log("[canny-migrate] Step 8: Changelog");
    const entries = await cannyFetchAll(cannyApiKey, "entries/list", "entries") as CannyChangelogEntry[];

    // Get the first board for changelog entries
    const firstBoardId = Object.values(map.boards)[0];

    for (const e of entries) {
      try {
        await prisma.changelogEntry.create({
          data: {
            boardId: firstBoardId,
            title: e.title,
            content: e.markdownDetails || e.plaintextDetails || "",
            isPublished: e.status === "published",
            publishedAt: e.publishedAt ? new Date(e.publishedAt) : undefined,
            createdAt: e.created ? new Date(e.created) : undefined,
          },
        });
        counts.changelog++;
      } catch (err) {
        const error = err as Error;
        errors.push(`Changelog "${e.title?.slice(0, 50)}": ${error.message}`);
      }
    }

    console.log("[canny-migrate] Migration complete", counts);

    res.json({
      success: true,
      ...counts,
      errors: errors.slice(0, 50), // Cap error list
      durationMs: Date.now() - start,
    } satisfies MigrationResult);
  } catch (err) {
    const error = err as Error;
    console.error("[canny-migrate] Fatal error:", error);
    res.status(500).json({
      success: false,
      ...counts,
      errors: [...errors, error.message],
      durationMs: Date.now() - start,
    });
  }
});

export default router;

