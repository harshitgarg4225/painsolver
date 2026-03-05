import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";
import { requireTenantContext, getCompanyId } from "../middleware/tenantContext";
import {
  addCommentAsActor,
  bulkUpdatePosts,
  companySummary,
  createBoardForCompany,
  createIdeaFromPainEvent,
  createChangelogEntry,
  createPostAsActor,
  createSavedFilterForActor,
  deleteSavedFilterForActor,
  exportCommentRows,
  exportPostsRows,
  getCompanyChangelogEntry,
  getPostForActor,
  getPostVoterInsights,
  listAccessRequests,
  listBoardsForActor,
  listBoardSettingsForCompany,
  listCompanyChangelog,
  listCompanyMembers,
  listFeedbackForCompany,
  listAiInboxConfig,
  listCustomerRelationships,
  listMergedSources,
  listOpportunities,
  listPainEventsForTriage,
  listRoadmapForCompany,
  listSavedFiltersForActor,
  mergePainEventIntoPost,
  mergePosts,
  unmergePost,
  updateAiInboxConfig,
  updateAccessRequestStatus,
  updateBoardSettingsForCompany,
  updatePostForCompany,
  WorkspaceFilterMode,
  WorkspacePostStatus,
  WorkspaceSortMode
} from "../services/workspaceDataService";

const feedbackQuerySchema = z.object({
  boardId: z.string().optional(),
  sort: z.enum(["trending", "top", "new"]).optional(),
  filter: z.enum(["all", "under_review", "upcoming", "planned", "in_progress", "complete"]).optional(),
  q: z.string().optional(),
  includeMerged: z.string().optional()
});

const createPostSchema = z.object({
  boardId: z.string().min(1),
  title: z.string().min(1),
  details: z.string().min(1)
});

const updatePostSchema = z.object({
  status: z.enum(["under_review", "upcoming", "planned", "in_progress", "complete"]).optional(),
  ownerName: z.string().min(1).optional(),
  eta: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
});

const mergeTriageSchema = z.object({
  postId: z.string().min(1)
});

const createIdeaFromTriageSchema = z.object({
  boardId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  details: z.string().min(1).optional()
});

const updateTriageConfigSchema = z.object({
  source: z.enum(["freshdesk", "zoom"]),
  routingMode: z.enum(["central", "individual"]),
  enabled: z.boolean()
});

const createChangelogSchema = z.object({
  entryId: z.string().optional(),
  boardId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional()
});

const roadmapQuerySchema = z.object({
  boardId: z.string().optional(),
  q: z.string().optional()
});

const createBoardSchema = z.object({
  name: z.string().min(1),
  visibility: z.enum(["public", "private", "custom"]).optional(),
  allowedSegments: z.array(z.string()).optional()
});

const customersQuerySchema = z.object({
  q: z.string().optional(),
  boardId: z.string().optional(),
  minMrr: z.string().optional()
});

const changelogQuerySchema = z.object({
  q: z.string().optional(),
  boardId: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(["all", "published", "draft"]).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

const triageQuerySchema = z.object({
  status: z.enum(["needs_triage", "auto_merged", "all"]).optional(),
  source: z.enum(["freshdesk", "zoom", "all"]).optional(),
  q: z.string().optional(),
  minMrr: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

const updateBoardSettingsSchema = z.object({
  visibility: z.enum(["public", "private", "custom"]),
  allowedSegments: z.array(z.string()).optional()
});

const updateRequestSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"])
});

const bulkUpdateSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["under_review", "upcoming", "planned", "in_progress", "complete"]).optional(),
  ownerName: z.string().min(1).optional(),
  eta: z.string().nullable().optional(),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional()
});

const mergePostsSchema = z.object({
  sourcePostId: z.string().min(1),
  targetPostId: z.string().min(1)
});

const unmergePostSchema = z.object({
  sourcePostId: z.string().min(1)
});

const savedFilterSchema = z.object({
  name: z.string().min(1),
  criteria: z.record(z.unknown())
});

const createCommentSchema = z.object({
  postId: z.string().min(1),
  body: z.string().min(1),
  replyToCommentId: z.string().min(1).optional()
});

const uploadMediaSchema = z.object({
  fileName: z.string().min(1).max(180),
  fileType: z.string().min(1).max(120),
  fileData: z.string().min(1),
  kind: z.enum(["image", "video"])
});

const imageMimeExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg"
};

const videoMimeExtensions: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov"
};

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }

  return raw;
}

function sanitizedBaseName(fileName: string): string {
  return path
    .parse(fileName)
    .name
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function base64Payload(value: string): string {
  const match = value.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : value;
}

function encodedStoragePath(pathValue: string): string {
  return pathValue
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function uploadToSupabaseStorage(params: {
  fileName: string;
  fileType: string;
  buffer: Buffer;
}): Promise<string> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  const objectPath = encodedStoragePath(`changelog/${params.fileName}`);
  const bucket = encodeURIComponent(env.SUPABASE_STORAGE_BUCKET);
  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const publicUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": params.fileType,
      "x-upsert": "true"
    },
    body: new Uint8Array(params.buffer)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SUPABASE_UPLOAD_FAILED:${response.status}:${details}`);
  }

  return publicUrl;
}

export const companyRoutes = Router();

companyRoutes.get("/session", (req, res) => {
  res.status(200).json({
    actor: {
      ...(req.actor ?? {
        role: "anonymous",
        isAuthenticated: false,
        accessLevel: "read"
      }),
      // Include tenant context if available
      companyId: req.tenant?.companyId ?? null,
      companySlug: req.tenant?.companySlug ?? null,
      companyName: req.tenant?.companyName ?? null
    }
  });
});

companyRoutes.use(requireCompanyWriteAccess);
companyRoutes.use(requireTenantContext);

companyRoutes.post("/media/upload", async (req, res) => {
  const parsed = uploadMediaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid media upload payload", details: parsed.error.flatten() });
    return;
  }

  const extensionMap = parsed.data.kind === "image" ? imageMimeExtensions : videoMimeExtensions;
  const extension = extensionMap[parsed.data.fileType];
  if (!extension) {
    res.status(400).json({ error: "Unsupported media type" });
    return;
  }

  const rawPayload = base64Payload(parsed.data.fileData);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(rawPayload, "base64");
  } catch (_error) {
    res.status(400).json({ error: "Invalid media payload encoding" });
    return;
  }

  if (!buffer.length) {
    res.status(400).json({ error: "Media payload is empty" });
    return;
  }

  const maxBytes = parsed.data.kind === "image" ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(413).json({ error: "Media file too large" });
    return;
  }

  const base = sanitizedBaseName(parsed.data.fileName) || parsed.data.kind;
  const finalName = `${Date.now()}-${randomUUID()}-${base}${extension}`;
  const runOnVercel = Boolean(process.env.VERCEL);

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const url = await uploadToSupabaseStorage({
        fileName: finalName,
        fileType: parsed.data.fileType,
        buffer
      });

      res.status(201).json({
        url,
        kind: parsed.data.kind,
        mimeType: parsed.data.fileType,
        size: buffer.length
      });
      return;
    } catch (error) {
      console.error("Supabase storage upload failed", error);
      res.status(502).json({ error: "Failed to upload media to Supabase Storage" });
      return;
    }
  }

  if (runOnVercel) {
    res.status(503).json({
      error:
        "Media uploads on Vercel require Supabase Storage. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    });
    return;
  }

  const folder = path.resolve(process.cwd(), "src/public/uploads/changelog");
  await fs.mkdir(folder, { recursive: true });
  const targetPath = path.join(folder, finalName);
  await fs.writeFile(targetPath, buffer);

  res.status(201).json({
    url: `/uploads/changelog/${finalName}`,
    kind: parsed.data.kind,
    mimeType: parsed.data.fileType,
    size: buffer.length
  });
});

companyRoutes.get("/summary", async (req, res) => {
  const metrics = await companySummary(getCompanyId(req));
  res.status(200).json({ metrics });
});

companyRoutes.get("/boards", async (req, res) => {
  const boards = await listBoardsForActor(req.actor, getCompanyId(req));
  res.status(200).json({ boards });
});

companyRoutes.post("/boards", async (req, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid board payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const board = await createBoardForCompany({
      companyId: getCompanyId(req),
      name: parsed.data.name,
      visibility: parsed.data.visibility ?? "public",
      allowedSegments: parsed.data.allowedSegments
    });

    res.status(201).json({ board });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "Board name already exists" });
      return;
    }

    throw error;
  }
});

companyRoutes.get("/board-settings", async (req, res) => {
  const boards = await listBoardSettingsForCompany(getCompanyId(req));
  res.status(200).json({ boards });
});

companyRoutes.patch("/board-settings/:boardId", async (req, res) => {
  const parsed = updateBoardSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid board settings payload", details: parsed.error.flatten() });
    return;
  }

  const board = await updateBoardSettingsForCompany({
    boardId: req.params.boardId,
    visibility: parsed.data.visibility,
    allowedSegments: parsed.data.allowedSegments
  });

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  res.status(200).json({ board });
});

companyRoutes.get("/members", async (req, res) => {
  const members = await listCompanyMembers(getCompanyId(req));
  res.status(200).json({ members });
});

companyRoutes.get("/feedback", async (req, res) => {
  const parsed = feedbackQuerySchema.safeParse({
    boardId: req.query.boardId,
    sort: req.query.sort,
    filter: req.query.filter,
    q: req.query.q,
    includeMerged: req.query.includeMerged
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback query", details: parsed.error.flatten() });
    return;
  }

  let boardId = parsed.data.boardId;
  if (!boardId) {
    const firstBoard = await prisma.board.findFirst({
      orderBy: { createdAt: "asc" }
    });
    boardId = firstBoard?.id;
  }

  if (!boardId) {
    res.status(200).json({ posts: [] });
    return;
  }

  const posts = await listFeedbackForCompany({
    boardId,
    sort: (parsed.data.sort ?? "trending") as WorkspaceSortMode,
    filter: (parsed.data.filter ?? "all") as WorkspaceFilterMode,
    search: parsed.data.q ?? "",
    includeMerged: parsed.data.includeMerged === "true"
  });

  res.status(200).json({ posts });
});

companyRoutes.get("/roadmap", async (req, res) => {
  const parsed = roadmapQuerySchema.safeParse({
    boardId: req.query.boardId,
    q: req.query.q
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid roadmap query", details: parsed.error.flatten() });
    return;
  }

  const boardId = parsed.data.boardId && parsed.data.boardId !== "all" ? parsed.data.boardId : undefined;
  const result = await listRoadmapForCompany({
    boardId,
    search: parsed.data.q ?? ""
  });

  res.status(200).json(result);
});

companyRoutes.get("/customers", async (req, res) => {
  const parsed = customersQuerySchema.safeParse({
    q: req.query.q,
    boardId: req.query.boardId,
    minMrr: req.query.minMrr
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid customers query", details: parsed.error.flatten() });
    return;
  }

  const result = await listCustomerRelationships({
    search: parsed.data.q ?? "",
    boardId: parsed.data.boardId && parsed.data.boardId !== "all" ? parsed.data.boardId : "",
    minMrr: parsed.data.minMrr ? Number(parsed.data.minMrr) : 0
  });

  res.status(200).json(result);
});

companyRoutes.get("/posts/:postId", async (req, res) => {
  const result = await getPostForActor({
    postId: req.params.postId,
    actor: req.actor,
    includePrivateComments: true
  });

  if (!result.post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(200).json({ post: result.post });
});

companyRoutes.get("/posts/:postId/voter-insights", async (req, res) => {
  const insights = await getPostVoterInsights(req.params.postId);
  if (!insights) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(200).json({ insights });
});

companyRoutes.post("/posts", async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid post payload", details: parsed.error.flatten() });
    return;
  }

  const result = await createPostAsActor({
    boardId: parsed.data.boardId,
    title: parsed.data.title,
    details: parsed.data.details,
    actor: req.actor
  });

  if (!result.post) {
    res.status(400).json({ error: "Could not create post" });
    return;
  }

  res.status(201).json({ post: result.post });
});

companyRoutes.patch("/posts/:postId", async (req, res) => {
  const parsed = updatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update payload", details: parsed.error.flatten() });
    return;
  }

  const post = await updatePostForCompany({
    postId: req.params.postId,
    actor: req.actor,
    status: parsed.data.status as WorkspacePostStatus | undefined,
    ownerName: parsed.data.ownerName,
    eta: parsed.data.eta,
    tags: parsed.data.tags
  });

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(200).json({ post });
});

companyRoutes.get("/posts/:postId/merged-sources", async (req, res) => {
  const sources = await listMergedSources(req.params.postId);
  res.status(200).json({ sources });
});

companyRoutes.post("/posts/bulk-update", async (req, res) => {
  const parsed = bulkUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid bulk payload", details: parsed.error.flatten() });
    return;
  }

  const posts = await bulkUpdatePosts({
    postIds: parsed.data.postIds,
    status: parsed.data.status as WorkspacePostStatus | undefined,
    ownerName: parsed.data.ownerName,
    eta: parsed.data.eta,
    addTags: parsed.data.addTags,
    removeTags: parsed.data.removeTags
  });

  res.status(200).json({ updatedCount: posts.length, posts });
});

companyRoutes.post("/posts/merge", async (req, res) => {
  const parsed = mergePostsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid merge payload", details: parsed.error.flatten() });
    return;
  }

  const merged = await mergePosts({
    sourcePostId: parsed.data.sourcePostId,
    targetPostId: parsed.data.targetPostId
  });

  if (!merged) {
    res.status(400).json({ error: "Merge failed. Verify board, source, and target." });
    return;
  }

  res.status(200).json(merged);
});

companyRoutes.post("/posts/unmerge", async (req, res) => {
  const parsed = unmergePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid unmerge payload", details: parsed.error.flatten() });
    return;
  }

  const result = await unmergePost(parsed.data.sourcePostId);
  if (!result) {
    res.status(400).json({ error: "Unmerge failed" });
    return;
  }

  res.status(200).json(result);
});

companyRoutes.post("/comments", async (req, res) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid comment payload", details: parsed.error.flatten() });
    return;
  }

  const result = await addCommentAsActor({
    postId: parsed.data.postId,
    body: parsed.data.body,
    replyToCommentId: parsed.data.replyToCommentId,
    actor: req.actor,
    isPrivate: true
  });

  if (!result.comment) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(201).json({ comment: result.comment });
});

companyRoutes.get("/triage", async (req, res) => {
  const parsed = triageQuerySchema.safeParse({
    status: req.query.status,
    source: req.query.source,
    q: req.query.q,
    minMrr: req.query.minMrr,
    page: req.query.page,
    pageSize: req.query.pageSize
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid triage query", details: parsed.error.flatten() });
    return;
  }

  const result = await listPainEventsForTriage({
    status: parsed.data.status ?? "needs_triage",
    source: parsed.data.source ?? "all",
    search: parsed.data.q ?? "",
    minMrr: parsed.data.minMrr ? Number(parsed.data.minMrr) : 0,
    page: parsed.data.page ? Number(parsed.data.page) : 1,
    pageSize: parsed.data.pageSize ? Number(parsed.data.pageSize) : 50,
    actor: req.actor
  });
  res.status(200).json({
    painEvents: result.events,
    summary: result.summary,
    config: result.config
  });
});

companyRoutes.post("/triage/:painEventId/merge", async (req, res) => {
  const parsed = mergeTriageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid merge payload", details: parsed.error.flatten() });
    return;
  }

  const ok = await mergePainEventIntoPost({
    painEventId: req.params.painEventId,
    postId: parsed.data.postId
  });

  if (!ok) {
    res.status(404).json({ error: "Pain event or post not found" });
    return;
  }

  res.status(200).json({ ok: true });
});

companyRoutes.get("/triage/config", async (_req, res) => {
  const config = await listAiInboxConfig();
  res.status(200).json(config);
});

companyRoutes.patch("/triage/config", async (req, res) => {
  const parsed = updateTriageConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid triage config payload", details: parsed.error.flatten() });
    return;
  }

  const sourceConfig = await updateAiInboxConfig(parsed.data);
  res.status(200).json({ source: sourceConfig });
});

companyRoutes.post("/triage/:painEventId/create-idea", async (req, res) => {
  const parsed = createIdeaFromTriageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid create idea payload", details: parsed.error.flatten() });
    return;
  }

  const result = await createIdeaFromPainEvent({
    painEventId: req.params.painEventId,
    boardId: parsed.data.boardId,
    title: parsed.data.title,
    details: parsed.data.details
  });

  if (!result) {
    res.status(404).json({ error: "Pain event or board not found" });
    return;
  }

  res.status(201).json({
    post: result
  });
});

companyRoutes.get("/changelog", async (req, res) => {
  const parsed = changelogQuerySchema.safeParse({
    q: req.query.q,
    boardId: req.query.boardId,
    tag: req.query.tag,
    status: req.query.status,
    page: req.query.page,
    pageSize: req.query.pageSize
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid changelog query", details: parsed.error.flatten() });
    return;
  }

  const result = await listCompanyChangelog({
    search: parsed.data.q ?? "",
    boardId: parsed.data.boardId && parsed.data.boardId !== "all" ? parsed.data.boardId : undefined,
    tag: parsed.data.tag ?? "",
    status: parsed.data.status ?? "all",
    page: parsed.data.page ? Number(parsed.data.page) : 1,
    pageSize: parsed.data.pageSize ? Number(parsed.data.pageSize) : 20
  });

  res.status(200).json(result);
});

companyRoutes.get("/changelog/:entryId", async (req, res) => {
  const entry = await getCompanyChangelogEntry(req.params.entryId);
  if (!entry) {
    res.status(404).json({ error: "Changelog entry not found" });
    return;
  }

  res.status(200).json({ entry });
});

companyRoutes.post("/changelog", async (req, res) => {
  const parsed = createChangelogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid changelog payload", details: parsed.error.flatten() });
    return;
  }

  const entry = await createChangelogEntry({
    entryId: parsed.data.entryId,
    boardId: parsed.data.boardId,
    title: parsed.data.title,
    content: parsed.data.content,
    tags: parsed.data.tags,
    isPublished: parsed.data.isPublished
  });
  res.status(parsed.data.entryId ? 200 : 201).json({ entry });
});

companyRoutes.get("/saved-filters", async (req, res) => {
  const filters = await listSavedFiltersForActor(req.actor);
  res.status(200).json({ filters });
});

companyRoutes.post("/saved-filters", async (req, res) => {
  const parsed = savedFilterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid saved filter payload", details: parsed.error.flatten() });
    return;
  }

  const filter = await createSavedFilterForActor({
    actor: req.actor,
    name: parsed.data.name,
    criteria: parsed.data.criteria
  });

  if (!filter) {
    res.status(400).json({ error: "Could not create saved filter" });
    return;
  }

  res.status(201).json({ filter });
});

companyRoutes.delete("/saved-filters/:savedFilterId", async (req, res) => {
  const removed = await deleteSavedFilterForActor({
    actor: req.actor,
    savedFilterId: req.params.savedFilterId
  });

  if (!removed) {
    res.status(404).json({ error: "Saved filter not found" });
    return;
  }

  res.status(200).json({ ok: true });
});

companyRoutes.get("/opportunities", async (req, res) => {
  const boardId = typeof req.query.boardId === "string" ? req.query.boardId : undefined;
  const opportunities = await listOpportunities(boardId);
  res.status(200).json({ opportunities });
});

companyRoutes.get("/export/posts.csv", async (_req, res) => {
  const rows = [["postId", "boardId", "title", "status", "owner", "eta", "voteCount", "commentCount", "attachedMrr"]];
  const dataRows = await exportPostsRows();
  dataRows.forEach((row) => rows.push(row as unknown as string[]));
  const csv = rows.map((line) => line.map((cell) => csvCell(cell)).join(",")).join("\n");
  res.status(200).type("text/csv").send(csv);
});

companyRoutes.get("/export/comments.csv", async (_req, res) => {
  const rows = [["commentId", "postId", "postTitle", "author", "replyToAuthor", "createdAt", "body"]];
  const dataRows = await exportCommentRows();
  dataRows.forEach((row) => rows.push(row as unknown as string[]));
  const csv = rows.map((line) => line.map((cell) => csvCell(cell)).join(",")).join("\n");
  res.status(200).type("text/csv").send(csv);
});

companyRoutes.get("/access-requests", async (_req, res) => {
  const requests = await listAccessRequests();
  res.status(200).json({ requests });
});

companyRoutes.patch("/access-requests/:requestId", async (req, res) => {
  const parsed = updateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update payload", details: parsed.error.flatten() });
    return;
  }

  const request = await updateAccessRequestStatus({
    requestId: req.params.requestId,
    status: parsed.data.status
  });

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.status(200).json({ request });
});
