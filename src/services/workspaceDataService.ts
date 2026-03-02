import {
  NotificationType,
  PostStatus,
  Prisma,
  PrismaClient,
  UserRole,
  AiInboxRoutingMode,
  PainEventSource
} from "@prisma/client";

import { ActorContext } from "../middleware/actorAccess";
import { prisma } from "../db/prisma";
import { createOrUpgradeVote } from "./postService";
import {
  sendCommentReplyEmail,
  sendMentionEmail,
  sendStatusChangeEmail
} from "./emailService";
import { notifySlackStatusChange } from "../routes/slackIntegrationRoutes";
import { notifyFreshdeskStatusChange } from "../routes/freshdeskIntegrationRoutes";

export type WorkspaceSortMode = "trending" | "top" | "new";
export type WorkspaceFilterMode =
  | "all"
  | "under_review"
  | "upcoming"
  | "planned"
  | "in_progress"
  | "complete";
export type WorkspacePostStatus = Exclude<WorkspaceFilterMode, "all">;

export interface WorkspaceActor {
  role: ActorContext["role"];
  isAuthenticated: boolean;
  email: string | null;
  displayName: string | null;
  appUserId: string | null;
  segments: string[];
}

export interface WorkspaceBoardView {
  id: string;
  name: string;
  visibility: "public" | "private" | "custom";
  allowedSegments: string[];
  access: "granted" | "request" | "locked";
  canPost: boolean;
  postCount: number;
}

export interface WorkspaceBoardAccess {
  canRead: boolean;
  canPost: boolean;
  canRequest: boolean;
  access: "granted" | "request" | "locked";
}

interface PostMapOptions {
  includePrivateComments: boolean;
}

export interface WorkspaceCommentView {
  id: string;
  postId: string;
  authorName: string;
  authorId: string;
  body: string;
  replyToCommentId: string | null;
  replyToAuthorName: string | null;
  isPrivate: boolean;
  createdAt: string;
}

export interface WorkspacePostView {
  id: string;
  boardId: string;
  title: string;
  details: string;
  status: WorkspaceFilterMode;
  ownerName: string;
  eta: string | null;
  tags: string[];
  voteCount: number;
  commentCount: number;
  attachedMrr: number;
  capturedViaSupport: boolean;
  mergedIntoPostId: string | null;
  mergedSourcePostIds: string[];
  createdAt: string;
  updatedAt: string;
  comments: WorkspaceCommentView[];
}

export interface WorkspacePostVoterOtherIdeaView {
  postId: string;
  title: string;
  boardId: string;
  boardName: string;
  status: WorkspaceFilterMode;
  attachedMrr: number;
  voteType: "implicit" | "explicit";
}

export interface WorkspacePostVoterInsightView {
  userId: string;
  userName: string;
  userEmail: string;
  userCreatedAt: string;
  companyId: string;
  companyName: string;
  companyMrr: number;
  voteTypesInIdea: Array<"implicit" | "explicit">;
  votedIdeaPostIds: string[];
  votedIdeaPostTitles: string[];
  otherUpvotedIdeas: WorkspacePostVoterOtherIdeaView[];
}

export interface WorkspacePostVoterInsightsView {
  canonicalPostId: string;
  canonicalPostTitle: string;
  boardId: string;
  boardName: string;
  mergedIdeaPostIds: string[];
  mergedIdeaPosts: Array<{
    id: string;
    title: string;
    mergedIntoPostId: string | null;
  }>;
  summary: {
    totalVoters: number;
    uniqueCompanies: number;
    totalCompanyMrr: number;
  };
  voters: WorkspacePostVoterInsightView[];
}

export interface WorkspaceCustomerIdeaLinkView {
  postId: string;
  title: string;
  boardId: string;
  boardName: string;
  status: WorkspaceFilterMode;
  attachedMrr: number;
  voteType: "implicit" | "explicit";
  sourcePostIds: string[];
}

export interface WorkspaceCustomerVoterView {
  userId: string;
  userName: string;
  userEmail: string;
  linkedIdeaCount: number;
  explicitVoteCount: number;
  implicitVoteCount: number;
}

export interface WorkspaceCustomerRelationshipView {
  companyId: string;
  companyName: string;
  companyMrr: number;
  uniqueVoterCount: number;
  totalLinkedIdeas: number;
  explicitIdeaCount: number;
  implicitIdeaCount: number;
  voters: WorkspaceCustomerVoterView[];
  linkedIdeas: WorkspaceCustomerIdeaLinkView[];
}

export interface WorkspaceRoadmapView {
  planned: WorkspacePostView[];
  in_progress: WorkspacePostView[];
  complete: WorkspacePostView[];
}

export interface CompanyChangelogEntryView {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  boardId: string | null;
  boardName: string | null;
  postId: string | null;
  postTitle: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

const postInclude = Prisma.validator<Prisma.PostInclude>()({
  comments: {
    orderBy: { createdAt: "desc" },
    take: 50, // Limit comments to prevent slow queries
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      replyToComment: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }
    }
  },
  mergedSourcePosts: {
    select: { id: true }
  }
});

type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractDomain(email: string): string {
  const parts = email.split("@");
  if (parts.length < 2) {
    return "customer";
  }

  return parts[1].split(".")[0] || "customer";
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripHtmlToText(value: string): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFromHtml(value: string, max = 220): string {
  const text = stripHtmlToText(value);
  if (text.length <= max) {
    return text;
  }

  return text.slice(0, Math.max(0, max - 1)).trim() + "…";
}

function dedupeSegments(segments: string[]): string[] {
  const set = new Set<string>();
  segments.forEach((segment) => {
    const normalized = segment.trim().toLowerCase();
    if (normalized) {
      set.add(normalized);
    }
  });

  return Array.from(set);
}

type AiInboxSourceKey = "freshdesk" | "zoom";
type AiInboxRoutingModeView = "central" | "individual";

const AI_INBOX_DEFAULTS: Record<AiInboxSourceKey, { routingMode: AiInboxRoutingModeView; enabled: boolean }> = {
  freshdesk: {
    routingMode: "central",
    enabled: true
  },
  zoom: {
    routingMode: "individual",
    enabled: true
  }
};

const TRIAGE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "with",
  "you"
]);

interface AiInboxSourceConfigView {
  source: AiInboxSourceKey;
  routingMode: AiInboxRoutingModeView;
  enabled: boolean;
  updatedAt: string;
}

interface TriageCandidatePost {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: PostStatus;
  boardId: string;
  boardName: string;
  attachedMrr: number;
  voteCount: number;
}

interface TriageMergeCandidateView {
  postId: string;
  postTitle: string;
  boardId: string;
  boardName: string;
  status: WorkspaceFilterMode;
  score: number;
}

function tokenizeForRecommendation(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TRIAGE_STOP_WORDS.has(token));
}

function uniqueTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens));
}

function overlapScore(sourceTokens: string[], targetTokens: string[]): number {
  if (!sourceTokens.length || !targetTokens.length) {
    return 0;
  }

  const targetSet = new Set(targetTokens);
  let score = 0;
  sourceTokens.forEach((token) => {
    if (targetSet.has(token)) {
      score += 1;
    }
  });
  return score;
}

function derivePainEventTitle(rawText: string): string {
  const normalized = String(rawText || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Untitled request";
  }

  const sentence = normalized.split(/[.!?]\s+/)[0]?.trim() || normalized;
  if (sentence.length <= 92) {
    return sentence;
  }

  return sentence.slice(0, 91).trim() + "…";
}

function buildTriageMergeCandidates(input: {
  rawText: string;
  matchedPostId?: string | null;
  posts: TriageCandidatePost[];
}): TriageMergeCandidateView[] {
  const eventTokens = uniqueTokens(tokenizeForRecommendation(input.rawText));
  const candidates = input.posts
    .map((post) => {
      const titleTokens = uniqueTokens(tokenizeForRecommendation(post.title));
      const descriptionTokens = uniqueTokens(tokenizeForRecommendation(post.description));
      const tagTokens = uniqueTokens(post.tags.flatMap((tag) => tokenizeForRecommendation(tag)));

      let score = 0;
      score += overlapScore(eventTokens, titleTokens) * 8;
      score += overlapScore(eventTokens, descriptionTokens) * 4;
      score += overlapScore(eventTokens, tagTokens) * 6;
      score += Math.min(2, Math.round((post.attachedMrr || 0) / 5000));
      score += Math.min(2, Math.round((post.voteCount || 0) / 150));

      if (input.matchedPostId && post.id === input.matchedPostId) {
        score += 40;
      }

      return {
        postId: post.id,
        postTitle: post.title,
        boardId: post.boardId,
        boardName: post.boardName,
        status: normalizePostStatus(post.status),
        score
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (candidates.length > 0) {
    return candidates;
  }

  return input.posts
    .slice()
    .sort((a, b) => b.attachedMrr - a.attachedMrr)
    .slice(0, 3)
    .map((post, index) => ({
      postId: post.id,
      postTitle: post.title,
      boardId: post.boardId,
      boardName: post.boardName,
      status: normalizePostStatus(post.status),
      score: Math.max(1, 10 - index)
    }));
}

function pickRecommendedBoard(input: {
  rawText: string;
  mergeCandidates: TriageMergeCandidateView[];
  boards: Array<{ id: string; name: string }>;
}): { boardId: string; boardName: string } | null {
  if (input.mergeCandidates.length) {
    const first = input.mergeCandidates[0];
    return {
      boardId: first.boardId,
      boardName: first.boardName
    };
  }

  if (!input.boards.length) {
    return null;
  }

  const textTokens = uniqueTokens(tokenizeForRecommendation(input.rawText));
  const scoredBoards = input.boards.map((board) => {
    const boardTokens = uniqueTokens(tokenizeForRecommendation(board.name));
    return {
      boardId: board.id,
      boardName: board.name,
      score: overlapScore(textTokens, boardTokens)
    };
  });

  scoredBoards.sort((a, b) => b.score - a.score || a.boardName.localeCompare(b.boardName));
  return scoredBoards[0] ?? null;
}

async function ensureAiInboxConfig(
  tx: PrismaClient | Prisma.TransactionClient
): Promise<Record<AiInboxSourceKey, AiInboxSourceConfigView>> {
  const defaults = Object.entries(AI_INBOX_DEFAULTS) as Array<
    [AiInboxSourceKey, { routingMode: AiInboxRoutingModeView; enabled: boolean }]
  >;

  await Promise.all(
    defaults.map(([source, config]) =>
      tx.aiInboxConfig.upsert({
        where: {
          source
        },
        update: {},
        create: {
          source: source as PainEventSource,
          routingMode: config.routingMode as AiInboxRoutingMode,
          enabled: config.enabled
        }
      })
    )
  );

  const rows = await tx.aiInboxConfig.findMany({
    orderBy: {
      source: "asc"
    }
  });

  const configMap: Record<AiInboxSourceKey, AiInboxSourceConfigView> = {
    freshdesk: {
      source: "freshdesk",
      routingMode: AI_INBOX_DEFAULTS.freshdesk.routingMode,
      enabled: AI_INBOX_DEFAULTS.freshdesk.enabled,
      updatedAt: new Date(0).toISOString()
    },
    zoom: {
      source: "zoom",
      routingMode: AI_INBOX_DEFAULTS.zoom.routingMode,
      enabled: AI_INBOX_DEFAULTS.zoom.enabled,
      updatedAt: new Date(0).toISOString()
    }
  };

  rows.forEach((row) => {
    const key = row.source as AiInboxSourceKey;
    configMap[key] = {
      source: key,
      routingMode: row.routingMode as AiInboxRoutingModeView,
      enabled: row.enabled,
      updatedAt: row.updatedAt.toISOString()
    };
  });

  return configMap;
}

function actorToUserRole(role: WorkspaceActor["role"]): UserRole {
  if (role === "admin") {
    return "admin";
  }

  if (role === "member") {
    return "member";
  }

  return "customer";
}

function normalizePostStatus(status: string): WorkspaceFilterMode {
  if (status === "backlog") {
    return "under_review";
  }

  if (status === "shipped") {
    return "complete";
  }

  if (
    status === "under_review" ||
    status === "upcoming" ||
    status === "planned" ||
    status === "in_progress" ||
    status === "complete"
  ) {
    return status;
  }

  return "under_review";
}

function filterToDbStatuses(filter: WorkspaceFilterMode): Array<string> | null {
  switch (filter) {
    case "under_review":
      return ["under_review", "backlog"];
    case "upcoming":
      return ["upcoming"];
    case "planned":
      return ["planned"];
    case "in_progress":
      return ["in_progress"];
    case "complete":
      return ["complete", "shipped"];
    default:
      return null;
  }
}

function roadmapBucket(status: string): "planned" | "in_progress" | "complete" | null {
  if (status === "planned" || status === "upcoming") {
    return "planned";
  }

  if (status === "in_progress") {
    return "in_progress";
  }

  if (status === "complete" || status === "shipped") {
    return "complete";
  }

  return null;
}

function boardVisibility(
  board: { visibility: string; isPrivate: boolean }
): "public" | "private" | "custom" {
  if (board.visibility === "public" || board.visibility === "private" || board.visibility === "custom") {
    return board.visibility;
  }

  return board.isPrivate ? "private" : "public";
}

function accessFromFlags(flags: {
  canRead: boolean;
  canPost: boolean;
  canRequest: boolean;
}): WorkspaceBoardAccess {
  return {
    canRead: flags.canRead,
    canPost: flags.canPost,
    canRequest: flags.canRequest,
    access: flags.canRead ? "granted" : flags.canRequest ? "request" : "locked"
  };
}

function mapComment(comment: PostWithRelations["comments"][number]): WorkspaceCommentView {
  return {
    id: comment.id,
    postId: comment.postId,
    authorName: comment.author.name || comment.author.email,
    authorId: comment.authorId,
    body: comment.value,
    replyToCommentId: comment.replyToCommentId,
    replyToAuthorName: comment.replyToComment
      ? comment.replyToComment.author.name || comment.replyToComment.author.email
      : null,
    isPrivate: comment.isPrivate,
    createdAt: comment.createdAt.toISOString()
  };
}

function mapPost(post: PostWithRelations, options: PostMapOptions): WorkspacePostView {
  const comments = options.includePrivateComments
    ? post.comments.map(mapComment)
    : post.comments.filter((comment) => !comment.isPrivate).map(mapComment);

  return {
    id: post.id,
    boardId: post.boardId,
    title: post.title,
    details: post.description,
    status: normalizePostStatus(post.status),
    ownerName: post.ownerName,
    eta: post.eta ? post.eta.toISOString().slice(0, 10) : null,
    tags: post.tags,
    voteCount: post.explicitVoteCount + post.implicitVoteCount,
    commentCount: comments.length,
    attachedMrr: post.totalAttachedMrr,
    capturedViaSupport: post.implicitVoteCount > 0,
    mergedIntoPostId: post.mergedIntoPostId,
    mergedSourcePostIds: post.mergedSourcePosts.map((item) => item.id),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    comments
  };
}

function commentMentionEmails(value: string): string[] {
  const matches = value.match(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi) ?? [];
  const set = new Set<string>();
  matches.forEach((match) => set.add(normalizeEmail(match.replace("@", ""))));
  return Array.from(set);
}

function asWorkspaceActor(actor: ActorContext | undefined): WorkspaceActor {
  return {
    role: actor?.role ?? "anonymous",
    isAuthenticated: actor?.isAuthenticated ?? false,
    email: actor?.email ?? null,
    displayName: actor?.displayName ?? null,
    appUserId: actor?.appUserId ?? null,
    segments: actor?.segments ?? []
  };
}

export async function upsertActorUser(
  tx: PrismaClient | Prisma.TransactionClient,
  actor: WorkspaceActor
): Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    appUserId: string | null;
    segments: string[];
    role: UserRole;
    companyId: string;
    company: {
      id: string;
      name: string;
      monthlySpend: number;
    };
  } | null;
}> {
  if (!actor.email) {
    return { user: null };
  }

  const normalizedEmail = normalizeEmail(actor.email);
  const role = actorToUserRole(actor.role);
  const segments = dedupeSegments(actor.segments);
  const displayName = actor.displayName?.trim() || normalizedEmail;
  const appUserId = actor.appUserId?.trim() || null;

  const existing = await tx.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          monthlySpend: true
        }
      }
    }
  });

  if (existing) {
    const mergedSegments = dedupeSegments([...existing.segments, ...segments]);
    const nextRole = existing.role === "admin" ? "admin" : existing.role === "member" ? "member" : role;

    const updated = await tx.user.update({
      where: { id: existing.id },
      data: {
        name: displayName,
        appUserId: appUserId ?? existing.appUserId,
        role: nextRole,
        segments: mergedSegments
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            monthlySpend: true
          }
        }
      }
    });

    return { user: updated };
  }

  const companyName =
    role === "member" || role === "admin"
      ? "PainSolver Internal"
      : titleCase(extractDomain(normalizedEmail)) + " Workspace";

  const company = await tx.company.upsert({
    where: { name: companyName },
    update: {},
    create: {
      name: companyName,
      monthlySpend: role === "customer" ? 199 : 0,
      healthStatus: "active"
    }
  });

  const created = await tx.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: displayName,
      appUserId: appUserId ?? undefined,
      role,
      segments
    },
    create: {
      companyId: company.id,
      email: normalizedEmail,
      name: displayName,
      appUserId,
      role,
      segments
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          monthlySpend: true
        }
      }
    }
  });

  return { user: created };
}

async function ensureNotificationPreferences(
  tx: PrismaClient | Prisma.TransactionClient,
  userId: string
): Promise<{
  id: string;
  userId: string;
  productUpdates: boolean;
  commentReplies: boolean;
  mentions: boolean;
  weeklyDigest: boolean;
}> {
  const existing = await tx.notificationPreference.findUnique({
    where: { userId }
  });

  if (existing) {
    return existing;
  }

  return tx.notificationPreference.create({
    data: {
      userId,
      productUpdates: true,
      commentReplies: true,
      mentions: true,
      weeklyDigest: true
    }
  });
}

function computeBoardAccess(
  board: { id: string; visibility: string; isPrivate: boolean; allowedSegments: string[] },
  actor: WorkspaceActor,
  actorUser:
    | {
        id: string;
        segments: string[];
      }
    | null,
  requestStatuses?: Map<string, "pending" | "approved" | "rejected">
): WorkspaceBoardAccess {
  if (actor.role === "member" || actor.role === "admin") {
    return accessFromFlags({ canRead: true, canPost: true, canRequest: false });
  }

  const visibility = boardVisibility(board);
  if (visibility === "public") {
    return accessFromFlags({
      canRead: true,
      canPost: actor.isAuthenticated && actor.role === "customer",
      canRequest: false
    });
  }

  if (!actor.isAuthenticated || actor.role !== "customer") {
    return accessFromFlags({ canRead: false, canPost: false, canRequest: false });
  }

  const user = actorUser;
  if (!user) {
    return accessFromFlags({ canRead: false, canPost: false, canRequest: false });
  }

  const actorSegments = dedupeSegments([...(actor.segments || []), ...(user.segments || [])]);
  const segmentAllowed =
    visibility === "custom" &&
    (board.allowedSegments.length === 0 ||
      board.allowedSegments.some((segment) => actorSegments.includes(segment.toLowerCase())));

  const latestStatus = requestStatuses?.get(board.id);

  const requestApproved = latestStatus === "approved";
  const canRead = visibility === "private" ? requestApproved : segmentAllowed || requestApproved;

  return accessFromFlags({
    canRead,
    canPost: canRead,
    canRequest: !canRead
  });
}

export async function listBoardsForActor(actorCtx: ActorContext | undefined): Promise<WorkspaceBoardView[]> {
  const actor = asWorkspaceActor(actorCtx);
  const actorRecord = actor.isAuthenticated ? await upsertActorUser(prisma, actor) : { user: null };

  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "asc" }
  });

  const counts = await prisma.post.groupBy({
    by: ["boardId"],
    where: { mergedIntoPostId: null },
    _count: { _all: true }
  });
  const countMap = new Map<string, number>();
  counts.forEach((row) => countMap.set(row.boardId, row._count._all));

  const requestMap = new Map<string, "pending" | "approved" | "rejected">();
  if (actorRecord.user) {
    const requests = await prisma.accessRequest.findMany({
      where: { userId: actorRecord.user.id },
      orderBy: { createdAt: "desc" }
    });
    requests.forEach((request) => {
      if (!requestMap.has(request.boardId)) {
        requestMap.set(request.boardId, request.status);
      }
    });
  }

  const result: WorkspaceBoardView[] = [];
  for (const board of boards) {
    const access = computeBoardAccess(board, actor, actorRecord.user, requestMap);
    result.push({
      id: board.id,
      name: board.name,
      visibility: boardVisibility(board),
      allowedSegments: board.allowedSegments,
      access: access.access,
      canPost: access.canPost,
      postCount: access.canRead ? countMap.get(board.id) ?? 0 : 0
    });
  }

  return result;
}

export async function createBoardForCompany(input: {
  name: string;
  visibility: "public" | "private" | "custom";
  allowedSegments?: string[];
}): Promise<{
  id: string;
  name: string;
  visibility: "public" | "private" | "custom";
  allowedSegments: string[];
  isPrivate: boolean;
  postCount: number;
}> {
  const normalizedName = input.name.trim();
  const normalizedSegments = Array.from(
    new Set((input.allowedSegments ?? []).map((segment) => segment.trim().toLowerCase()).filter(Boolean))
  );

  const created = await prisma.board.create({
    data: {
      name: normalizedName,
      visibility: input.visibility,
      isPrivate: input.visibility !== "public",
      allowedSegments: input.visibility === "custom" ? normalizedSegments : [],
      categories: {
        create: {
          name: "General"
        }
      }
    }
  });

  return {
    id: created.id,
    name: created.name,
    visibility: boardVisibility(created),
    allowedSegments: created.allowedSegments,
    isPrivate: created.isPrivate,
    postCount: 0
  };
}

export async function getBoardAccessForActor(
  boardId: string,
  actorCtx: ActorContext | undefined
): Promise<WorkspaceBoardAccess> {
  const actor = asWorkspaceActor(actorCtx);
  const board = await prisma.board.findUnique({
    where: { id: boardId }
  });

  if (!board) {
    return accessFromFlags({ canRead: false, canPost: false, canRequest: false });
  }

  const actorRecord = actor.isAuthenticated ? await upsertActorUser(prisma, actor) : { user: null };
  return computeBoardAccess(board, actor, actorRecord.user);
}

export async function listBoardSettingsForCompany(): Promise<
  Array<{
    id: string;
    name: string;
    visibility: "public" | "private" | "custom";
    allowedSegments: string[];
    isPrivate: boolean;
    postCount: number;
  }>
> {
  const boards = await prisma.board.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          posts: true
        }
      }
    }
  });

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    visibility: boardVisibility(board),
    allowedSegments: board.allowedSegments,
    isPrivate: board.isPrivate,
    postCount: board._count.posts
  }));
}

export async function updateBoardSettingsForCompany(input: {
  boardId: string;
  visibility: "public" | "private" | "custom";
  allowedSegments?: string[];
}): Promise<{
  id: string;
  name: string;
  visibility: "public" | "private" | "custom";
  allowedSegments: string[];
  isPrivate: boolean;
} | null> {
  const existing = await prisma.board.findUnique({
    where: { id: input.boardId }
  });

  if (!existing) {
    return null;
  }

  const normalizedSegments = Array.from(
    new Set((input.allowedSegments ?? []).map((segment) => segment.trim().toLowerCase()).filter(Boolean))
  );

  const board = await prisma.board.update({
    where: { id: input.boardId },
    data: {
      visibility: input.visibility,
      isPrivate: input.visibility !== "public",
      allowedSegments: input.visibility === "custom" ? normalizedSegments : []
    }
  });

  return {
    id: board.id,
    name: board.name,
    visibility: board.visibility,
    allowedSegments: board.allowedSegments,
    isPrivate: board.isPrivate
  };
}

function feedbackWhereClause(params: {
  boardId: string;
  filter: WorkspaceFilterMode;
  search: string;
  includeMerged: boolean;
}): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {
    boardId: params.boardId,
    mergedIntoPostId: params.includeMerged ? undefined : null
  };

  const statuses = filterToDbStatuses(params.filter);
  if (statuses) {
    where.status = {
      in: statuses as PostStatus[]
    };
  }

  const search = params.search.trim();
  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        description: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        ownerName: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        tags: {
          has: search
        }
      }
    ];
  }

  return where;
}

function feedbackOrderBy(sort: WorkspaceSortMode): Prisma.PostOrderByWithRelationInput[] {
  if (sort === "new") {
    return [{ createdAt: "desc" }];
  }

  if (sort === "top") {
    return [{ explicitVoteCount: "desc" }, { implicitVoteCount: "desc" }, { updatedAt: "desc" }];
  }

  return [
    { totalAttachedMrr: "desc" },
    { explicitVoteCount: "desc" },
    { implicitVoteCount: "desc" },
    { updatedAt: "desc" }
  ];
}

export async function listFeedbackForBoard(input: {
  boardId: string;
  actor: ActorContext | undefined;
  sort: WorkspaceSortMode;
  filter: WorkspaceFilterMode;
  search: string;
  includeMerged?: boolean;
  includePrivateComments?: boolean;
}): Promise<{ posts: WorkspacePostView[]; access: WorkspaceBoardAccess }> {
  const board = await prisma.board.findUnique({
    where: { id: input.boardId }
  });

  if (!board) {
    return {
      posts: [],
      access: accessFromFlags({ canRead: false, canPost: false, canRequest: false })
    };
  }

  const actor = asWorkspaceActor(input.actor);
  const actorRecord = actor.isAuthenticated ? await upsertActorUser(prisma, actor) : { user: null };
  const access = computeBoardAccess(board, actor, actorRecord.user);

  if (!access.canRead) {
    return { posts: [], access };
  }

  const posts = await prisma.post.findMany({
    where: feedbackWhereClause({
      boardId: input.boardId,
      filter: input.filter,
      search: input.search,
      includeMerged: input.includeMerged ?? false
    }),
    orderBy: feedbackOrderBy(input.sort),
    include: postInclude
  });

  return {
    posts: posts.map((post) =>
      mapPost(post, {
        includePrivateComments:
          input.includePrivateComments ?? (actor.role === "member" || actor.role === "admin")
      })
    ),
    access
  };
}

export async function listRoadmapForBoard(input: {
  boardId: string;
  actor: ActorContext | undefined;
}): Promise<{
  roadmap: { planned: WorkspacePostView[]; in_progress: WorkspacePostView[]; complete: WorkspacePostView[] };
  access: WorkspaceBoardAccess;
}> {
  const board = await prisma.board.findUnique({
    where: { id: input.boardId }
  });

  if (!board) {
    return {
      roadmap: { planned: [], in_progress: [], complete: [] },
      access: accessFromFlags({ canRead: false, canPost: false, canRequest: false })
    };
  }

  const actor = asWorkspaceActor(input.actor);
  const actorRecord = actor.isAuthenticated ? await upsertActorUser(prisma, actor) : { user: null };
  const access = computeBoardAccess(board, actor, actorRecord.user);

  if (!access.canRead) {
    return {
      roadmap: { planned: [], in_progress: [], complete: [] },
      access
    };
  }

  const posts = await prisma.post.findMany({
    where: {
      boardId: input.boardId,
      mergedIntoPostId: null,
      status: {
        in: ["planned", "upcoming", "in_progress", "complete", "shipped"]
      }
    },
    orderBy: [{ totalAttachedMrr: "desc" }, { explicitVoteCount: "desc" }],
    include: postInclude
  });

  const roadmap = {
    planned: [] as WorkspacePostView[],
    in_progress: [] as WorkspacePostView[],
    complete: [] as WorkspacePostView[]
  };

  posts.forEach((post) => {
    const bucket = roadmapBucket(post.status);
    if (!bucket) {
      return;
    }
    roadmap[bucket].push(
      mapPost(post, {
        includePrivateComments: actor.role === "member" || actor.role === "admin"
      })
    );
  });

  return { roadmap, access };
}

export async function listRoadmapForCompany(input: {
  boardId?: string;
  search?: string;
}): Promise<{
  roadmap: WorkspaceRoadmapView;
  counts: {
    planned: number;
    in_progress: number;
    complete: number;
    total: number;
  };
}> {
  const where: Prisma.PostWhereInput = {
    mergedIntoPostId: null,
    status: {
      in: ["planned", "upcoming", "in_progress", "complete", "shipped"]
    }
  };

  const boardId = input.boardId?.trim();
  if (boardId) {
    where.boardId = boardId;
  }

  const search = input.search?.trim();
  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        description: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        tags: {
          has: search
        }
      }
    ];
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ totalAttachedMrr: "desc" }, { explicitVoteCount: "desc" }, { updatedAt: "desc" }],
    include: postInclude
  });

  const roadmap: WorkspaceRoadmapView = {
    planned: [],
    in_progress: [],
    complete: []
  };

  posts.forEach((post) => {
    const bucket = roadmapBucket(post.status);
    if (!bucket) {
      return;
    }

    roadmap[bucket].push(mapPost(post, { includePrivateComments: true }));
  });

  return {
    roadmap,
    counts: {
      planned: roadmap.planned.length,
      in_progress: roadmap.in_progress.length,
      complete: roadmap.complete.length,
      total: roadmap.planned.length + roadmap.in_progress.length + roadmap.complete.length
    }
  };
}

function mapChangelogEntry(entry: Prisma.ChangelogEntryGetPayload<{
  include: {
    board: {
      select: {
        id: true;
        name: true;
      };
    };
    post: {
      select: {
        id: true;
        title: true;
      };
    };
  };
}>): CompanyChangelogEntryView {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    excerpt: excerptFromHtml(entry.content),
    boardId: entry.boardId,
    boardName: entry.board?.name ?? null,
    postId: entry.postId,
    postTitle: entry.post?.title ?? null,
    tags: entry.tags,
    isPublished: entry.isPublished,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    publishedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null
  };
}

export async function listCompanyChangelog(input: {
  search?: string;
  boardId?: string;
  tag?: string;
  status?: "all" | "published" | "draft";
  page?: number;
  pageSize?: number;
}): Promise<{
  entries: CompanyChangelogEntryView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const search = input.search?.trim() ?? "";
  const boardId = input.boardId?.trim() ?? "";
  const tag = input.tag?.trim() ?? "";
  const status = input.status ?? "all";
  const requestedPage = Number(input.page ?? 1);
  const requestedPageSize = Number(input.pageSize ?? 20);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 20;

  const where: Prisma.ChangelogEntryWhereInput = {
    isPublished: status === "published" ? true : status === "draft" ? false : undefined,
    boardId: boardId || undefined,
    tags: tag ? { has: tag } : undefined
  };

  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        content: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        tags: {
          has: search
        }
      }
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.changelogEntry.findMany({
      where,
      include: {
        board: {
          select: {
            id: true,
            name: true
          }
        },
        post: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.changelogEntry.count({ where })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    entries: entries.map(mapChangelogEntry),
    page,
    pageSize,
    total,
    totalPages
  };
}

export async function getCompanyChangelogEntry(
  entryId: string
): Promise<CompanyChangelogEntryView | null> {
  const entry = await prisma.changelogEntry.findUnique({
    where: { id: entryId },
    include: {
      board: {
        select: {
          id: true,
          name: true
        }
      },
      post: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  return entry ? mapChangelogEntry(entry) : null;
}

export async function listPublishedChangelog(search: string): Promise<
  Array<{
    id: string;
    title: string;
    content: string;
    boardId: string | null;
    tags: string[];
    releasedAt: string;
  }>
> {
  const result = await listCompanyChangelog({
    search,
    status: "published",
    page: 1,
    pageSize: 100
  });

  return result.entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    content: entry.content,
    boardId: entry.boardId,
    tags: entry.tags,
    releasedAt: entry.publishedAt ?? entry.createdAt
  }));
}

export async function getOrCreateActorUser(
  actorCtx: ActorContext | undefined
): Promise<{
  id: string;
  email: string;
  name: string;
  appUserId: string | null;
  segments: string[];
  companyId: string;
  company: {
    id: string;
    name: string;
    monthlySpend: number;
  };
} | null> {
  const actor = asWorkspaceActor(actorCtx);
  if (!actor.isAuthenticated || !actor.email) {
    return null;
  }

  const result = await upsertActorUser(prisma, actor);
  if (!result.user) {
    return null;
  }

  await ensureNotificationPreferences(prisma, result.user.id);
  return result.user;
}

export async function votePostAsActor(input: {
  postId: string;
  actor: ActorContext | undefined;
}): Promise<{ post: WorkspacePostView | null; access: WorkspaceBoardAccess | null }> {
  const actor = asWorkspaceActor(input.actor);
  const actorUser = await getOrCreateActorUser(input.actor);
  if (!actorUser) {
    return { post: null, access: null };
  }

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    include: {
      board: true
    }
  });
  if (!post) {
    return { post: null, access: null };
  }

  const access = computeBoardAccess(post.board, actor, actorUser);
  if (!access.canPost) {
    return { post: null, access };
  }

  await createOrUpgradeVote(actorUser.id, input.postId);
  const updated = await prisma.post.findUnique({
    where: { id: input.postId },
    include: postInclude
  });

  return {
    post: updated ? mapPost(updated, { includePrivateComments: false }) : null,
    access
  };
}

async function firstBoardCategoryId(
  tx: Prisma.TransactionClient,
  boardId: string
): Promise<string | null> {
  const category = await tx.category.findFirst({
    where: { boardId },
    orderBy: { createdAt: "asc" }
  });
  if (category) {
    return category.id;
  }

  const created = await tx.category.create({
    data: {
      boardId,
      name: "General"
    }
  });
  return created.id;
}

export async function createPostAsActor(input: {
  boardId: string;
  title: string;
  details: string;
  actor: ActorContext | undefined;
}): Promise<{ post: WorkspacePostView | null; access: WorkspaceBoardAccess | null }> {
  const actor = asWorkspaceActor(input.actor);
  const actorUser = await getOrCreateActorUser(input.actor);
  if (!actorUser) {
    return { post: null, access: null };
  }

  const board = await prisma.board.findUnique({
    where: { id: input.boardId }
  });
  if (!board) {
    return { post: null, access: null };
  }

  const access = computeBoardAccess(board, actor, actorUser);
  if (!access.canPost) {
    return { post: null, access };
  }

  const createdPost = await prisma.$transaction(async (tx) => {
    const categoryId = await firstBoardCategoryId(tx, input.boardId);
    if (!categoryId) {
      return null;
    }

    const post = await tx.post.create({
      data: {
        boardId: input.boardId,
        categoryId,
        title: input.title,
        description: input.details,
        status: "under_review",
        ownerName: "Unassigned",
        explicitVoteCount: 1,
        totalAttachedMrr: actorUser.company.monthlySpend
      }
    });

    await tx.vote.create({
      data: {
        userId: actorUser.id,
        postId: post.id,
        voteType: "explicit"
      }
    });

    return tx.post.findUnique({
      where: { id: post.id },
      include: postInclude
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return {
    post: createdPost ? mapPost(createdPost, { includePrivateComments: false }) : null,
    access
  };
}

async function createNotificationForUser(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    boardId: string;
    postId?: string;
    type: NotificationType;
    title: string;
    body: string;
  }
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: input.userId,
      boardId: input.boardId,
      postId: input.postId,
      type: input.type,
      title: input.title,
      body: input.body
    }
  });
}

async function notifyCommentEvents(
  tx: Prisma.TransactionClient,
  input: {
    postId: string;
    boardId: string;
    authorUserId: string;
    authorDisplayName: string;
    body: string;
    replyToCommentId: string | null;
    postTitle: string;
  }
): Promise<void> {
  if (input.replyToCommentId) {
    const parent = await tx.comment.findUnique({
      where: { id: input.replyToCommentId },
      include: {
        author: { select: { id: true, email: true, name: true } }
      }
    });
    if (parent && parent.authorId !== input.authorUserId) {
      const pref = await ensureNotificationPreferences(tx, parent.authorId);
      if (pref.commentReplies) {
        await createNotificationForUser(tx, {
          userId: parent.authorId,
          boardId: input.boardId,
          postId: input.postId,
          type: "comment_reply",
          title: "New reply on your comment",
          body: input.authorDisplayName + " replied to your comment."
        });

        // Send email notification asynchronously (don't block the transaction)
        if (parent.author?.email) {
          sendCommentReplyEmail({
            userEmail: parent.author.email,
            userName: parent.author.name ?? parent.author.email,
            postTitle: input.postTitle,
            postId: input.postId,
            commenterName: input.authorDisplayName,
            commentBody: input.body
          }).catch((err) => console.error("[Email] Failed to send comment reply email:", err));
        }
      }
    }
  }

  const mentionEmails = commentMentionEmails(input.body);
  if (!mentionEmails.length) {
    return;
  }

  const mentionedUsers = await tx.user.findMany({
    where: {
      email: {
        in: mentionEmails
      }
    }
  });

  for (const user of mentionedUsers) {
    if (user.id === input.authorUserId) {
      continue;
    }
    const pref = await ensureNotificationPreferences(tx, user.id);
    if (!pref.mentions) {
      continue;
    }
    await createNotificationForUser(tx, {
      userId: user.id,
      boardId: input.boardId,
      postId: input.postId,
      type: "mention",
      title: "You were mentioned",
      body: input.authorDisplayName + " mentioned you in a comment."
    });

    // Send email notification asynchronously
    sendMentionEmail({
      userEmail: user.email,
      userName: user.name ?? user.email,
      postTitle: input.postTitle,
      postId: input.postId,
      mentionerName: input.authorDisplayName,
      commentBody: input.body
    }).catch((err) => console.error("[Email] Failed to send mention email:", err));
  }
}

export async function addCommentAsActor(input: {
  postId: string;
  body: string;
  replyToCommentId?: string;
  actor: ActorContext | undefined;
  isPrivate?: boolean;
}): Promise<{ comment: WorkspaceCommentView | null; access: WorkspaceBoardAccess | null }> {
  const actor = asWorkspaceActor(input.actor);
  const actorUser = await getOrCreateActorUser(input.actor);
  if (!actorUser) {
    return { comment: null, access: null };
  }

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    include: {
      board: true
    }
  });
  if (!post) {
    return { comment: null, access: null };
  }

  const access = computeBoardAccess(post.board, actor, actorUser);
  if (!access.canPost) {
    return { comment: null, access };
  }

  const created = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        postId: input.postId,
        authorId: actorUser.id,
        value: input.body,
        isPrivate: input.isPrivate ?? false,
        replyToCommentId: input.replyToCommentId ?? null
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        replyToComment: {
          include: {
            author: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    await notifyCommentEvents(tx, {
      postId: input.postId,
      boardId: post.boardId,
      authorUserId: actorUser.id,
      authorDisplayName: actorUser.name || actorUser.email,
      body: input.body,
      replyToCommentId: input.replyToCommentId ?? null,
      postTitle: post.title
    });

    return comment;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return { comment: mapComment(created), access };
}

export async function createAccessRequestAsActor(input: {
  boardId: string;
  reason: string;
  actor: ActorContext | undefined;
  emailOverride?: string;
}): Promise<{ request: Prisma.AccessRequestGetPayload<Record<string, never>> | null; access: WorkspaceBoardAccess | null }> {
  const actor = asWorkspaceActor(input.actor);
  const email = normalizeEmail(input.emailOverride || actor.email || "");
  if (!email) {
    return { request: null, access: null };
  }

  const actorForUpsert: WorkspaceActor = {
    role: actor.role,
    isAuthenticated: true,
    email,
    displayName: actor.displayName || email,
    appUserId: actor.appUserId,
    segments: actor.segments
  };
  const actorRecord = await upsertActorUser(prisma, actorForUpsert);
  if (!actorRecord.user) {
    return { request: null, access: null };
  }

  const board = await prisma.board.findUnique({
    where: { id: input.boardId }
  });
  if (!board) {
    return { request: null, access: null };
  }

  const access = computeBoardAccess(board, actorForUpsert, actorRecord.user);
  if (!access.canRequest) {
    return { request: null, access };
  }

  const request = await prisma.accessRequest.create({
    data: {
      userId: actorRecord.user.id,
      boardId: input.boardId,
      reason: input.reason,
      status: "pending"
    }
  });

  return { request, access };
}

export async function listNotificationPreferences(actorCtx: ActorContext | undefined): Promise<{
  productUpdates: boolean;
  commentReplies: boolean;
  mentions: boolean;
  weeklyDigest: boolean;
} | null> {
  const actorUser = await getOrCreateActorUser(actorCtx);
  if (!actorUser) {
    return null;
  }

  return ensureNotificationPreferences(prisma, actorUser.id);
}

export async function updateNotificationPreferencesForActor(
  actorCtx: ActorContext | undefined,
  patch: Partial<{
    productUpdates: boolean;
    commentReplies: boolean;
    mentions: boolean;
    weeklyDigest: boolean;
  }>
): Promise<{
  productUpdates: boolean;
  commentReplies: boolean;
  mentions: boolean;
  weeklyDigest: boolean;
} | null> {
  const actorUser = await getOrCreateActorUser(actorCtx);
  if (!actorUser) {
    return null;
  }

  await ensureNotificationPreferences(prisma, actorUser.id);
  const updated = await prisma.notificationPreference.update({
    where: { userId: actorUser.id },
    data: {
      productUpdates: patch.productUpdates,
      commentReplies: patch.commentReplies,
      mentions: patch.mentions,
      weeklyDigest: patch.weeklyDigest
    }
  });

  return {
    productUpdates: updated.productUpdates,
    commentReplies: updated.commentReplies,
    mentions: updated.mentions,
    weeklyDigest: updated.weeklyDigest
  };
}

export async function listNotificationsForActor(
  actorCtx: ActorContext | undefined
): Promise<
  | {
      notifications: Array<{
        id: string;
        boardId: string;
        postId: string | null;
        type: string;
        title: string;
        body: string;
        readAt: string | null;
        createdAt: string;
      }>;
      unreadCount: number;
    }
  | null
> {
  const actorUser = await getOrCreateActorUser(actorCtx);
  if (!actorUser) {
    return null;
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: actorUser.id },
    orderBy: { createdAt: "desc" }
  });

  return {
    notifications: notifications.map((item) => ({
      id: item.id,
      boardId: item.boardId,
      postId: item.postId,
      type: item.type,
      title: item.title,
      body: item.body,
      readAt: item.readAt ? item.readAt.toISOString() : null,
      createdAt: item.createdAt.toISOString()
    })),
    unreadCount: notifications.filter((item) => !item.readAt).length
  };
}

export async function markNotificationReadForActor(
  actorCtx: ActorContext | undefined,
  notificationId: string
): Promise<boolean> {
  const actorUser = await getOrCreateActorUser(actorCtx);
  if (!actorUser) {
    return false;
  }

  const existing = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: actorUser.id
    }
  });
  if (!existing) {
    return false;
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      readAt: existing.readAt ?? new Date()
    }
  });

  return true;
}

export async function markAllNotificationsReadForActor(actorCtx: ActorContext | undefined): Promise<number> {
  const actorUser = await getOrCreateActorUser(actorCtx);
  if (!actorUser) {
    return 0;
  }

  const updated = await prisma.notification.updateMany({
    where: {
      userId: actorUser.id,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  return updated.count;
}

export async function listCompanyMembers(): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    role: "admin" | "member";
  }>
> {
  const members = await prisma.user.findMany({
    where: {
      role: {
        in: ["admin", "member"]
      }
    },
    orderBy: [{ role: "desc" }, { name: "asc" }]
  });

  return members.map((member) => ({
    id: member.id,
    name: member.name || member.email,
    email: member.email,
    role: member.role === "admin" ? "admin" : "member"
  }));
}

export async function companySummary(): Promise<{
  boardCount: number;
  postCount: number;
  triageCount: number;
  totalAttachedMrr: number;
}> {
  const [boardCount, postCount, triageCount, mrr] = await Promise.all([
    prisma.board.count(),
    prisma.post.count({
      where: { mergedIntoPostId: null }
    }),
    prisma.painEvent.count({
      where: { status: "needs_triage" }
    }),
    prisma.post.aggregate({
      where: { mergedIntoPostId: null },
      _sum: { totalAttachedMrr: true }
    })
  ]);

  return {
    boardCount,
    postCount,
    triageCount,
    totalAttachedMrr: mrr._sum.totalAttachedMrr ?? 0
  };
}

export async function listAccessRequests(): Promise<
  Array<{
    id: string;
    email: string;
    boardId: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
  }>
> {
  const requests = await prisma.accessRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          email: true
        }
      }
    }
  });

  return requests.map((item) => ({
    id: item.id,
    email: item.user.email,
    boardId: item.boardId,
    reason: item.reason,
    status: item.status,
    createdAt: item.createdAt.toISOString()
  }));
}

export async function updateAccessRequestStatus(input: {
  requestId: string;
  status: "pending" | "approved" | "rejected";
}): Promise<{
  id: string;
  status: "pending" | "approved" | "rejected";
  boardId: string;
  userId: string;
} | null> {
  const existing = await prisma.accessRequest.findUnique({
    where: { id: input.requestId }
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.accessRequest.update({
      where: { id: input.requestId },
      data: { status: input.status }
    });

    if (input.status === "approved") {
      const board = await tx.board.findUnique({
        where: { id: request.boardId }
      });
      if (board) {
        await createNotificationForUser(tx, {
          userId: request.userId,
          boardId: request.boardId,
          type: "access_approved",
          title: "Access approved",
          body: "Your access request for " + board.name + " has been approved."
        });
      }
    }

    return request;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return {
    id: updated.id,
    status: updated.status,
    boardId: updated.boardId,
    userId: updated.userId
  };
}

export async function updatePostForCompany(input: {
  postId: string;
  actor: ActorContext | undefined;
  status?: WorkspacePostStatus;
  ownerName?: string;
  eta?: string | null;
  tags?: string[];
}): Promise<WorkspacePostView | null> {
  const actorUser = await getOrCreateActorUser(input.actor);
  const current = await prisma.post.findUnique({
    where: { id: input.postId },
    include: {
      votes: {
        select: {
          userId: true,
          user: { select: { email: true, name: true } }
        }
      }
    }
  });

  if (!current) {
    return null;
  }

  const nextStatus = (input.status ?? normalizePostStatus(current.status)) as PostStatus;
  const etaDate = typeof input.eta === "string" && input.eta ? new Date(input.eta) : input.eta === null ? null : undefined;
  const oldStatus = normalizePostStatus(current.status);

  const updatedPost = await prisma.$transaction(async (tx) => {
    const updated = await tx.post.update({
      where: { id: input.postId },
      data: {
        status: nextStatus,
        ownerName: input.ownerName,
        eta: etaDate,
        tags: input.tags
      }
    });

    if (current.status !== updated.status) {
      const voterUserIds = Array.from(new Set(current.votes.map((vote) => vote.userId))).filter(
        (id) => id !== actorUser?.id
      );
      if (voterUserIds.length) {
        const prefs = await tx.notificationPreference.findMany({
          where: {
            userId: { in: voterUserIds },
            productUpdates: true
          }
        });
        for (const pref of prefs) {
          await createNotificationForUser(tx, {
            userId: pref.userId,
            boardId: updated.boardId,
            postId: updated.id,
            type: "status_change",
            title: "Status updated: " + updated.title,
            body: "Moved to " + normalizePostStatus(updated.status).replace(/_/g, " ") + "."
          });
        }

        // Send status change emails asynchronously (after transaction commits)
        const usersToEmail = current.votes
          .filter((vote) => prefs.some((p) => p.userId === vote.userId) && vote.user?.email)
          .map((vote) => ({
            userId: vote.userId,
            email: vote.user!.email,
            name: vote.user!.name
          }));

        // Queue emails and Slack notifications outside of transaction
        setTimeout(() => {
          for (const voter of usersToEmail) {
            sendStatusChangeEmail({
              userEmail: voter.email,
              userName: voter.name ?? voter.email,
              postTitle: updated.title,
              postId: updated.id,
              boardId: updated.boardId,
              oldStatus: oldStatus,
              newStatus: normalizePostStatus(updated.status)
            }).catch((err) => console.error("[Email] Failed to send status change email:", err));
          }
          
          // Notify Slack channels if this post came from Slack
          notifySlackStatusChange({
            postId: updated.id,
            postTitle: updated.title,
            oldStatus: oldStatus,
            newStatus: normalizePostStatus(updated.status),
            boardId: updated.boardId
          }).catch((err) => console.error("[Slack] Failed to send status notification:", err));

          // Notify Freshdesk tickets if this post came from Freshdesk
          notifyFreshdeskStatusChange({
            postId: updated.id,
            postTitle: updated.title,
            oldStatus: oldStatus,
            newStatus: normalizePostStatus(updated.status)
          }).catch((err) => console.error("[Freshdesk] Failed to send status notification:", err));
        }, 0);
      }
    }

    return tx.post.findUnique({
      where: { id: updated.id },
      include: postInclude
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return updatedPost ? mapPost(updatedPost, { includePrivateComments: true }) : null;
}

export async function bulkUpdatePosts(input: {
  postIds: string[];
  status?: WorkspacePostStatus;
  ownerName?: string;
  eta?: string | null;
  addTags?: string[];
  removeTags?: string[];
}): Promise<WorkspacePostView[]> {
  const posts = await prisma.post.findMany({
    where: {
      id: {
        in: input.postIds
      }
    }
  });

  await prisma.$transaction(async (tx) => {
    for (const post of posts) {
      const nextTags = new Set(post.tags);
      (input.addTags ?? []).forEach((tag) => nextTags.add(tag.trim()));
      (input.removeTags ?? []).forEach((tag) => nextTags.delete(tag.trim()));
      const etaValue = typeof input.eta === "string" && input.eta ? new Date(input.eta) : input.eta === null ? null : undefined;

      await tx.post.update({
        where: { id: post.id },
        data: {
          status: input.status ? (input.status as PostStatus) : undefined,
          ownerName: input.ownerName ?? undefined,
          eta: etaValue,
          tags: Array.from(nextTags).filter(Boolean)
        }
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  const updated = await prisma.post.findMany({
    where: {
      id: {
        in: input.postIds
      }
    },
    include: postInclude
  });

  return updated.map((post) => mapPost(post, { includePrivateComments: true }));
}

export async function mergePosts(input: {
  sourcePostId: string;
  targetPostId: string;
}): Promise<{ source: WorkspacePostView; target: WorkspacePostView } | null> {
  const source = await prisma.post.findUnique({
    where: { id: input.sourcePostId }
  });
  const target = await prisma.post.findUnique({
    where: { id: input.targetPostId }
  });

  if (!source || !target) {
    return null;
  }
  if (source.id === target.id || source.boardId !== target.boardId || source.mergedIntoPostId || target.mergedIntoPostId) {
    return null;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: source.id },
      data: {
        mergedIntoPostId: target.id
      }
    });

    await tx.post.update({
      where: { id: target.id },
      data: {
        explicitVoteCount: { increment: source.explicitVoteCount },
        implicitVoteCount: { increment: source.implicitVoteCount },
        totalAttachedMrr: { increment: source.totalAttachedMrr },
        tags: Array.from(new Set([...target.tags, ...source.tags]))
      }
    });

    const [nextSource, nextTarget] = await Promise.all([
      tx.post.findUnique({ where: { id: source.id }, include: postInclude }),
      tx.post.findUnique({ where: { id: target.id }, include: postInclude })
    ]);

    if (!nextSource || !nextTarget) {
      return null;
    }

    return {
      source: mapPost(nextSource, { includePrivateComments: true }),
      target: mapPost(nextTarget, { includePrivateComments: true })
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return result;
}

export async function unmergePost(sourcePostId: string): Promise<{ source: WorkspacePostView; target: WorkspacePostView } | null> {
  const source = await prisma.post.findUnique({
    where: { id: sourcePostId }
  });

  if (!source || !source.mergedIntoPostId) {
    return null;
  }

  const target = await prisma.post.findUnique({
    where: { id: source.mergedIntoPostId }
  });
  if (!target) {
    return null;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: source.id },
      data: {
        mergedIntoPostId: null
      }
    });

    await tx.post.update({
      where: { id: target.id },
      data: {
        explicitVoteCount: { decrement: source.explicitVoteCount },
        implicitVoteCount: { decrement: source.implicitVoteCount },
        totalAttachedMrr: { decrement: source.totalAttachedMrr }
      }
    });

    const [nextSource, nextTarget] = await Promise.all([
      tx.post.findUnique({ where: { id: source.id }, include: postInclude }),
      tx.post.findUnique({ where: { id: target.id }, include: postInclude })
    ]);

    if (!nextSource || !nextTarget) {
      return null;
    }

    return {
      source: mapPost(nextSource, { includePrivateComments: true }),
      target: mapPost(nextTarget, { includePrivateComments: true })
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return result;
}

export async function listMergedSources(postId: string): Promise<WorkspacePostView[]> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      mergedSourcePosts: {
        include: postInclude
      }
    }
  });

  if (!post) {
    return [];
  }

  return post.mergedSourcePosts.map((item) => mapPost(item, { includePrivateComments: true }));
}

export async function listSavedFiltersForActor(actorCtx: ActorContext | undefined): Promise<
  Array<{
    id: string;
    name: string;
    criteria: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const actorUser = await getOrCreateActorUser(actorCtx);
  if (!actorUser) {
    return [];
  }

  const filters = await prisma.savedFilter.findMany({
    where: {
      userId: actorUser.id
    },
    orderBy: { createdAt: "desc" }
  });

  return filters.map((item) => ({
    id: item.id,
    name: item.name,
    criteria: (item.criteria as Record<string, unknown>) ?? {},
    createdAt: item.createdAt.toISOString()
  }));
}

export async function createSavedFilterForActor(input: {
  actor: ActorContext | undefined;
  name: string;
  criteria: Record<string, unknown>;
}): Promise<{
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  createdAt: string;
} | null> {
  const actorUser = await getOrCreateActorUser(input.actor);
  if (!actorUser) {
    return null;
  }

  const created = await prisma.savedFilter.create({
    data: {
      userId: actorUser.id,
      name: input.name.trim(),
      criteria: input.criteria as Prisma.InputJsonValue
    }
  });

  return {
    id: created.id,
    name: created.name,
    criteria: created.criteria as Record<string, unknown>,
    createdAt: created.createdAt.toISOString()
  };
}

export async function deleteSavedFilterForActor(input: {
  actor: ActorContext | undefined;
  savedFilterId: string;
}): Promise<boolean> {
  const actorUser = await getOrCreateActorUser(input.actor);
  if (!actorUser) {
    return false;
  }

  const existing = await prisma.savedFilter.findFirst({
    where: {
      id: input.savedFilterId,
      userId: actorUser.id
    }
  });
  if (!existing) {
    return false;
  }

  await prisma.savedFilter.delete({
    where: { id: input.savedFilterId }
  });
  return true;
}

export async function listOpportunities(boardId?: string): Promise<
  Array<{
    postId: string;
    title: string;
    voteCount: number;
    attachedMrr: number;
    opportunityScore: number;
  }>
> {
  const posts = await prisma.post.findMany({
    where: {
      boardId: boardId || undefined,
      mergedIntoPostId: null
    },
    orderBy: { totalAttachedMrr: "desc" }
  });

  return posts
    .map((post) => ({
      postId: post.id,
      title: post.title,
      voteCount: post.explicitVoteCount + post.implicitVoteCount,
      attachedMrr: post.totalAttachedMrr,
      opportunityScore: Number((post.totalAttachedMrr * 0.65 + (post.explicitVoteCount + post.implicitVoteCount) * 24).toFixed(2))
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export async function listPainEventsForTriage(input?: {
  status?: "needs_triage" | "auto_merged" | "all";
  source?: "freshdesk" | "zoom" | "all";
  search?: string;
  minMrr?: number;
  page?: number;
  pageSize?: number;
  actor?: ActorContext;
}): Promise<{
  events: Array<{
    id: string;
    title: string;
    description: string;
    boardId: string;
    requesterEmail: string;
    requesterCompany: string;
    companyMrr: number;
    rawText: string;
    source: "freshdesk" | "zoom";
    status: "needs_triage" | "auto_merged";
    visibilityScope: "central" | "individual";
    suggestedPostId?: string;
    suggestedPostTitle?: string;
    recommendedMergeCandidates: TriageMergeCandidateView[];
    recommendedCreate:
      | {
          boardId: string;
          boardName: string;
          title: string;
          description: string;
        }
      | null;
    confidenceScore: number | null;
    actionStatus: "approved" | "pending_review" | "revoked" | null;
    createdAt: string;
    updatedAt: string;
  }>;
  summary: {
    needsTriage: number;
    merged: number;
    total: number;
  };
  config: {
    sources: AiInboxSourceConfigView[];
  };
}> {
  const status = input?.status ?? "needs_triage";
  const source = input?.source ?? "all";
  const search = input?.search?.trim() ?? "";
  const requestedMinMrr = Number(input?.minMrr ?? 0);
  const requestedPage = Number(input?.page ?? 1);
  const requestedPageSize = Number(input?.pageSize ?? 50);
  const minMrr = Number.isFinite(requestedMinMrr) ? Math.max(0, requestedMinMrr) : 0;
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 50;
  const actor = asWorkspaceActor(input?.actor);
  const actorRecord = actor.isAuthenticated ? await upsertActorUser(prisma, actor) : { user: null };

  const where: Prisma.PainEventWhereInput = {
    status:
      status === "all"
        ? {
            in: ["needs_triage", "auto_merged"]
          }
        : status,
    source: source === "all" ? undefined : source
  };

  if (search) {
    where.OR = [
      {
        rawText: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        user: {
          email: {
            contains: search,
            mode: "insensitive"
          }
        }
      },
      {
        user: {
          company: {
            name: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      },
      {
        matchedPost: {
          title: {
            contains: search,
            mode: "insensitive"
          }
        }
      }
    ];
  }

  const [configBySource, events, boards, candidatePosts] = await Promise.all([
    ensureAiInboxConfig(prisma),
    prisma.painEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          include: {
            company: true
          }
        },
        aiActionLog: true,
        matchedPost: {
          select: {
            id: true,
            boardId: true,
            title: true
          }
        }
      }
    }),
    prisma.board.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.post.findMany({
      where: {
        mergedIntoPostId: null
      },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        status: true,
        boardId: true,
        totalAttachedMrr: true,
        explicitVoteCount: true,
        implicitVoteCount: true,
        board: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ totalAttachedMrr: "desc" }, { updatedAt: "desc" }],
      take: 120
    })
  ]);

  const triageCandidates: TriageCandidatePost[] = candidatePosts.map((post) => ({
    id: post.id,
    title: post.title,
    description: post.description,
    tags: post.tags,
    status: post.status,
    boardId: post.boardId,
    boardName: post.board.name,
    attachedMrr: post.totalAttachedMrr,
    voteCount: post.explicitVoteCount + post.implicitVoteCount
  }));

  const actorEmail = actor.email ? normalizeEmail(actor.email) : "";
  const visibleEvents = events.filter((event) => {
    const sourceConfig = configBySource[event.source as AiInboxSourceKey];

    if (!sourceConfig.enabled) {
      return false;
    }

    if (Number(event.user.company.monthlySpend || 0) < minMrr) {
      return false;
    }

    if (sourceConfig.routingMode === "central") {
      return true;
    }

    if (!actorRecord.user) {
      return false;
    }

    return event.userId === actorRecord.user.id || normalizeEmail(event.user.email) === actorEmail;
  });

  const mappedEvents = visibleEvents.map((event) => {
    const mergeCandidates = buildTriageMergeCandidates({
      rawText: event.rawText,
      matchedPostId: event.matchedPostId,
      posts: triageCandidates
    });

    const suggestedMerge = mergeCandidates[0];
    const recommendedBoard = pickRecommendedBoard({
      rawText: event.rawText,
      mergeCandidates,
      boards
    });
    const sourceConfig = configBySource[event.source as AiInboxSourceKey];
    const title = derivePainEventTitle(event.rawText);

    const mappedStatus: "needs_triage" | "auto_merged" =
      event.status === "needs_triage" ? "needs_triage" : "auto_merged";
    const mappedSource = event.source as "freshdesk" | "zoom";

    return {
      id: event.id,
      title,
      description: event.rawText,
      boardId: suggestedMerge?.boardId ?? event.matchedPost?.boardId ?? "",
      requesterEmail: event.user.email,
      requesterCompany: event.user.company.name,
      companyMrr: event.user.company.monthlySpend,
      rawText: event.rawText,
      source: mappedSource,
      status: mappedStatus,
      visibilityScope: sourceConfig.routingMode,
      suggestedPostId: suggestedMerge?.postId ?? event.matchedPostId ?? undefined,
      suggestedPostTitle: suggestedMerge?.postTitle ?? event.matchedPost?.title ?? undefined,
      recommendedMergeCandidates: mergeCandidates,
      recommendedCreate: recommendedBoard
        ? {
            boardId: recommendedBoard.boardId,
            boardName: recommendedBoard.boardName,
            title,
            description: event.rawText
          }
        : null,
      confidenceScore: event.aiActionLog?.confidenceScore ?? null,
      actionStatus: event.aiActionLog?.status ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    };
  });

  const needsTriage = mappedEvents.filter((event) => event.status === "needs_triage").length;
  const merged = mappedEvents.filter((event) => event.status === "auto_merged").length;

  return {
    events: mappedEvents,
    summary: {
      needsTriage,
      merged,
      total: needsTriage + merged
    },
    config: {
      sources: Object.values(configBySource).sort((a, b) => a.source.localeCompare(b.source))
    }
  };
}

export async function listAiInboxConfig(): Promise<{
  sources: AiInboxSourceConfigView[];
}> {
  const configBySource = await ensureAiInboxConfig(prisma);

  return {
    sources: Object.values(configBySource).sort((a, b) => a.source.localeCompare(b.source))
  };
}

export async function updateAiInboxConfig(input: {
  source: AiInboxSourceKey;
  routingMode: AiInboxRoutingModeView;
  enabled: boolean;
}): Promise<AiInboxSourceConfigView> {
  const next = await prisma.aiInboxConfig.upsert({
    where: {
      source: input.source as PainEventSource
    },
    update: {
      routingMode: input.routingMode as AiInboxRoutingMode,
      enabled: input.enabled
    },
    create: {
      source: input.source as PainEventSource,
      routingMode: input.routingMode as AiInboxRoutingMode,
      enabled: input.enabled
    }
  });

  return {
    source: next.source as AiInboxSourceKey,
    routingMode: next.routingMode as AiInboxRoutingModeView,
    enabled: next.enabled,
    updatedAt: next.updatedAt.toISOString()
  };
}

export async function createIdeaFromPainEvent(input: {
  painEventId: string;
  boardId?: string;
  title?: string;
  details?: string;
}): Promise<{
  postId: string;
  boardId: string;
  boardName: string;
  title: string;
} | null> {
  const painEvent = await prisma.painEvent.findUnique({
    where: {
      id: input.painEventId
    },
    include: {
      user: {
        include: {
          company: true
        }
      },
      matchedPost: {
        select: {
          boardId: true
        }
      }
    }
  });
  if (!painEvent) {
    return null;
  }

  const [boards, candidatePosts] = await Promise.all([
    prisma.board.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.post.findMany({
      where: {
        mergedIntoPostId: null
      },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        status: true,
        boardId: true,
        totalAttachedMrr: true,
        explicitVoteCount: true,
        implicitVoteCount: true,
        board: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ totalAttachedMrr: "desc" }, { updatedAt: "desc" }],
      take: 120
    })
  ]);

  if (!boards.length) {
    return null;
  }

  const requestedBoardId = input.boardId?.trim() || "";
  let resolvedBoardId = requestedBoardId;

  if (requestedBoardId && !boards.some((board) => board.id === requestedBoardId)) {
    return null;
  }

  if (!resolvedBoardId) {
    resolvedBoardId = painEvent.matchedPost?.boardId ?? "";
  }

  if (!resolvedBoardId) {
    const triageCandidates: TriageCandidatePost[] = candidatePosts.map((post) => ({
      id: post.id,
      title: post.title,
      description: post.description,
      tags: post.tags,
      status: post.status,
      boardId: post.boardId,
      boardName: post.board.name,
      attachedMrr: post.totalAttachedMrr,
      voteCount: post.explicitVoteCount + post.implicitVoteCount
    }));

    const mergeCandidates = buildTriageMergeCandidates({
      rawText: painEvent.rawText,
      matchedPostId: painEvent.matchedPostId,
      posts: triageCandidates
    });

    const recommendedBoard = pickRecommendedBoard({
      rawText: painEvent.rawText,
      mergeCandidates,
      boards
    });

    resolvedBoardId = recommendedBoard?.boardId ?? boards[0].id;
  }

  const board = boards.find((item) => item.id === resolvedBoardId);
  if (!board) {
    return null;
  }

  const title = (input.title || "").trim() || derivePainEventTitle(painEvent.rawText);
  const details = (input.details || "").trim() || painEvent.rawText;

  const post = await prisma.$transaction(async (tx) => {
    let category = await tx.category.findFirst({
      where: {
        boardId: board.id
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (!category) {
      category = await tx.category.create({
        data: {
          boardId: board.id,
          name: "General"
        }
      });
    }

    const created = await tx.post.create({
      data: {
        boardId: board.id,
        categoryId: category.id,
        title,
        description: details,
        status: "under_review"
      }
    });

    const actionLog = await tx.aiActionLog.upsert({
      where: {
        painEventId: painEvent.id
      },
      update: {
        actionTaken: "suggested_new",
        confidenceScore: 1,
        status: "approved"
      },
      create: {
        painEventId: painEvent.id,
        actionTaken: "suggested_new",
        confidenceScore: 1,
        status: "approved"
      }
    });

    await tx.vote.create({
      data: {
        userId: painEvent.userId,
        postId: created.id,
        voteType: "implicit",
        aiActionLogId: actionLog.id
      }
    });

    await tx.post.update({
      where: {
        id: created.id
      },
      data: {
        implicitVoteCount: {
          increment: 1
        },
        totalAttachedMrr: {
          increment: painEvent.user.company.monthlySpend
        }
      }
    });

    await tx.painEvent.update({
      where: {
        id: painEvent.id
      },
      data: {
        status: "auto_merged",
        matchedPostId: created.id
      }
    });

    return created;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return {
    postId: post.id,
    boardId: board.id,
    boardName: board.name,
    title: post.title
  };
}

export async function mergePainEventIntoPost(input: {
  painEventId: string;
  postId: string;
}): Promise<boolean> {
  const painEvent = await prisma.painEvent.findUnique({
    where: { id: input.painEventId },
    include: {
      user: {
        include: { company: true }
      }
    }
  });
  if (!painEvent) {
    return false;
  }

  const post = await prisma.post.findUnique({
    where: { id: input.postId }
  });
  if (!post) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    const actionLog = await tx.aiActionLog.upsert({
      where: { painEventId: painEvent.id },
      update: {
        actionTaken: "auto_upvote",
        confidenceScore: 1,
        status: "approved"
      },
      create: {
        painEventId: painEvent.id,
        actionTaken: "auto_upvote",
        confidenceScore: 1,
        status: "approved"
      }
    });

    const existingVote = await tx.vote.findUnique({
      where: {
        userId_postId: {
          userId: painEvent.userId,
          postId: post.id
        }
      }
    });

    if (!existingVote) {
      await tx.vote.create({
        data: {
          userId: painEvent.userId,
          postId: post.id,
          voteType: "implicit",
          aiActionLogId: actionLog.id
        }
      });

      await tx.post.update({
        where: { id: post.id },
        data: {
          implicitVoteCount: { increment: 1 },
          totalAttachedMrr: { increment: painEvent.user.company.monthlySpend }
        }
      });
    }

    await tx.painEvent.update({
      where: { id: painEvent.id },
      data: {
        status: "auto_merged",
        matchedPostId: post.id
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return true;
}

export async function createChangelogEntry(input: {
  entryId?: string;
  boardId: string;
  title: string;
  content: string;
  tags?: string[];
  isPublished?: boolean;
}): Promise<{
  id: string;
  title: string;
  content: string;
  boardId: string | null;
  tags: string[];
  isPublished: boolean;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}> {
  const latestCompletePost = await prisma.post.findFirst({
    where: {
      boardId: input.boardId,
      status: {
        in: ["complete", "shipped"]
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const shouldPublish = input.isPublished !== false;
  const normalizedTags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));

  const entry = await prisma.$transaction(async (tx) => {
    if (input.entryId) {
      return tx.changelogEntry.update({
        where: {
          id: input.entryId
        },
        data: {
          boardId: input.boardId,
          postId: latestCompletePost?.id ?? null,
          title: input.title.trim(),
          content: input.content,
          tags: normalizedTags,
          isPublished: shouldPublish,
          publishedAt: shouldPublish ? new Date() : null
        }
      });
    }

    return tx.changelogEntry.create({
      data: {
        boardId: input.boardId,
        postId: latestCompletePost?.id ?? null,
        title: input.title.trim(),
        content: input.content,
        tags: normalizedTags,
        isPublished: shouldPublish,
        publishedAt: shouldPublish ? new Date() : null
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    boardId: entry.boardId,
    tags: entry.tags,
    isPublished: entry.isPublished,
    releasedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

export async function getPostForActor(input: {
  postId: string;
  actor: ActorContext | undefined;
  includePrivateComments?: boolean;
}): Promise<{ post: WorkspacePostView | null; access: WorkspaceBoardAccess | null }> {
  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    include: {
      ...postInclude,
      board: true
    }
  });

  if (!post) {
    return { post: null, access: null };
  }

  const actor = asWorkspaceActor(input.actor);
  const actorUser = actor.isAuthenticated ? await upsertActorUser(prisma, actor) : { user: null };
  const access = computeBoardAccess(post.board, actor, actorUser.user);

  if (!access.canRead) {
    return { post: null, access };
  }

  return {
    post: mapPost(post, {
      includePrivateComments:
        input.includePrivateComments ?? (actor.role === "member" || actor.role === "admin")
    }),
    access
  };
}

export async function getPostVoterInsights(postId: string): Promise<WorkspacePostVoterInsightsView | null> {
  const selected = await prisma.post.findUnique({
    where: {
      id: postId
    },
    select: {
      id: true,
      boardId: true
    }
  });

  if (!selected) {
    return null;
  }

  // Only fetch posts from the same board to limit scope (merged posts are typically on same board)
  // Plus any posts that reference or are referenced by this post
  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { boardId: selected.boardId },
        { mergedIntoPostId: postId },
        { id: postId }
      ]
    },
    select: {
      id: true,
      title: true,
      boardId: true,
      mergedIntoPostId: true,
      status: true,
      totalAttachedMrr: true,
      board: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  const postMap = new Map(posts.map((post) => [post.id, post]));
  const rootCache = new Map<string, string>();

  function rootPostIdOf(postIdValue: string): string {
    const cached = rootCache.get(postIdValue);
    if (cached) {
      return cached;
    }

    let currentId = postIdValue;
    const visited: string[] = [];

    while (true) {
      const current = postMap.get(currentId);
      if (!current || !current.mergedIntoPostId) {
        break;
      }
      visited.push(currentId);
      currentId = current.mergedIntoPostId;
      if (visited.includes(currentId)) {
        break;
      }
    }

    rootCache.set(postIdValue, currentId);
    visited.forEach((id) => rootCache.set(id, currentId));
    return currentId;
  }

  const canonicalPostId = rootPostIdOf(postId);
  const canonicalPost = postMap.get(canonicalPostId);
  if (!canonicalPost) {
    return null;
  }

  const mergedIdeaPosts = posts
    .filter((post) => rootPostIdOf(post.id) === canonicalPostId)
    .sort((a, b) => {
      if (a.id === canonicalPostId) {
        return -1;
      }
      if (b.id === canonicalPostId) {
        return 1;
      }
      return a.title.localeCompare(b.title);
    });

  const mergedIdeaPostIds = mergedIdeaPosts.map((post) => post.id);

  const votesInIdea = await prisma.vote.findMany({
    where: {
      postId: {
        in: mergedIdeaPostIds
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              name: true,
              monthlySpend: true
            }
          }
        }
      }
    }
  });

  const voterUserIds = Array.from(new Set(votesInIdea.map((vote) => vote.userId))).slice(0, 100); // Limit voters to prevent timeout
  const allVotesForVoters = voterUserIds.length
    ? await prisma.vote.findMany({
        where: {
          userId: {
            in: voterUserIds
          }
        },
        take: 5000, // Limit total votes fetched
        include: {
          post: {
            select: {
              id: true,
              title: true,
              boardId: true,
              status: true,
              mergedIntoPostId: true,
              totalAttachedMrr: true,
              board: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })
    : [];

  const votesInIdeaByUser = new Map<string, typeof votesInIdea>();
  votesInIdea.forEach((vote) => {
    if (!votesInIdeaByUser.has(vote.userId)) {
      votesInIdeaByUser.set(vote.userId, []);
    }
    votesInIdeaByUser.get(vote.userId)?.push(vote);
  });

  const allVotesByUser = new Map<string, typeof allVotesForVoters>();
  allVotesForVoters.forEach((vote) => {
    if (!allVotesByUser.has(vote.userId)) {
      allVotesByUser.set(vote.userId, []);
    }
    allVotesByUser.get(vote.userId)?.push(vote);
  });

  const voters: WorkspacePostVoterInsightView[] = voterUserIds
    .map((userId) => {
      const ideaVotes = votesInIdeaByUser.get(userId) ?? [];
      if (!ideaVotes.length) {
        return null;
      }

      const user = ideaVotes[0].user;
      const voteTypeSet = new Set<"implicit" | "explicit">();
      const votedPostIdSet = new Set<string>();
      const votedPostTitleSet = new Set<string>();

      ideaVotes.forEach((vote) => {
        voteTypeSet.add(vote.voteType as "implicit" | "explicit");
        votedPostIdSet.add(vote.postId);
        const votedPost = postMap.get(vote.postId);
        votedPostTitleSet.add(votedPost?.title ?? vote.postId);
      });

      const otherIdeaByCanonicalPost = new Map<string, WorkspacePostVoterOtherIdeaView>();
      (allVotesByUser.get(userId) ?? []).forEach((vote) => {
        const canonicalForVote = rootPostIdOf(vote.post.id);
        if (canonicalForVote === canonicalPostId) {
          return;
        }

        const canonicalPostForVote = postMap.get(canonicalForVote) ?? vote.post;
        const existing = otherIdeaByCanonicalPost.get(canonicalForVote);
        const nextVoteType = vote.voteType as "implicit" | "explicit";
        const mergedVoteType =
          existing && (existing.voteType === "explicit" || nextVoteType === "explicit")
            ? "explicit"
            : nextVoteType;

        otherIdeaByCanonicalPost.set(canonicalForVote, {
          postId: canonicalForVote,
          title: canonicalPostForVote.title,
          boardId: canonicalPostForVote.boardId,
          boardName: canonicalPostForVote.board?.name ?? "Unknown board",
          status: normalizePostStatus(canonicalPostForVote.status),
          attachedMrr: canonicalPostForVote.totalAttachedMrr,
          voteType: mergedVoteType
        });
      });

      const otherUpvotedIdeas = Array.from(otherIdeaByCanonicalPost.values()).sort((a, b) => {
        return b.attachedMrr - a.attachedMrr || a.title.localeCompare(b.title);
      });

      return {
        userId,
        userName: user.name || user.email,
        userEmail: user.email,
        userCreatedAt: user.createdAt.toISOString(),
        companyId: user.company.id,
        companyName: user.company.name,
        companyMrr: user.company.monthlySpend,
        voteTypesInIdea: Array.from(voteTypeSet.values()).sort((a, b) => a.localeCompare(b)),
        votedIdeaPostIds: Array.from(votedPostIdSet.values()),
        votedIdeaPostTitles: Array.from(votedPostTitleSet.values()),
        otherUpvotedIdeas
      } satisfies WorkspacePostVoterInsightView;
    })
    .filter((item): item is WorkspacePostVoterInsightView => Boolean(item))
    .sort((a, b) => {
      return b.companyMrr - a.companyMrr || a.userName.localeCompare(b.userName);
    })
    .slice(0, 100); // Limit to top 100 voters to prevent timeouts

  const companyMrrById = new Map<string, number>();
  voters.forEach((voter) => {
    if (!companyMrrById.has(voter.companyId)) {
      companyMrrById.set(voter.companyId, voter.companyMrr);
    }
  });
  const totalCompanyMrr = Array.from(companyMrrById.values()).reduce((sum, mrr) => sum + mrr, 0);

  return {
    canonicalPostId,
    canonicalPostTitle: canonicalPost.title,
    boardId: canonicalPost.boardId,
    boardName: canonicalPost.board.name,
    mergedIdeaPostIds,
    mergedIdeaPosts: mergedIdeaPosts.map((post) => ({
      id: post.id,
      title: post.title,
      mergedIntoPostId: post.mergedIntoPostId
    })),
    summary: {
      totalVoters: voters.length,
      uniqueCompanies: companyMrrById.size,
      totalCompanyMrr
    },
    voters
  };
}

export async function listFeedbackForCompany(input: {
  boardId: string;
  sort: WorkspaceSortMode;
  filter: WorkspaceFilterMode;
  search: string;
  includeMerged?: boolean;
}): Promise<WorkspacePostView[]> {
  const where = feedbackWhereClause({
    boardId: input.boardId,
    filter: input.filter,
    search: input.search,
    includeMerged: input.includeMerged ?? false
  });

  const posts = await prisma.post.findMany({
    where,
    orderBy: feedbackOrderBy(input.sort),
    take: 200, // Limit results for performance
    include: postInclude
  });

  return posts.map((post) => mapPost(post, { includePrivateComments: true }));
}

export async function listCustomerRelationships(input?: {
  search?: string;
  boardId?: string;
  minMrr?: number;
}): Promise<{
  customers: WorkspaceCustomerRelationshipView[];
  summary: {
    totalCustomers: number;
    totalLinkedIdeas: number;
    totalCustomerMrr: number;
  };
}> {
  const search = String(input?.search ?? "").trim().toLowerCase();
  const boardId = String(input?.boardId ?? "").trim();
  const minMrr = Number.isFinite(Number(input?.minMrr ?? 0)) ? Math.max(0, Number(input?.minMrr ?? 0)) : 0;

  const [posts, votes] = await Promise.all([
    prisma.post.findMany({
      take: 1000, // Limit for performance
      select: {
        id: true,
        title: true,
        boardId: true,
        mergedIntoPostId: true,
        status: true,
        totalAttachedMrr: true,
        board: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.vote.findMany({
      where: {
        post: boardId
          ? {
              boardId
            }
          : undefined
      },
      take: 5000, // Limit for performance
      include: {
        user: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                monthlySpend: true
              }
            }
          }
        },
        post: {
          select: {
            id: true,
            title: true,
            boardId: true,
            mergedIntoPostId: true,
            status: true,
            totalAttachedMrr: true,
            board: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post]));
  const rootCache = new Map<string, string>();

  function rootPostIdOf(postIdValue: string): string {
    const cached = rootCache.get(postIdValue);
    if (cached) {
      return cached;
    }

    let currentId = postIdValue;
    const visited: string[] = [];

    while (true) {
      const current = postMap.get(currentId);
      if (!current || !current.mergedIntoPostId) {
        break;
      }
      visited.push(currentId);
      currentId = current.mergedIntoPostId;
      if (visited.includes(currentId)) {
        break;
      }
    }

    rootCache.set(postIdValue, currentId);
    visited.forEach((id) => rootCache.set(id, currentId));
    return currentId;
  }

  type MutableLink = WorkspaceCustomerIdeaLinkView & { sourcePostIdSet: Set<string> };
  type MutableVoter = {
    userId: string;
    userName: string;
    userEmail: string;
    linkedIdeaSet: Set<string>;
    explicitVoteCount: number;
    implicitVoteCount: number;
  };
  type MutableCustomer = {
    companyId: string;
    companyName: string;
    companyMrr: number;
    linkMap: Map<string, MutableLink>;
    voterMap: Map<string, MutableVoter>;
  };

  const customerMap = new Map<string, MutableCustomer>();

  votes.forEach((vote) => {
    const canonicalPostId = rootPostIdOf(vote.post.id);
    const canonicalPost = postMap.get(canonicalPostId) ?? vote.post;
    const companyId = vote.user.company.id;

    let customer = customerMap.get(companyId);
    if (!customer) {
      customer = {
        companyId,
        companyName: vote.user.company.name,
        companyMrr: vote.user.company.monthlySpend,
        linkMap: new Map(),
        voterMap: new Map()
      };
      customerMap.set(companyId, customer);
    }

    const existingLink = customer.linkMap.get(canonicalPostId);
    const nextVoteType =
      existingLink && (existingLink.voteType === "explicit" || vote.voteType === "explicit")
        ? "explicit"
        : (vote.voteType as "implicit" | "explicit");

    if (!existingLink) {
      customer.linkMap.set(canonicalPostId, {
        postId: canonicalPostId,
        title: canonicalPost.title,
        boardId: canonicalPost.boardId,
        boardName: canonicalPost.board?.name ?? "Unknown board",
        status: normalizePostStatus(canonicalPost.status),
        attachedMrr: canonicalPost.totalAttachedMrr,
        voteType: nextVoteType,
        sourcePostIds: [vote.postId],
        sourcePostIdSet: new Set([vote.postId])
      });
    } else {
      existingLink.voteType = nextVoteType;
      existingLink.sourcePostIdSet.add(vote.postId);
      existingLink.sourcePostIds = Array.from(existingLink.sourcePostIdSet.values());
    }

    let voter = customer.voterMap.get(vote.userId);
    if (!voter) {
      voter = {
        userId: vote.userId,
        userName: vote.user.name || vote.user.email,
        userEmail: vote.user.email,
        linkedIdeaSet: new Set(),
        explicitVoteCount: 0,
        implicitVoteCount: 0
      };
      customer.voterMap.set(vote.userId, voter);
    }

    voter.linkedIdeaSet.add(canonicalPostId);
    if (vote.voteType === "explicit") {
      voter.explicitVoteCount += 1;
    } else {
      voter.implicitVoteCount += 1;
    }
  });

  const customers = Array.from(customerMap.values())
    .map((customer) => {
      const linkedIdeas = Array.from(customer.linkMap.values())
        .map((link) => ({
          postId: link.postId,
          title: link.title,
          boardId: link.boardId,
          boardName: link.boardName,
          status: link.status,
          attachedMrr: link.attachedMrr,
          voteType: link.voteType,
          sourcePostIds: link.sourcePostIds
        }))
        .sort((a, b) => b.attachedMrr - a.attachedMrr || a.title.localeCompare(b.title));

      const voters = Array.from(customer.voterMap.values())
        .map((voter) => ({
          userId: voter.userId,
          userName: voter.userName,
          userEmail: voter.userEmail,
          linkedIdeaCount: voter.linkedIdeaSet.size,
          explicitVoteCount: voter.explicitVoteCount,
          implicitVoteCount: voter.implicitVoteCount
        }))
        .sort((a, b) => b.linkedIdeaCount - a.linkedIdeaCount || a.userName.localeCompare(b.userName));

      const explicitIdeaCount = linkedIdeas.filter((idea) => idea.voteType === "explicit").length;
      const implicitIdeaCount = linkedIdeas.filter((idea) => idea.voteType === "implicit").length;

      return {
        companyId: customer.companyId,
        companyName: customer.companyName,
        companyMrr: customer.companyMrr,
        uniqueVoterCount: voters.length,
        totalLinkedIdeas: linkedIdeas.length,
        explicitIdeaCount,
        implicitIdeaCount,
        voters,
        linkedIdeas
      } satisfies WorkspaceCustomerRelationshipView;
    })
    .filter((customer) => customer.companyMrr >= minMrr)
    .filter((customer) => {
      if (!search) {
        return true;
      }

      const haystack = [
        customer.companyName,
        customer.voters.map((voter) => voter.userName + " " + voter.userEmail).join(" "),
        customer.linkedIdeas.map((idea) => idea.title).join(" ")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => b.companyMrr - a.companyMrr || b.totalLinkedIdeas - a.totalLinkedIdeas || a.companyName.localeCompare(b.companyName));

  const summary = {
    totalCustomers: customers.length,
    totalLinkedIdeas: customers.reduce((sum, customer) => sum + customer.totalLinkedIdeas, 0),
    totalCustomerMrr: customers.reduce((sum, customer) => sum + customer.companyMrr, 0)
  };

  return {
    customers,
    summary
  };
}

export async function exportPostsRows(): Promise<
  Array<[string, string, string, string, string, string, number, number, number]>
> {
  const posts = await prisma.post.findMany({
    include: {
      comments: {
        select: {
          id: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return posts.map((post) => [
    post.id,
    post.boardId,
    post.title,
    normalizePostStatus(post.status),
    post.ownerName,
    post.eta ? post.eta.toISOString().slice(0, 10) : "",
    post.explicitVoteCount + post.implicitVoteCount,
    post.comments.length,
    post.totalAttachedMrr
  ]);
}

export async function exportCommentRows(): Promise<
  Array<[string, string, string, string, string, string, string]>
> {
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        select: {
          id: true,
          title: true
        }
      },
      author: {
        select: {
          name: true,
          email: true
        }
      },
      replyToComment: {
        include: {
          author: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  return comments.map((comment) => [
    comment.id,
    comment.post.id,
    comment.post.title,
    comment.author.name || comment.author.email,
    comment.replyToComment ? comment.replyToComment.author.name || comment.replyToComment.author.email : "",
    comment.createdAt.toISOString(),
    comment.value
  ]);
}
