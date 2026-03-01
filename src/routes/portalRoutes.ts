import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { ActorContext, requireAuthenticatedActor } from "../middleware/actorAccess";
import {
  addCommentAsActor,
  createAccessRequestAsActor,
  createPostAsActor,
  getOrCreateActorUser,
  getPostForActor,
  listBoardsForActor,
  listFeedbackForBoard,
  listNotificationPreferences,
  listNotificationsForActor,
  listPublishedChangelog,
  listRoadmapForBoard,
  markAllNotificationsReadForActor,
  markNotificationReadForActor,
  updateNotificationPreferencesForActor,
  upsertActorUser,
  votePostAsActor,
  WorkspaceFilterMode,
  WorkspaceSortMode
} from "../services/workspaceDataService";

const feedbackQuerySchema = z.object({
  sort: z.enum(["trending", "top", "new"]).optional(),
  filter: z.enum(["all", "under_review", "upcoming", "planned", "in_progress", "complete"]).optional(),
  q: z.string().optional()
});

const createPostSchema = z.object({
  boardId: z.string().min(1),
  title: z.string().min(1),
  details: z.string().min(1)
});

const voteSchema = z.object({
  postId: z.string().min(1)
});

const commentSchema = z.object({
  postId: z.string().min(1),
  body: z.string().min(1),
  replyToCommentId: z.string().min(1).optional()
});

const accessRequestSchema = z.object({
  boardId: z.string().min(1),
  reason: z.string().min(1),
  email: z.string().email().optional()
});

const ssoStartSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  appUserId: z.string().optional(),
  segments: z.array(z.string()).optional()
});

const notificationPreferencesSchema = z.object({
  productUpdates: z.boolean().optional(),
  commentReplies: z.boolean().optional(),
  mentions: z.boolean().optional(),
  weeklyDigest: z.boolean().optional()
});

function getActor(actor: ActorContext | undefined): ActorContext {
  return (
    actor ?? {
      userId: null,
      appUserId: null,
      email: null,
      displayName: null,
      segments: [],
      role: "anonymous",
      isAuthenticated: false,
      accessLevel: "read"
    }
  );
}

export const portalRoutes = Router();

portalRoutes.get("/session", async (req, res) => {
  const actor = getActor(req.actor);
  const profile = actor.isAuthenticated ? await getOrCreateActorUser(req.actor) : null;
  const preferences = actor.isAuthenticated ? await listNotificationPreferences(req.actor) : null;

  res.status(200).json({
    actor,
    profile: profile
      ? {
          email: profile.email,
          name: profile.name,
          appUserId: profile.appUserId,
          segments: profile.segments
        }
      : null,
    notificationPreferences: preferences
  });
});

portalRoutes.post("/sso/start", async (req, res) => {
  const parsed = ssoStartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid SSO payload", details: parsed.error.flatten() });
    return;
  }

  const result = await upsertActorUser(prisma, {
    role: "customer",
    isAuthenticated: true,
    email: parsed.data.email,
    displayName: parsed.data.name ?? parsed.data.email,
    appUserId: parsed.data.appUserId ?? null,
    segments: parsed.data.segments ?? []
  });

  if (!result.user) {
    res.status(400).json({ error: "Unable to start session" });
    return;
  }

  res.status(200).json({
    session: {
      email: result.user.email,
      name: result.user.name,
      appUserId: result.user.appUserId,
      segments: result.user.segments
    }
  });
});

portalRoutes.post("/sso/logout", (_req, res) => {
  res.status(200).json({ ok: true });
});

portalRoutes.get("/boards", async (req, res) => {
  const boards = await listBoardsForActor(req.actor);
  res.status(200).json({ boards });
});

portalRoutes.get("/boards/:boardId/feedback", async (req, res) => {
  const parsed = feedbackQuerySchema.safeParse({
    sort: req.query.sort,
    filter: req.query.filter,
    q: req.query.q
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback query", details: parsed.error.flatten() });
    return;
  }

  const result = await listFeedbackForBoard({
    boardId: req.params.boardId,
    actor: req.actor,
    sort: (parsed.data.sort ?? "trending") as WorkspaceSortMode,
    filter: (parsed.data.filter ?? "all") as WorkspaceFilterMode,
    search: parsed.data.q ?? "",
    includeMerged: false,
    includePrivateComments: false
  });

  if (!result.access.canRead) {
    res.status(403).json({
      error: "You do not have access to this board",
      access: result.access
    });
    return;
  }

  res.status(200).json(result);
});

portalRoutes.get("/boards/:boardId/roadmap", async (req, res) => {
  const result = await listRoadmapForBoard({
    boardId: req.params.boardId,
    actor: req.actor
  });

  if (!result.access.canRead) {
    res.status(403).json({
      error: "You do not have access to this board",
      access: result.access
    });
    return;
  }

  res.status(200).json(result);
});

portalRoutes.get("/changelog", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const entries = await listPublishedChangelog(query);
  res.status(200).json({ entries });
});

portalRoutes.get("/posts/:postId", async (req, res) => {
  const result = await getPostForActor({
    postId: req.params.postId,
    actor: req.actor,
    includePrivateComments: false
  });

  if (!result.post) {
    if (result.access && !result.access.canRead) {
      res.status(403).json({
        error: "You do not have access to this board",
        access: result.access
      });
      return;
    }

    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(200).json({ post: result.post });
});

portalRoutes.post("/votes", requireAuthenticatedActor, async (req, res) => {
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vote payload", details: parsed.error.flatten() });
    return;
  }

  const result = await votePostAsActor({
    postId: parsed.data.postId,
    actor: req.actor
  });

  if (!result.post) {
    if (result.access && !result.access.canPost) {
      res.status(403).json({ error: "You cannot vote on this board", access: result.access });
      return;
    }
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(200).json({ post: result.post });
});

portalRoutes.post("/posts", requireAuthenticatedActor, async (req, res) => {
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
    if (result.access && !result.access.canPost) {
      res.status(403).json({ error: "You cannot create posts on this board", access: result.access });
      return;
    }

    res.status(400).json({ error: "Could not create post" });
    return;
  }

  res.status(201).json({ post: result.post });
});

portalRoutes.post("/comments", requireAuthenticatedActor, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid comment payload", details: parsed.error.flatten() });
    return;
  }

  const result = await addCommentAsActor({
    postId: parsed.data.postId,
    body: parsed.data.body,
    replyToCommentId: parsed.data.replyToCommentId,
    actor: req.actor,
    isPrivate: false
  });

  if (!result.comment) {
    if (result.access && !result.access.canPost) {
      res.status(403).json({ error: "You cannot comment on this board", access: result.access });
      return;
    }

    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.status(201).json({ comment: result.comment });
});

portalRoutes.post("/access/request", async (req, res) => {
  const parsed = accessRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid access request payload",
      details: parsed.error.flatten()
    });
    return;
  }

  const result = await createAccessRequestAsActor({
    boardId: parsed.data.boardId,
    reason: parsed.data.reason,
    actor: req.actor,
    emailOverride: parsed.data.email
  });

  if (!result.request) {
    if (result.access && !result.access.canRequest) {
      res.status(400).json({ error: "Access request is not required for this board", access: result.access });
      return;
    }

    res.status(400).json({ error: "Email is required for access requests" });
    return;
  }

  res.status(201).json({ request: result.request });
});

portalRoutes.get("/notifications", requireAuthenticatedActor, async (req, res) => {
  const result = await listNotificationsForActor(req.actor);
  if (!result) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  res.status(200).json(result);
});

portalRoutes.patch("/notifications/:notificationId/read", requireAuthenticatedActor, async (req, res) => {
  const notificationId = Array.isArray(req.params.notificationId)
    ? req.params.notificationId[0]
    : req.params.notificationId;

  if (!notificationId) {
    res.status(400).json({ error: "Notification id is required" });
    return;
  }

  const ok = await markNotificationReadForActor(req.actor, notificationId);
  if (!ok) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.status(200).json({ ok: true });
});

portalRoutes.post("/notifications/read-all", requireAuthenticatedActor, async (req, res) => {
  const updatedCount = await markAllNotificationsReadForActor(req.actor);
  res.status(200).json({ updatedCount });
});

portalRoutes.get("/notification-preferences", requireAuthenticatedActor, async (req, res) => {
  const preferences = await listNotificationPreferences(req.actor);
  if (!preferences) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  res.status(200).json({ preferences });
});

portalRoutes.patch("/notification-preferences", requireAuthenticatedActor, async (req, res) => {
  const parsed = notificationPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid notification preference payload",
      details: parsed.error.flatten()
    });
    return;
  }

  const preferences = await updateNotificationPreferencesForActor(req.actor, parsed.data);
  if (!preferences) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  res.status(200).json({ preferences });
});

