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
  sort: z.enum(["trending", "top", "new", "mrr", "status_changed"]).optional(),
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
  tags: z.array(z.string()).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional()
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
  source: z.enum(["freshdesk", "zoom", "slack"]),
  routingMode: z.enum(["central", "individual"]),
  triageMode: z.enum(["auto", "manual"]).optional(),
  spamDetectionEnabled: z.boolean().optional(),
  enabled: z.boolean(),
  similarityThreshold: z.number().min(0.5).max(0.99).optional()
});

const createChangelogSchema = z.object({
  entryId: z.string().optional(),
  boardId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  type: z.enum(["new", "improved", "fixed", "update"]).optional(),
  labels: z.array(z.string()).optional(),
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

  // Handle title/description update separately if provided
  if (parsed.data.title !== undefined || parsed.data.description !== undefined) {
    await prisma.post.update({
      where: { id: req.params.postId },
      data: {
        ...(parsed.data.title ? { title: parsed.data.title.trim() } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      },
    });
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

companyRoutes.post("/triage/:painEventId/dismiss", async (req, res) => {
  const { painEventId } = req.params;
  
  const painEvent = await prisma.painEvent.findUnique({
    where: { id: painEventId }
  });

  if (!painEvent) {
    res.status(404).json({ error: "Pain event not found" });
    return;
  }

  await prisma.painEvent.update({
    where: { id: painEventId },
    data: { status: "dismissed" }
  });

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
    type: parsed.data.type,
    labels: parsed.data.labels,
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

// ── Voter Priority & Link ──
const updateVoterPrioritySchema = z.object({
  priority: z.enum(["none", "low", "medium", "high", "critical"]),
});
const updateVoterLinkSchema = z.object({
  link: z.string().optional(),
});

companyRoutes.patch("/votes/:voteId/priority", async (req, res) => {
  const parsed = updateVoterPrioritySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid priority", details: parsed.error.flatten() });
    return;
  }
  try {
    const vote = await prisma.vote.update({
      where: { id: req.params.voteId },
      data: { priority: parsed.data.priority },
    });
    res.status(200).json({ vote: { id: vote.id, priority: vote.priority } });
  } catch {
    res.status(404).json({ error: "Vote not found" });
  }
});

companyRoutes.patch("/votes/:voteId/link", async (req, res) => {
  const parsed = updateVoterLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid link", details: parsed.error.flatten() });
    return;
  }
  try {
    const vote = await prisma.vote.update({
      where: { id: req.params.voteId },
      data: { link: parsed.data.link ?? null },
    });
    res.status(200).json({ vote: { id: vote.id, link: vote.link } });
  } catch {
    res.status(404).json({ error: "Vote not found" });
  }
});

// ── AI Smart Reply ──
companyRoutes.post("/posts/:postId/smart-reply", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      include: {
        comments: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { author: { select: { name: true, role: true } } },
        },
        votes: { select: { id: true } },
        category: { select: { name: true } },
        board: { select: { name: true } },
      },
    });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const { extractIntentFromTicket } = await import("../services/openaiService");
    const commentThread = post.comments.map(
      (c: any) => `[${c.author?.name || "User"} (${c.author?.role || "customer"})]: ${c.value}`
    ).join("\n");

    const prompt = `You are a Product Manager responding to customer feedback.

Post Title: ${post.title}
Post Description: ${post.description}
Status: ${post.status}
Category: ${post.category?.name || "General"}
Board: ${post.board?.name || "Default"}
Votes: ${post.votes.length}

Recent comments:
${commentThread || "(no comments yet)"}

Generate 3 different professional, empathetic responses the PM could send. Each should:
1. Acknowledge the feedback
2. Reference the current status naturally
3. Be concise (2-3 sentences max)
4. End with a forward-looking statement

Return as JSON: { "replies": [{ "tone": "empathetic|informative|action-oriented", "text": "..." }] }`;

    const result = await extractIntentFromTicket(prompt);
    let replies = [];
    try {
      const parsed = JSON.parse(result.intent || "{}");
      replies = parsed.replies || [];
    } catch {
      replies = [{ tone: "empathetic", text: result.intent || "Thank you for your feedback. We are reviewing this carefully." }];
    }
    res.status(200).json({ replies });
  } catch (err: any) {
    console.error("[smart-reply]", err);
    res.status(500).json({ error: "Failed to generate smart replies" });
  }
});

// ── AI Comment Summary ──
companyRoutes.post("/posts/:postId/comment-summary", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      include: {
        comments: {
          orderBy: { createdAt: "asc" },
          take: 50,
          include: { author: { select: { name: true, role: true } } },
        },
        category: { select: { name: true } },
      },
    });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (!post.comments.length) {
      res.status(200).json({ summary: "No comments to summarize yet." });
      return;
    }

    const { extractIntentFromTicket } = await import("../services/openaiService");
    const commentThread = post.comments.map(
      (c: any) => `[${c.author?.name || "User"} (${c.author?.role || "customer"})]: ${c.value}`
    ).join("\n");

    const prompt = `Summarize the following discussion thread about a product feedback post.

Post: "${post.title}"
Category: ${post.category?.name || "General"}
Status: ${post.status}

Comments (${post.comments.length} total):
${commentThread}

Provide a structured summary in JSON:
{
  "tldr": "One sentence TL;DR",
  "keyPoints": ["Point 1", "Point 2", ...],
  "sentiment": "positive|mixed|negative",
  "actionItems": ["Action 1", ...],
  "topRequests": ["Request 1", ...]
}`;

    const result = await extractIntentFromTicket(prompt);
    let summary: any = {};
    try {
      summary = JSON.parse(result.intent || "{}");
    } catch {
      summary = { tldr: result.intent || "Could not generate summary.", keyPoints: [], sentiment: "mixed", actionItems: [], topRequests: [] };
    }

    // Cache the summary
    await prisma.post.update({
      where: { id: req.params.postId },
      data: { commentSummary: JSON.stringify(summary), commentSummaryAt: new Date() },
    });

    res.status(200).json({ summary });
  } catch (err: any) {
    console.error("[comment-summary]", err);
    res.status(500).json({ error: "Failed to generate comment summary" });
  }
});

// ── Get cached comment summary ──
companyRoutes.get("/posts/:postId/comment-summary", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      select: { commentSummary: true, commentSummaryAt: true },
    });
    if (!post || !post.commentSummary) {
      res.status(200).json({ summary: null });
      return;
    }
    try {
      res.status(200).json({ summary: JSON.parse(post.commentSummary), generatedAt: post.commentSummaryAt });
    } catch {
      res.status(200).json({ summary: { tldr: post.commentSummary }, generatedAt: post.commentSummaryAt });
    }
  } catch {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// ═══════════════════════════════════════════════
// P1: AI Knowledge Hub - analytics + history
// ═══════════════════════════════════════════════
companyRoutes.get("/ai/knowledge-hub", async (_req, res) => {
  try {
    const [totalEvents, statusCounts, sourceCounts, recentActions, avgConfidence] = await Promise.all([
      prisma.painEvent.count(),
      prisma.painEvent.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.painEvent.groupBy({
        by: ["source"],
        _count: { id: true },
      }),
      prisma.aiActionLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          painEvent: {
            select: {
              id: true,
              rawText: true,
              source: true,
              status: true,
              matchedPostId: true,
              matchedPost: { select: { id: true, title: true } },
              createdAt: true,
            },
          },
        },
      }),
      prisma.aiActionLog.aggregate({ _avg: { confidenceScore: true } }),
    ]);

    // Weekly trend: count events by week for last 12 weeks
    const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
    const weeklyEvents = await prisma.painEvent.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true, status: true, source: true },
      orderBy: { createdAt: "asc" },
    });

    const weekBuckets: Record<string, { total: number; auto_merged: number; needs_triage: number; spam: number; skipped: number }> = {};
    weeklyEvents.forEach((e) => {
      const weekStart = new Date(e.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!weekBuckets[key]) weekBuckets[key] = { total: 0, auto_merged: 0, needs_triage: 0, spam: 0, skipped: 0 };
      weekBuckets[key].total++;
      if (e.status === "auto_merged") weekBuckets[key].auto_merged++;
      else if (e.status === "needs_triage") weekBuckets[key].needs_triage++;
      else if (e.status === "spam") weekBuckets[key].spam++;
      else if (e.status === "skipped") weekBuckets[key].skipped++;
    });

    const weeklyTrend = Object.entries(weekBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, counts]) => ({ week, ...counts }));

    // Category distribution from AI metadata
    const recentWithMeta = await prisma.aiActionLog.findMany({
      where: { metadata: { not: Prisma.DbNull } },
      select: { metadata: true },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const categoryMap: Record<string, number> = {};
    const sentimentMap: Record<string, number> = {};
    const urgencyMap: Record<string, number> = {};
    recentWithMeta.forEach((log) => {
      const meta = log.metadata as any;
      if (meta?.category) categoryMap[meta.category] = (categoryMap[meta.category] || 0) + 1;
      if (meta?.sentiment) sentimentMap[meta.sentiment] = (sentimentMap[meta.sentiment] || 0) + 1;
      if (meta?.urgency) urgencyMap[meta.urgency] = (urgencyMap[meta.urgency] || 0) + 1;
    });

    res.status(200).json({
      totalEvents,
      avgConfidence: avgConfidence._avg.confidenceScore ?? 0,
      statusBreakdown: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
      sourceBreakdown: Object.fromEntries(sourceCounts.map((s) => [s.source, s._count.id])),
      categoryDistribution: categoryMap,
      sentimentDistribution: sentimentMap,
      urgencyDistribution: urgencyMap,
      weeklyTrend,
      recentActions: recentActions.map((a) => ({
        id: a.id,
        action: a.actionTaken,
        confidence: a.confidenceScore,
        status: a.status,
        metadata: a.metadata,
        painEvent: a.painEvent ? {
          id: a.painEvent.id,
          rawText: a.painEvent.rawText.slice(0, 200),
          source: a.painEvent.source,
          status: a.painEvent.status,
          matchedPostTitle: a.painEvent.matchedPost?.title ?? null,
          createdAt: a.painEvent.createdAt.toISOString(),
        } : null,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error("[knowledge-hub]", err);
    res.status(500).json({ error: "Failed to load AI Knowledge Hub data" });
  }
});

// ═══════════════════════════════════════════════
// P1: Spam detection mark/unmark
// ═══════════════════════════════════════════════
companyRoutes.post("/triage/:painEventId/spam", async (req, res) => {
  try {
    await prisma.painEvent.update({
      where: { id: req.params.painEventId },
      data: { status: "spam" },
    });
    res.status(200).json({ ok: true });
  } catch {
    res.status(404).json({ error: "Pain event not found" });
  }
});

companyRoutes.post("/triage/:painEventId/unspam", async (req, res) => {
  try {
    await prisma.painEvent.update({
      where: { id: req.params.painEventId },
      data: { status: "needs_triage" },
    });
    res.status(200).json({ ok: true });
  } catch {
    res.status(404).json({ error: "Pain event not found" });
  }
});

// ═══════════════════════════════════════════════
// P1: ClickUp Integration
// ═══════════════════════════════════════════════
const clickUpConnectSchema = z.object({
  accessToken: z.string().min(1),
});

companyRoutes.post("/integrations/clickup/connect", async (req, res) => {
  const parsed = clickUpConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Access token required" });
    return;
  }

  const companyId = (req as any).companyId || "";
  try {
    // Verify token by fetching teams
    const teamsRes = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: parsed.data.accessToken },
    });
    if (!teamsRes.ok) {
      res.status(401).json({ error: "Invalid ClickUp access token" });
      return;
    }
    const teamsData = await teamsRes.json() as any;
    const team = teamsData.teams?.[0];

    // Fetch spaces for first team
    let spaceIds: string[] = [];
    let spaceNames: string[] = [];
    if (team) {
      const spacesRes = await fetch(`https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`, {
        headers: { Authorization: parsed.data.accessToken },
      });
      if (spacesRes.ok) {
        const spacesData = await spacesRes.json() as any;
        spaceIds = (spacesData.spaces || []).map((s: any) => s.id);
        spaceNames = (spacesData.spaces || []).map((s: any) => s.name);
      }
    }

    const connection = await prisma.clickUpConnection.upsert({
      where: { companyId },
      update: {
        accessToken: parsed.data.accessToken,
        teamId: team?.id?.toString() || null,
        teamName: team?.name || null,
        spaceIds,
        spaceNames,
      },
      create: {
        companyId,
        accessToken: parsed.data.accessToken,
        teamId: team?.id?.toString() || null,
        teamName: team?.name || null,
        spaceIds,
        spaceNames,
      },
    });

    res.status(200).json({
      connected: true,
      teamId: connection.teamId,
      teamName: connection.teamName,
      spaceIds: connection.spaceIds,
      spaceNames: connection.spaceNames,
    });
  } catch (err: any) {
    console.error("[clickup-connect]", err);
    res.status(500).json({ error: "Failed to connect ClickUp" });
  }
});

companyRoutes.get("/integrations/clickup/status", async (req, res) => {
  const companyId = (req as any).companyId || "";
  try {
    const conn = await prisma.clickUpConnection.findUnique({ where: { companyId } });
    if (!conn) {
      res.status(200).json({ connected: false });
      return;
    }
    res.status(200).json({
      connected: true,
      teamId: conn.teamId,
      teamName: conn.teamName,
      spaceIds: conn.spaceIds,
      spaceNames: conn.spaceNames,
      defaultListId: conn.defaultListId,
      defaultListName: conn.defaultListName,
      lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch ClickUp status" });
  }
});

companyRoutes.delete("/integrations/clickup/disconnect", async (req, res) => {
  const companyId = (req as any).companyId || "";
  try {
    await prisma.clickUpConnection.deleteMany({ where: { companyId } });
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect ClickUp" });
  }
});

const clickUpSetListSchema = z.object({
  listId: z.string().min(1),
  listName: z.string().optional(),
});

companyRoutes.patch("/integrations/clickup/default-list", async (req, res) => {
  const parsed = clickUpSetListSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "listId required" });
    return;
  }
  const companyId = (req as any).companyId || "";
  try {
    const conn = await prisma.clickUpConnection.update({
      where: { companyId },
      data: { defaultListId: parsed.data.listId, defaultListName: parsed.data.listName || null },
    });
    res.status(200).json({ defaultListId: conn.defaultListId, defaultListName: conn.defaultListName });
  } catch {
    res.status(404).json({ error: "ClickUp not connected" });
  }
});

companyRoutes.post("/posts/:postId/clickup/push", async (req, res) => {
  const companyId = (req as any).companyId || "";
  try {
    const conn = await prisma.clickUpConnection.findUnique({ where: { companyId } });
    if (!conn || !conn.defaultListId) {
      res.status(400).json({ error: "ClickUp not connected or no default list set" });
      return;
    }

    // Check existing link
    const existing = await prisma.clickUpTaskLink.findFirst({ where: { postId: req.params.postId } });
    if (existing) {
      res.status(200).json({ alreadyLinked: true, taskId: existing.clickUpTaskId, url: existing.clickUpUrl });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      include: { category: { select: { name: true } }, board: { select: { name: true } } },
    });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const taskRes = await fetch(`https://api.clickup.com/api/v2/list/${conn.defaultListId}/task`, {
      method: "POST",
      headers: { Authorization: conn.accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: post.title,
        description: `**PainSolver Idea**\n\n${post.description}\n\n---\nBoard: ${post.board.name}\nCategory: ${post.category.name}\nVotes: ${post.explicitVoteCount + post.implicitVoteCount}\nMRR: $${post.totalAttachedMrr}\nStatus: ${post.status}`,
        status: post.status === "in_progress" ? "in progress" : post.status === "complete" ? "complete" : "to do",
        tags: [{ name: "painsolver" }],
      }),
    });

    if (!taskRes.ok) {
      const errText = await taskRes.text();
      res.status(502).json({ error: "ClickUp API error", details: errText });
      return;
    }

    const taskData = await taskRes.json() as any;
    const link = await prisma.clickUpTaskLink.create({
      data: {
        postId: post.id,
        clickUpTaskId: taskData.id,
        clickUpUrl: taskData.url,
        clickUpStatus: taskData.status?.status || "Open",
        lastSyncedAt: new Date(),
      },
    });

    res.status(201).json({ taskId: link.clickUpTaskId, url: link.clickUpUrl, status: link.clickUpStatus });
  } catch (err: any) {
    console.error("[clickup-push]", err);
    res.status(500).json({ error: "Failed to push to ClickUp" });
  }
});

companyRoutes.get("/posts/:postId/clickup/status", async (req, res) => {
  try {
    const link = await prisma.clickUpTaskLink.findFirst({ where: { postId: req.params.postId } });
    if (!link) {
      res.status(200).json({ linked: false });
      return;
    }
    res.status(200).json({ linked: true, taskId: link.clickUpTaskId, url: link.clickUpUrl, status: link.clickUpStatus });
  } catch {
    res.status(500).json({ error: "Failed to check ClickUp status" });
  }
});

// ═══════════════════════════════════════════════
// P1: Comment UX - like/react/pin/edit
// ═══════════════════════════════════════════════
companyRoutes.post("/comments/:commentId/like", async (req, res) => {
  const userId = (req as any).actor?.userId || (req as any).authUser?.id || "";
  if (!userId) { res.status(401).json({ error: "Must be logged in" }); return; }
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

    const alreadyLiked = comment.likedByUserIds.includes(userId);
    if (alreadyLiked) {
      // Unlike
      await prisma.comment.update({
        where: { id: req.params.commentId },
        data: {
          likedByUserIds: comment.likedByUserIds.filter((id) => id !== userId),
          likeCount: Math.max(0, comment.likeCount - 1),
        },
      });
      res.status(200).json({ liked: false, likeCount: Math.max(0, comment.likeCount - 1) });
    } else {
      // Like
      await prisma.comment.update({
        where: { id: req.params.commentId },
        data: {
          likedByUserIds: [...comment.likedByUserIds, userId],
          likeCount: comment.likeCount + 1,
        },
      });
      res.status(200).json({ liked: true, likeCount: comment.likeCount + 1 });
    }
  } catch {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

const reactSchema = z.object({ emoji: z.string().min(1).max(4) });

companyRoutes.post("/comments/:commentId/react", async (req, res) => {
  const parsed = reactSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid emoji" }); return; }
  const userId = (req as any).actor?.userId || (req as any).authUser?.id || "";
  if (!userId) { res.status(401).json({ error: "Must be logged in" }); return; }
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

    const reactions = (comment.reactions as Record<string, string[]>) || {};
    const emoji = parsed.data.emoji;
    const users = reactions[emoji] || [];
    if (users.includes(userId)) {
      reactions[emoji] = users.filter((id) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, userId];
    }

    await prisma.comment.update({ where: { id: req.params.commentId }, data: { reactions } });
    res.status(200).json({ reactions });
  } catch {
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

companyRoutes.post("/comments/:commentId/pin", async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
    await prisma.comment.update({ where: { id: req.params.commentId }, data: { isPinned: !comment.isPinned } });
    res.status(200).json({ isPinned: !comment.isPinned });
  } catch {
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});

const editCommentSchema = z.object({ value: z.string().min(1) });

companyRoutes.patch("/comments/:commentId", async (req, res) => {
  const parsed = editCommentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Comment body required" }); return; }
  try {
    const comment = await prisma.comment.update({
      where: { id: req.params.commentId },
      data: { value: parsed.data.value, editedAt: new Date() },
    });
    res.status(200).json({ id: comment.id, value: comment.value, editedAt: comment.editedAt?.toISOString() });
  } catch {
    res.status(404).json({ error: "Comment not found" });
  }
});

// ═══════════════════════════════════════════════
// P1: Reporting with trends
// ═══════════════════════════════════════════════
companyRoutes.get("/reporting/trends", async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Daily new posts for last 30 days
    const recentPosts = await prisma.post.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true, totalAttachedMrr: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyPosts: Record<string, { count: number; mrr: number }> = {};
    recentPosts.forEach((p) => {
      const day = p.createdAt.toISOString().slice(0, 10);
      if (!dailyPosts[day]) dailyPosts[day] = { count: 0, mrr: 0 };
      dailyPosts[day].count++;
      dailyPosts[day].mrr += p.totalAttachedMrr;
    });

    // Daily votes for last 30 days
    const recentVotes = await prisma.vote.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, voteType: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyVotes: Record<string, { explicit: number; implicit: number }> = {};
    recentVotes.forEach((v) => {
      const day = v.createdAt.toISOString().slice(0, 10);
      if (!dailyVotes[day]) dailyVotes[day] = { explicit: 0, implicit: 0 };
      if (v.voteType === "explicit") dailyVotes[day].explicit++;
      else dailyVotes[day].implicit++;
    });

    // Status distribution over time (monthly for 3 months)
    const statusPosts = await prisma.post.findMany({
      where: { createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true, status: true },
    });

    const monthlyStatus: Record<string, Record<string, number>> = {};
    statusPosts.forEach((p) => {
      const month = p.createdAt.toISOString().slice(0, 7);
      if (!monthlyStatus[month]) monthlyStatus[month] = {};
      monthlyStatus[month][p.status] = (monthlyStatus[month][p.status] || 0) + 1;
    });

    // Top categories by post count
    const topCategories = await prisma.category.findMany({
      select: { name: true, _count: { select: { posts: true } } },
      orderBy: { posts: { _count: "desc" } },
      take: 10,
    });

    // MRR trend
    const mrrTrendPosts = await prisma.post.findMany({
      where: { createdAt: { gte: ninetyDaysAgo }, totalAttachedMrr: { gt: 0 } },
      select: { createdAt: true, totalAttachedMrr: true },
      orderBy: { createdAt: "asc" },
    });

    const weeklyMrr: Record<string, number> = {};
    mrrTrendPosts.forEach((p) => {
      const week = new Date(p.createdAt);
      week.setDate(week.getDate() - week.getDay());
      const key = week.toISOString().slice(0, 10);
      weeklyMrr[key] = (weeklyMrr[key] || 0) + p.totalAttachedMrr;
    });

    // Velocity: avg days from under_review to complete
    const completedPosts = await prisma.post.findMany({
      where: { status: { in: ["complete", "shipped"] }, statusChangedAt: { not: null } },
      select: { createdAt: true, statusChangedAt: true },
      take: 100,
      orderBy: { statusChangedAt: "desc" },
    });

    const velocityDays = completedPosts
      .filter((p) => p.statusChangedAt)
      .map((p) => (p.statusChangedAt!.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const avgVelocity = velocityDays.length ? velocityDays.reduce((a, b) => a + b, 0) / velocityDays.length : 0;

    res.status(200).json({
      dailyPosts: Object.entries(dailyPosts).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d })),
      dailyVotes: Object.entries(dailyVotes).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d })),
      monthlyStatus: Object.entries(monthlyStatus).sort(([a], [b]) => a.localeCompare(b)).map(([month, s]) => ({ month, ...s })),
      topCategories: topCategories.map((c) => ({ name: c.name, count: c._count.posts })),
      weeklyMrr: Object.entries(weeklyMrr).sort(([a], [b]) => a.localeCompare(b)).map(([week, mrr]) => ({ week, mrr })),
      avgVelocityDays: Math.round(avgVelocity * 10) / 10,
      completedCount: completedPosts.length,
    });
  } catch (err: any) {
    console.error("[reporting-trends]", err);
    res.status(500).json({ error: "Failed to load trend data" });
  }
});
