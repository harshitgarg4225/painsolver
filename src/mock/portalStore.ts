export type PortalSortMode = "trending" | "top" | "new";
export type PortalFilterMode =
  | "all"
  | "under_review"
  | "upcoming"
  | "planned"
  | "in_progress"
  | "complete";

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export interface MockBoard {
  id: string;
  name: string;
  visibility: "public" | "private" | "custom";
  allowedSegments: string[];
  description?: string;
}

export interface MockComment {
  id: string;
  postId: string;
  authorName: string;
  body: string;
  replyToCommentId: string | null;
  replyToAuthorName: string | null;
  createdAt: string;
}

export interface MockPost {
  id: string;
  boardId: string;
  title: string;
  details: string;
  status: "under_review" | "upcoming" | "planned" | "in_progress" | "complete";
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
  comments: MockComment[];
}

export interface MockChangelogEntry {
  id: string;
  title: string;
  content: string;
  boardId: string;
  tags: string[];
  releasedAt: string;
}

export interface MockPainEvent {
  id: string;
  boardId: string;
  requesterEmail: string;
  requesterCompany: string;
  companyMrr: number;
  rawText: string;
  status: "needs_triage" | "merged";
  suggestedPostId?: string;
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  email: string;
  boardId: string;
  reason: string;
  status: AccessRequestStatus;
  createdAt: string;
}

export interface MockMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

export interface PortalNotificationPreferences {
  productUpdates: boolean;
  commentReplies: boolean;
  mentions: boolean;
  weeklyDigest: boolean;
}

export interface BoardGrant {
  boardId: string;
  status: "pending" | "approved" | "rejected";
}

export interface MockPortalUserProfile {
  id: string;
  email: string;
  name: string;
  appUserId: string | null;
  segments: string[];
  boardGrants: BoardGrant[];
  notificationPreferences: PortalNotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface PortalNotification {
  id: string;
  userEmail: string;
  boardId: string;
  postId?: string;
  type: "status_change" | "comment_reply" | "mention" | "access_approved" | "announcement";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface PortalBoardView {
  id: string;
  name: string;
  visibility: MockBoard["visibility"];
  allowedSegments: string[];
  access: "granted" | "request" | "locked";
  canPost: boolean;
  postCount: number;
}

export interface PortalBoardAccess {
  canRead: boolean;
  canPost: boolean;
  canRequest: boolean;
  access: "granted" | "request" | "locked";
}

export interface AccessActorContext {
  role: "anonymous" | "customer" | "member" | "admin";
  isAuthenticated: boolean;
  email: string | null;
  displayName?: string | null;
  appUserId?: string | null;
  segments?: string[];
}

export interface SavedFilterCriteria {
  boardId: string;
  sort: PortalSortMode;
  filter: PortalFilterMode;
  query: string;
  supportOnly: boolean;
  commentsOnly: boolean;
  minMrr: number;
  ownerName: string;
}

export interface MockSavedFilter {
  id: string;
  name: string;
  criteria: SavedFilterCriteria;
  createdAt: string;
}

interface Store {
  boards: MockBoard[];
  members: MockMember[];
  posts: MockPost[];
  changelog: MockChangelogEntry[];
  painEvents: MockPainEvent[];
  accessRequests: AccessRequest[];
  savedFilters: MockSavedFilter[];
  userProfiles: MockPortalUserProfile[];
  notifications: PortalNotification[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const store: Store = {
  boards: [
    {
      id: "ad-reporting",
      name: "Ad Reporting and Attribution",
      visibility: "public",
      allowedSegments: [],
      description: "Public board for shared reporting requests"
    },
    {
      id: "apis",
      name: "APIs",
      visibility: "custom",
      allowedSegments: ["technical", "enterprise", "developer"],
      description: "Technical API feedback board"
    },
    {
      id: "app-marketplace",
      name: "App Marketplace",
      visibility: "public",
      allowedSegments: [],
      description: "Marketplace feedback and ideas"
    },
    {
      id: "voice-ai",
      name: "Voice AI",
      visibility: "custom",
      allowedSegments: ["ai", "beta", "enterprise"],
      description: "Beta board for AI-specific roadmap"
    },
    {
      id: "automations",
      name: "Automations",
      visibility: "public",
      allowedSegments: [],
      description: "Workflow and automation requests"
    },
    {
      id: "conversations",
      name: "Conversations",
      visibility: "private",
      allowedSegments: [],
      description: "Internal/limited-access discussion board"
    }
  ],
  members: [
    {
      id: "mem_1",
      name: "Aarav (You)",
      email: "aarav@painsolver.io",
      role: "admin"
    },
    {
      id: "mem_2",
      name: "Mila",
      email: "mila@painsolver.io",
      role: "member"
    },
    {
      id: "mem_3",
      name: "Ravi",
      email: "ravi@painsolver.io",
      role: "member"
    }
  ],
  posts: [
    {
      id: "post_1",
      boardId: "ad-reporting",
      title: "Comments Bug, please sync comments of all planners.",
      details:
        "Currently, the platform only displays comments from posts published through planner schedules, but it does not show comments from posts scheduled directly in Meta.",
      status: "planned",
      ownerName: "Mila",
      eta: "2026-03-08",
      tags: ["planner", "sync"],
      voteCount: 331,
      commentCount: 39,
      attachedMrr: 14200,
      capturedViaSupport: true,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: "2026-02-11T08:00:00.000Z",
      updatedAt: nowIso(),
      comments: [
        {
          id: "comment_1",
          postId: "post_1",
          authorName: "Wilberth Martinez",
          body: "This blocks some of our biggest client accounts.",
          replyToCommentId: null,
          replyToAuthorName: null,
          createdAt: "2026-02-12T09:00:00.000Z"
        }
      ]
    },
    {
      id: "post_2",
      boardId: "ad-reporting",
      title: "Competitor Analysis of Social Accounts",
      details:
        "It would be great to have built-in competitor analysis for social accounts so we can monitor competitors.",
      status: "under_review",
      ownerName: "Aarav (You)",
      eta: null,
      tags: ["analytics"],
      voteCount: 95,
      commentCount: 5,
      attachedMrr: 9400,
      capturedViaSupport: false,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: "2026-02-10T08:00:00.000Z",
      updatedAt: nowIso(),
      comments: []
    },
    {
      id: "post_3",
      boardId: "voice-ai",
      title: "Allow conversational AI to pull links from knowledge base",
      details: "Agent responses should include deep links to relevant docs and snippets.",
      status: "in_progress",
      ownerName: "Ravi",
      eta: "2026-03-17",
      tags: ["agent", "knowledge-base"],
      voteCount: 172,
      commentCount: 19,
      attachedMrr: 12600,
      capturedViaSupport: true,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: "2026-02-08T08:00:00.000Z",
      updatedAt: nowIso(),
      comments: []
    },
    {
      id: "post_4",
      boardId: "apis",
      title: "Fix Email Template Builder API to add template settings",
      details: "Need API parity for template metadata and settings payload.",
      status: "complete",
      ownerName: "Mila",
      eta: "2026-02-12",
      tags: ["api", "templates"],
      voteCount: 77,
      commentCount: 4,
      attachedMrr: 3800,
      capturedViaSupport: false,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: "2026-01-25T08:00:00.000Z",
      updatedAt: nowIso(),
      comments: []
    },
    {
      id: "post_5",
      boardId: "automations",
      title: "Trigger Link Stats",
      details: "Track exactly who clicked, where, and when across automation links.",
      status: "upcoming",
      ownerName: "Aarav (You)",
      eta: "2026-03-22",
      tags: ["tracking", "automation"],
      voteCount: 125,
      commentCount: 8,
      attachedMrr: 6200,
      capturedViaSupport: true,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: "2026-02-09T08:00:00.000Z",
      updatedAt: nowIso(),
      comments: []
    },
    {
      id: "post_6",
      boardId: "conversations",
      title: "Opportunities Smart List",
      details: "Smarter list filters across stage history and stale opportunities.",
      status: "planned",
      ownerName: "Ravi",
      eta: "2026-03-29",
      tags: ["crm", "lists"],
      voteCount: 113,
      commentCount: 10,
      attachedMrr: 6900,
      capturedViaSupport: false,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: "2026-02-07T08:00:00.000Z",
      updatedAt: nowIso(),
      comments: []
    }
  ],
  changelog: [
    {
      id: "ch_1",
      boardId: "apis",
      title: "Documents & Contracts: Staff Selection in Templates",
      content:
        "Admins can now assign signature fields to the entire staff list directly in templates.",
      tags: ["new", "improved"],
      releasedAt: "2026-02-18T08:00:00.000Z"
    },
    {
      id: "ch_2",
      boardId: "automations",
      title: "Trigger Link Stats Beta",
      content: "Click attribution and event-level analytics are now available in beta.",
      tags: ["new"],
      releasedAt: "2026-02-15T08:00:00.000Z"
    }
  ],
  painEvents: [
    {
      id: "pe_1",
      boardId: "ad-reporting",
      requesterEmail: "ops@northstar.com",
      requesterCompany: "Northstar",
      companyMrr: 1200,
      rawText: "Please sync comments for all planners including posts scheduled directly in Meta.",
      status: "needs_triage",
      suggestedPostId: "post_1",
      createdAt: "2026-02-18T05:00:00.000Z"
    },
    {
      id: "pe_2",
      boardId: "apis",
      requesterEmail: "dev@acme.com",
      requesterCompany: "Acme",
      companyMrr: 890,
      rawText: "Need API endpoint for template settings, currently blocked.",
      status: "needs_triage",
      suggestedPostId: "post_4",
      createdAt: "2026-02-18T06:00:00.000Z"
    }
  ],
  accessRequests: [],
  savedFilters: [
    {
      id: "sf_1",
      name: "Support + MRR",
      criteria: {
        boardId: "ad-reporting",
        sort: "trending",
        filter: "all",
        query: "",
        supportOnly: true,
        commentsOnly: false,
        minMrr: 5000,
        ownerName: ""
      },
      createdAt: "2026-02-14T10:00:00.000Z"
    }
  ],
  userProfiles: [
    {
      id: "usr_1",
      email: "customer@example.com",
      name: "Customer User",
      appUserId: "portal-user",
      segments: ["beta", "agency"],
      boardGrants: [
        {
          boardId: "apis",
          status: "approved"
        }
      ],
      notificationPreferences: {
        productUpdates: true,
        commentReplies: true,
        mentions: true,
        weeklyDigest: true
      },
      createdAt: "2026-02-10T08:00:00.000Z",
      updatedAt: nowIso()
    },
    {
      id: "usr_2",
      email: "enterprise@example.com",
      name: "Enterprise User",
      appUserId: "enterprise-user",
      segments: ["enterprise", "technical"],
      boardGrants: [],
      notificationPreferences: {
        productUpdates: true,
        commentReplies: true,
        mentions: true,
        weeklyDigest: true
      },
      createdAt: "2026-02-09T08:00:00.000Z",
      updatedAt: nowIso()
    }
  ],
  notifications: [
    {
      id: "notif_1",
      userEmail: "customer@example.com",
      boardId: "ad-reporting",
      postId: "post_1",
      type: "status_change",
      title: "Status updated: Comments Bug, please sync comments of all planners.",
      body: "Moved to Planned on February 18, 2026.",
      readAt: null,
      createdAt: "2026-02-18T11:00:00.000Z"
    }
  ]
};

function statusMatchesFilter(status: MockPost["status"], filter: PortalFilterMode): boolean {
  if (filter === "all") {
    return true;
  }

  return status === filter;
}

function sortPosts(posts: MockPost[], sort: PortalSortMode): MockPost[] {
  if (sort === "new") {
    return [...posts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  if (sort === "top") {
    return [...posts].sort((a, b) => b.voteCount - a.voteCount);
  }

  return [...posts].sort((a, b) => {
    if (b.attachedMrr !== a.attachedMrr) {
      return b.attachedMrr - a.attachedMrr;
    }

    return b.voteCount - a.voteCount;
  });
}

function recomputeCommentCount(post: MockPost): void {
  post.commentCount = post.comments.length;
  post.updatedAt = nowIso();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function defaultNotificationPreferences(): PortalNotificationPreferences {
  return {
    productUpdates: true,
    commentReplies: true,
    mentions: true,
    weeklyDigest: true
  };
}

function findBoard(boardId: string): MockBoard | null {
  return store.boards.find((board) => board.id === boardId) ?? null;
}

function findProfileByEmail(email: string | null | undefined): MockPortalUserProfile | null {
  if (!email) {
    return null;
  }

  const normalized = normalizeEmail(email);
  return store.userProfiles.find((profile) => normalizeEmail(profile.email) === normalized) ?? null;
}

function upsertPortalUserProfile(input: {
  email: string;
  name?: string | null;
  appUserId?: string | null;
  segments?: string[];
}): MockPortalUserProfile {
  const normalizedEmail = normalizeEmail(input.email);
  const existing = store.userProfiles.find((profile) => normalizeEmail(profile.email) === normalizedEmail);
  const nextSegments = Array.from(new Set((input.segments ?? []).map((segment) => segment.trim()).filter(Boolean)));

  if (existing) {
    if (input.name) {
      existing.name = input.name;
    }

    if (typeof input.appUserId !== "undefined") {
      existing.appUserId = input.appUserId;
    }

    if (nextSegments.length) {
      existing.segments = nextSegments;
    }

    existing.updatedAt = nowIso();
    return existing;
  }

  const created: MockPortalUserProfile = {
    id: createId("usr"),
    email: normalizedEmail,
    name: input.name?.trim() || normalizedEmail,
    appUserId: input.appUserId ?? null,
    segments: nextSegments,
    boardGrants: [],
    notificationPreferences: defaultNotificationPreferences(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.userProfiles.unshift(created);
  return created;
}

function getGrantStatus(profile: MockPortalUserProfile | null, boardId: string): BoardGrant["status"] | null {
  if (!profile) {
    return null;
  }

  const grant = profile.boardGrants.find((item) => item.boardId === boardId);
  return grant?.status ?? null;
}

function resolveSegments(actor: AccessActorContext, profile: MockPortalUserProfile | null): string[] {
  if (actor.segments?.length) {
    return actor.segments.map((segment) => segment.toLowerCase());
  }

  if (profile?.segments?.length) {
    return profile.segments.map((segment) => segment.toLowerCase());
  }

  return [];
}

function profileAsActor(profile: MockPortalUserProfile): AccessActorContext {
  return {
    role: "customer",
    isAuthenticated: true,
    email: profile.email,
    displayName: profile.name,
    appUserId: profile.appUserId,
    segments: profile.segments
  };
}

function resolveBoardAccessForActor(board: MockBoard, actor: AccessActorContext): PortalBoardAccess {
  if (actor.role === "member" || actor.role === "admin") {
    return {
      canRead: true,
      canPost: true,
      canRequest: false,
      access: "granted"
    };
  }

  const profile = findProfileByEmail(actor.email);
  const grantStatus = getGrantStatus(profile, board.id);
  const segments = resolveSegments(actor, profile);

  if (board.visibility === "public") {
    return {
      canRead: true,
      canPost: actor.isAuthenticated && actor.role === "customer",
      canRequest: false,
      access: "granted"
    };
  }

  if (!actor.isAuthenticated || actor.role !== "customer") {
    return {
      canRead: false,
      canPost: false,
      canRequest: false,
      access: "locked"
    };
  }

  const segmentAllowed =
    board.allowedSegments.length === 0 ||
    board.allowedSegments.some((segment) => segments.includes(segment.toLowerCase()));

  const grantApproved = grantStatus === "approved";
  const canRead = board.visibility === "custom" ? segmentAllowed || grantApproved : grantApproved;
  const canRequest = !canRead;

  return {
    canRead,
    canPost: canRead,
    canRequest,
    access: canRead ? "granted" : "request"
  };
}

function createNotification(input: Omit<PortalNotification, "id" | "createdAt" | "readAt">): PortalNotification {
  const notification: PortalNotification = {
    id: createId("notif"),
    userEmail: normalizeEmail(input.userEmail),
    boardId: input.boardId,
    postId: input.postId,
    type: input.type,
    title: input.title,
    body: input.body,
    readAt: null,
    createdAt: nowIso()
  };

  store.notifications.unshift(notification);
  return notification;
}

function notifyStatusChange(post: MockPost, nextStatus: MockPost["status"], changedByEmail?: string): void {
  store.userProfiles.forEach((profile) => {
    const actor = profileAsActor(profile);
    const board = findBoard(post.boardId);
    if (!board) {
      return;
    }

    const access = resolveBoardAccessForActor(board, actor);
    if (!access.canRead || !profile.notificationPreferences.productUpdates) {
      return;
    }

    if (changedByEmail && normalizeEmail(changedByEmail) === normalizeEmail(profile.email)) {
      return;
    }

    createNotification({
      userEmail: profile.email,
      boardId: post.boardId,
      postId: post.id,
      type: "status_change",
      title: `Status updated: ${post.title}`,
      body: `Moved to ${nextStatus.replace(/_/g, " ")}.`
    });
  });
}

function extractMentionEmails(body: string): string[] {
  const matches = body.match(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi) ?? [];
  return Array.from(
    new Set(
      matches
        .map((value) => value.replace(/^@/, ""))
        .map((value) => normalizeEmail(value))
    )
  );
}

function notifyCommentEvents(post: MockPost, comment: MockComment, authorEmail?: string): void {
  const board = findBoard(post.boardId);
  if (!board) {
    return;
  }

  const normalizedAuthor = authorEmail ? normalizeEmail(authorEmail) : null;
  const parentEmail =
    comment.replyToAuthorName && comment.replyToAuthorName.includes("@")
      ? normalizeEmail(comment.replyToAuthorName)
      : null;

  if (parentEmail) {
    const parentProfile = findProfileByEmail(parentEmail);
    if (parentProfile?.notificationPreferences.commentReplies) {
      const access = resolveBoardAccessForActor(board, profileAsActor(parentProfile));
      if (access.canRead && parentEmail !== normalizedAuthor) {
        createNotification({
          userEmail: parentProfile.email,
          boardId: post.boardId,
          postId: post.id,
          type: "comment_reply",
          title: `New reply on ${post.title}`,
          body: `${comment.authorName} replied to your comment.`
        });
      }
    }
  }

  extractMentionEmails(comment.body).forEach((email) => {
    const profile = findProfileByEmail(email);
    if (!profile || !profile.notificationPreferences.mentions) {
      return;
    }

    if (normalizedAuthor && normalizedAuthor === email) {
      return;
    }

    const access = resolveBoardAccessForActor(board, profileAsActor(profile));
    if (!access.canRead) {
      return;
    }

    createNotification({
      userEmail: profile.email,
      boardId: post.boardId,
      postId: post.id,
      type: "mention",
      title: `You were mentioned on ${post.title}`,
      body: `${comment.authorName} mentioned you in a comment.`
    });
  });
}

export const portalStore = {
  listBoards(): MockBoard[] {
    return [...store.boards];
  },

  listBoardsForActor(actor: AccessActorContext): PortalBoardView[] {
    return store.boards.map((board) => {
      const access = resolveBoardAccessForActor(board, actor);
      const postCount = access.canRead
        ? this.listFeedback({
            boardId: board.id,
            sort: "trending",
            filter: "all",
            search: ""
          }).length
        : 0;

      return {
        id: board.id,
        name: board.name,
        visibility: board.visibility,
        allowedSegments: board.allowedSegments,
        access: access.access,
        canPost: access.canPost,
        postCount
      };
    });
  },

  getBoardAccess(boardId: string, actor: AccessActorContext): PortalBoardAccess {
    const board = findBoard(boardId);
    if (!board) {
      return {
        canRead: false,
        canPost: false,
        canRequest: false,
        access: "locked"
      };
    }

    return resolveBoardAccessForActor(board, actor);
  },

  listMembers(): MockMember[] {
    return [...store.members];
  },

  startSsoSession(input: {
    email: string;
    name?: string | null;
    appUserId?: string | null;
    segments?: string[];
  }): MockPortalUserProfile {
    return upsertPortalUserProfile(input);
  },

  getPortalUser(email: string | null | undefined): MockPortalUserProfile | null {
    return findProfileByEmail(email);
  },

  listFeedback(params: {
    boardId: string;
    sort: PortalSortMode;
    filter: PortalFilterMode;
    search: string;
    includeMerged?: boolean;
  }): MockPost[] {
    const searchLower = params.search.trim().toLowerCase();

    let list = store.posts.filter((post) => post.boardId === params.boardId);
    if (!params.includeMerged) {
      list = list.filter((post) => !post.mergedIntoPostId);
    }
    list = list.filter((post) => statusMatchesFilter(post.status, params.filter));

    if (searchLower) {
      list = list.filter(
        (post) =>
          post.title.toLowerCase().includes(searchLower) ||
          post.details.toLowerCase().includes(searchLower)
      );
    }

    return sortPosts(list, params.sort);
  },

  listRoadmap(boardId?: string): Record<string, MockPost[]> {
    const filtered = (boardId ? store.posts.filter((post) => post.boardId === boardId) : store.posts).filter(
      (post) => !post.mergedIntoPostId
    );

    return {
      planned: filtered.filter((post) => post.status === "planned"),
      in_progress: filtered.filter((post) => post.status === "in_progress"),
      complete: filtered.filter((post) => post.status === "complete")
    };
  },

  listChangelog(search: string): MockChangelogEntry[] {
    const searchLower = search.trim().toLowerCase();
    const list = searchLower
      ? store.changelog.filter(
          (entry) =>
            entry.title.toLowerCase().includes(searchLower) ||
            entry.content.toLowerCase().includes(searchLower)
        )
      : store.changelog;

    return [...list].sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt));
  },

  getPost(postId: string): MockPost | null {
    return store.posts.find((post) => post.id === postId) ?? null;
  },

  getPosts(postIds: string[]): MockPost[] {
    const idSet = new Set(postIds);
    return store.posts.filter((post) => idSet.has(post.id));
  },

  upvote(postId: string): MockPost | null {
    const post = store.posts.find((item) => item.id === postId);
    if (!post) {
      return null;
    }

    post.voteCount += 1;
    post.updatedAt = nowIso();
    return post;
  },

  createPost(input: { boardId: string; title: string; details: string; createdBySupport?: boolean }): MockPost {
    const post: MockPost = {
      id: createId("post"),
      boardId: input.boardId,
      title: input.title,
      details: input.details,
      status: "under_review",
      ownerName: "Unassigned",
      eta: null,
      tags: [],
      voteCount: 1,
      commentCount: 0,
      attachedMrr: 0,
      capturedViaSupport: input.createdBySupport ?? false,
      mergedIntoPostId: null,
      mergedSourcePostIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      comments: []
    };

    store.posts.unshift(post);
    return post;
  },

  addComment(
    postId: string,
    input: { authorName: string; body: string; replyToCommentId?: string; authorEmail?: string }
  ): MockComment | null {
    const post = store.posts.find((item) => item.id === postId);
    if (!post) {
      return null;
    }

    const parent = input.replyToCommentId
      ? post.comments.find((comment) => comment.id === input.replyToCommentId) ?? null
      : null;

    const comment: MockComment = {
      id: createId("comment"),
      postId,
      authorName: input.authorName,
      body: input.body,
      replyToCommentId: parent?.id ?? null,
      replyToAuthorName: parent?.authorName ?? null,
      createdAt: nowIso()
    };

    post.comments.unshift(comment);
    recomputeCommentCount(post);
    notifyCommentEvents(post, comment, input.authorEmail);
    return comment;
  },

  listPainEvents(status: "needs_triage" | "merged" = "needs_triage"): MockPainEvent[] {
    return store.painEvents
      .filter((event) => event.status === status)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  mergePainEvent(eventId: string, postId: string): { event: MockPainEvent; post: MockPost } | null {
    const event = store.painEvents.find((item) => item.id === eventId);
    const post = store.posts.find((item) => item.id === postId);

    if (!event || !post) {
      return null;
    }

    if (event.status === "needs_triage") {
      event.status = "merged";
      post.voteCount += 1;
      post.attachedMrr += event.companyMrr;
      post.capturedViaSupport = true;
      post.updatedAt = nowIso();
    }

    return { event, post };
  },

  mergePosts(sourcePostId: string, targetPostId: string): { source: MockPost; target: MockPost } | null {
    const source = store.posts.find((item) => item.id === sourcePostId);
    const target = store.posts.find((item) => item.id === targetPostId);

    if (!source || !target) {
      return null;
    }

    if (source.id === target.id || source.boardId !== target.boardId) {
      return null;
    }

    if (source.mergedIntoPostId || target.mergedIntoPostId) {
      return null;
    }

    source.mergedIntoPostId = target.id;
    source.updatedAt = nowIso();

    target.voteCount += source.voteCount;
    target.attachedMrr += source.attachedMrr;
    target.commentCount += source.commentCount;
    target.capturedViaSupport = target.capturedViaSupport || source.capturedViaSupport;
    target.tags = Array.from(new Set([...target.tags, ...source.tags]));
    target.mergedSourcePostIds = Array.from(new Set([...target.mergedSourcePostIds, source.id]));
    target.updatedAt = nowIso();

    return { source, target };
  },

  unmergePost(sourcePostId: string): { source: MockPost; target: MockPost } | null {
    const source = store.posts.find((item) => item.id === sourcePostId);
    if (!source || !source.mergedIntoPostId) {
      return null;
    }

    const target = store.posts.find((item) => item.id === source.mergedIntoPostId);
    if (!target) {
      return null;
    }

    target.voteCount = Math.max(0, target.voteCount - source.voteCount);
    target.attachedMrr = Math.max(0, target.attachedMrr - source.attachedMrr);
    target.commentCount = Math.max(0, target.commentCount - source.commentCount);
    target.mergedSourcePostIds = target.mergedSourcePostIds.filter((id) => id !== source.id);
    target.updatedAt = nowIso();

    source.mergedIntoPostId = null;
    source.updatedAt = nowIso();

    return { source, target };
  },

  bulkUpdatePosts(
    postIds: string[],
    input: {
      status?: MockPost["status"];
      ownerName?: string;
      eta?: string | null;
      addTags?: string[];
      removeTags?: string[];
    }
  ): MockPost[] {
    const idSet = new Set(postIds);
    const add = new Set((input.addTags ?? []).map((item) => item.trim()).filter(Boolean));
    const remove = new Set((input.removeTags ?? []).map((item) => item.trim()).filter(Boolean));

    const changed: MockPost[] = [];

    store.posts.forEach((post) => {
      if (!idSet.has(post.id)) {
        return;
      }

      if (input.status) {
        post.status = input.status;
      }

      if (typeof input.ownerName === "string" && input.ownerName.length > 0) {
        post.ownerName = input.ownerName;
      }

      if (typeof input.eta !== "undefined") {
        post.eta = input.eta;
      }

      if (add.size || remove.size) {
        const next = new Set(post.tags);
        add.forEach((tag) => next.add(tag));
        remove.forEach((tag) => next.delete(tag));
        post.tags = Array.from(next);
      }

      post.updatedAt = nowIso();
      changed.push(post);
    });

    return changed;
  },

  updatePost(
    postId: string,
    input: {
      status?: MockPost["status"];
      ownerName?: string;
      eta?: string | null;
      tags?: string[];
    },
    options?: { changedByEmail?: string | null }
  ): MockPost | null {
    const post = store.posts.find((item) => item.id === postId);
    if (!post) {
      return null;
    }

    const previousStatus = post.status;

    if (input.status) {
      post.status = input.status;
    }

    if (typeof input.ownerName === "string") {
      post.ownerName = input.ownerName;
    }

    if (typeof input.eta !== "undefined") {
      post.eta = input.eta;
    }

    if (Array.isArray(input.tags)) {
      post.tags = input.tags;
    }

    post.updatedAt = nowIso();

    if (input.status && input.status !== previousStatus) {
      notifyStatusChange(post, input.status, options?.changedByEmail ?? undefined);
    }

    return post;
  },

  createChangelogEntry(input: {
    boardId: string;
    title: string;
    content: string;
    tags?: string[];
  }): MockChangelogEntry {
    const entry: MockChangelogEntry = {
      id: createId("ch"),
      boardId: input.boardId,
      title: input.title,
      content: input.content,
      tags: input.tags?.length ? input.tags : ["new"],
      releasedAt: nowIso()
    };

    store.changelog.unshift(entry);
    return entry;
  },

  listAccessRequests(): AccessRequest[] {
    return [...store.accessRequests].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  requestAccess(input: { email: string; boardId: string; reason: string }): AccessRequest {
    const profile = upsertPortalUserProfile({ email: input.email });
    const request: AccessRequest = {
      id: createId("access"),
      email: normalizeEmail(input.email),
      boardId: input.boardId,
      reason: input.reason,
      status: "pending",
      createdAt: nowIso()
    };

    const grant = profile.boardGrants.find((item) => item.boardId === input.boardId);
    if (grant) {
      grant.status = "pending";
    } else {
      profile.boardGrants.push({
        boardId: input.boardId,
        status: "pending"
      });
    }
    profile.updatedAt = nowIso();

    store.accessRequests.unshift(request);
    return request;
  },

  updateAccessRequestStatus(id: string, status: AccessRequestStatus): AccessRequest | null {
    const req = store.accessRequests.find((item) => item.id === id);
    if (!req) {
      return null;
    }

    req.status = status;

    const profile = upsertPortalUserProfile({ email: req.email });
    const grant = profile.boardGrants.find((item) => item.boardId === req.boardId);
    if (grant) {
      grant.status = status;
    } else {
      profile.boardGrants.push({
        boardId: req.boardId,
        status
      });
    }
    profile.updatedAt = nowIso();

    if (status === "approved") {
      createNotification({
        userEmail: req.email,
        boardId: req.boardId,
        type: "access_approved",
        title: "Board access approved",
        body: `Your access request for ${req.boardId} was approved.`
      });
    }

    return req;
  },

  getNotificationPreferences(email: string): PortalNotificationPreferences {
    const profile = upsertPortalUserProfile({ email });
    return { ...profile.notificationPreferences };
  },

  updateNotificationPreferences(
    email: string,
    patch: Partial<PortalNotificationPreferences>
  ): PortalNotificationPreferences {
    const profile = upsertPortalUserProfile({ email });
    profile.notificationPreferences = {
      ...profile.notificationPreferences,
      ...patch
    };
    profile.updatedAt = nowIso();
    return { ...profile.notificationPreferences };
  },

  listNotifications(email: string): PortalNotification[] {
    const normalized = normalizeEmail(email);
    return store.notifications
      .filter((item) => normalizeEmail(item.userEmail) === normalized)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  markNotificationRead(email: string, notificationId: string): PortalNotification | null {
    const normalized = normalizeEmail(email);
    const notification = store.notifications.find(
      (item) => item.id === notificationId && normalizeEmail(item.userEmail) === normalized
    );

    if (!notification) {
      return null;
    }

    notification.readAt = notification.readAt ?? nowIso();
    return notification;
  },

  markAllNotificationsRead(email: string): number {
    const normalized = normalizeEmail(email);
    let updated = 0;

    store.notifications.forEach((item) => {
      if (normalizeEmail(item.userEmail) !== normalized) {
        return;
      }

      if (!item.readAt) {
        item.readAt = nowIso();
        updated += 1;
      }
    });

    return updated;
  },

  listSavedFilters(): MockSavedFilter[] {
    return [...store.savedFilters].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  createSavedFilter(input: { name: string; criteria: SavedFilterCriteria }): MockSavedFilter {
    const saved: MockSavedFilter = {
      id: createId("saved"),
      name: input.name.trim(),
      criteria: input.criteria,
      createdAt: nowIso()
    };

    store.savedFilters.unshift(saved);
    return saved;
  },

  deleteSavedFilter(id: string): boolean {
    const currentLength = store.savedFilters.length;
    store.savedFilters = store.savedFilters.filter((item) => item.id !== id);
    return store.savedFilters.length < currentLength;
  },

  listOpportunities(boardId?: string): Array<{
    postId: string;
    title: string;
    voteCount: number;
    attachedMrr: number;
    opportunityScore: number;
  }> {
    const posts = (boardId ? store.posts.filter((post) => post.boardId === boardId) : store.posts).filter(
      (post) => !post.mergedIntoPostId
    );

    return posts
      .map((post) => ({
        postId: post.id,
        title: post.title,
        voteCount: post.voteCount,
        attachedMrr: post.attachedMrr,
        opportunityScore: Number((post.attachedMrr * 0.65 + post.voteCount * 24).toFixed(2))
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }
};
