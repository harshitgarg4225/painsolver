import crypto from "crypto";

import { env } from "../config/env";

const SLACK_CLIENT_ID = env.SLACK_CLIENT_ID || "";
const SLACK_CLIENT_SECRET = env.SLACK_CLIENT_SECRET || "";
const SLACK_REDIRECT_URI = env.SLACK_REDIRECT_URI || "";

interface SlackOAuthStatePayload {
  userId: string;
  email: string;
  issuedAt: number;
  nonce: string;
}

function stateSignature(encodedPayload: string): string {
  const secret = env.SLACK_STATE_SECRET || env.PAINSOLVER_CLIENT_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("hex");
}

function decodeStatePayload(state: string): SlackOAuthStatePayload | null {
  const [encodedPayload, signature] = String(state || "").split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = stateSignature(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as SlackOAuthStatePayload;
    if (!parsed.userId || !parsed.email || !parsed.issuedAt || !parsed.nonce) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface SlackOAuthToken {
  accessToken: string;
  tokenType: string;
  scope: string;
  botUserId: string | null;
  teamId: string;
  teamName: string;
  authedUserId: string;
  authedUserName: string | null;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export interface SlackConnectionStatusView {
  connected: boolean;
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  userName: string | null;
  channelCount: number;
  channelNames: string[];
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export interface SlackMessage {
  messageId: string;
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  threadTs?: string;
  permalink?: string;
}

export function createSlackOAuthState(input: { userId: string; email: string }): string {
  const payload: SlackOAuthStatePayload = {
    userId: input.userId,
    email: input.email,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(12).toString("hex")
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${stateSignature(encoded)}`;
}

export function parseSlackOAuthState(state: string): { userId: string; email: string } | null {
  const parsed = decodeStatePayload(state);
  if (!parsed) {
    return null;
  }

  const maxAgeMs = 10 * 60 * 1000; // 10 minutes
  if (Date.now() - parsed.issuedAt > maxAgeMs) {
    return null;
  }

  return {
    userId: parsed.userId,
    email: parsed.email
  };
}

export function buildSlackAuthorizeUrl(state: string): string {
  // Bot scopes for real-time events and interactions
  const scopes = [
    "channels:history",
    "channels:read",
    "chat:write",
    "groups:history",
    "groups:read",
    "users:read",
    "users:read.email", // Required to get user email for PainSolver user mapping
    "team:read",
    "app_mentions:read" // Respond to @mentions
  ].join(",");

  // User scopes (for OAuth flow context)
  const userScopes = [
    "channels:read",
    "groups:read"
  ].join(",");

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: scopes,
    user_scope: userScopes,
    redirect_uri: SLACK_REDIRECT_URI,
    state: state
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackAuthorizationCode(code: string): Promise<SlackOAuthToken> {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: code,
      redirect_uri: SLACK_REDIRECT_URI
    })
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Failed to exchange Slack authorization code");
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || "bot",
    scope: data.scope || "",
    botUserId: data.bot_user_id || null,
    teamId: data.team?.id || "",
    teamName: data.team?.name || "",
    authedUserId: data.authed_user?.id || "",
    authedUserName: null
  };
}

export async function fetchSlackUserInfo(accessToken: string, userId: string): Promise<{ name: string; email: string } | null> {
  const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!data.ok) {
    return null;
  }

  return {
    name: data.user?.real_name || data.user?.name || "",
    email: data.user?.profile?.email || ""
  };
}

export async function listSlackChannels(accessToken: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  // Fetch public channels
  do {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      limit: "200",
      exclude_archived: "true"
    });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Failed to fetch Slack channels:", data.error);
      break;
    }

    for (const channel of data.channels || []) {
      channels.push({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private || false,
        isMember: channel.is_member || false
      });
    }

    cursor = data.response_metadata?.next_cursor;
  } while (cursor);

  return channels;
}

export async function fetchSlackChannelMessages(
  accessToken: string,
  channelId: string,
  options: {
    oldest?: string;
    latest?: string;
    limit?: number;
  } = {}
): Promise<SlackMessage[]> {
  const params = new URLSearchParams({
    channel: channelId,
    limit: String(options.limit || 100)
  });

  if (options.oldest) {
    params.set("oldest", options.oldest);
  }
  if (options.latest) {
    params.set("latest", options.latest);
  }

  const response = await fetch(`https://slack.com/api/conversations.history?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Failed to fetch Slack messages");
  }

  const messages: SlackMessage[] = [];

  for (const msg of data.messages || []) {
    if (msg.type !== "message" || msg.subtype) {
      continue; // Skip non-user messages
    }

    messages.push({
      messageId: msg.ts,
      channelId: channelId,
      channelName: "",
      userId: msg.user || "",
      userName: "",
      text: msg.text || "",
      timestamp: msg.ts,
      threadTs: msg.thread_ts,
      permalink: undefined
    });
  }

  return messages;
}

export async function postSlackMessage(
  accessToken: string,
  channelId: string,
  text: string,
  options: {
    threadTs?: string;
    blocks?: unknown[];
  } = {}
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const body: Record<string, unknown> = {
    channel: channelId,
    text: text
  };

  if (options.threadTs) {
    body.thread_ts = options.threadTs;
  }
  if (options.blocks) {
    body.blocks = options.blocks;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  return {
    ok: data.ok,
    ts: data.ts,
    error: data.error
  };
}

export function defaultSlackConnection(): SlackConnectionStatusView {
  return {
    connected: false,
    teamId: null,
    teamName: null,
    userId: null,
    userName: null,
    channelCount: 0,
    channelNames: [],
    connectedAt: null,
    lastSyncedAt: null
  };
}

// =============================================
// Slack Events API Support
// =============================================

const SLACK_SIGNING_SECRET = env.SLACK_SIGNING_SECRET || env.SLACK_CLIENT_SECRET || "";

/**
 * Verify Slack request signature (required for Events API)
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn("[Slack] No signing secret configured, skipping verification");
    return true; // Allow in development
  }

  // Check timestamp to prevent replay attacks (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 60 * 5) {
    console.warn("[Slack] Request timestamp too old");
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${body}`;
  const mySignature = "v0=" + crypto
    .createHmac("sha256", SLACK_SIGNING_SECRET)
    .update(sigBaseString)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Fetch thread replies for context
 */
export async function fetchSlackThreadReplies(
  accessToken: string,
  channelId: string,
  threadTs: string,
  options: { limit?: number } = {}
): Promise<SlackMessage[]> {
  const params = new URLSearchParams({
    channel: channelId,
    ts: threadTs,
    limit: String(options.limit || 50)
  });

  const response = await fetch(`https://slack.com/api/conversations.replies?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!data.ok) {
    console.error("Failed to fetch thread replies:", data.error);
    return [];
  }

  const messages: SlackMessage[] = [];

  for (const msg of data.messages || []) {
    if (msg.type !== "message") continue;

    messages.push({
      messageId: msg.ts,
      channelId: channelId,
      channelName: "",
      userId: msg.user || "",
      userName: "",
      text: msg.text || "",
      timestamp: msg.ts,
      threadTs: msg.thread_ts,
      permalink: undefined
    });
  }

  return messages;
}

/**
 * Get channel info (name, etc.)
 */
export async function fetchSlackChannelInfo(
  accessToken: string,
  channelId: string
): Promise<{ id: string; name: string } | null> {
  const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!data.ok) {
    return null;
  }

  return {
    id: data.channel?.id || channelId,
    name: data.channel?.name || ""
  };
}

/**
 * Parsed Slack event from Events API
 */
export interface SlackEventPayload {
  type: string;
  challenge?: string; // URL verification
  token?: string;
  team_id?: string;
  event?: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    channel_type?: string;
    bot_id?: string; // Ignore bot messages
    subtype?: string;
  };
  event_id?: string;
  event_time?: number;
}

/**
 * Build combined text from thread for context
 */
export async function buildThreadContext(
  accessToken: string,
  channelId: string,
  threadTs: string,
  channelName: string
): Promise<string> {
  const replies = await fetchSlackThreadReplies(accessToken, channelId, threadTs, { limit: 20 });
  
  if (replies.length === 0) {
    return "";
  }

  // Get user info for each unique user
  const userIds = Array.from(new Set(replies.map((r) => r.userId).filter(Boolean)));
  const userNames: Record<string, string> = {};
  
  for (const uid of userIds.slice(0, 10)) {
    const userInfo = await fetchSlackUserInfo(accessToken, uid);
    if (userInfo) {
      userNames[uid] = userInfo.name || uid;
    }
  }

  const threadText = replies
    .map((r) => {
      const name = userNames[r.userId] || "User";
      return `${name}: ${r.text}`;
    })
    .join("\n");

  return `[Thread from #${channelName}]\n${threadText}`;
}

/**
 * Classify message type using simple heuristics
 */
export function classifySlackMessage(text: string): "feedback" | "bug" | "question" | "noise" {
  const lowerText = text.toLowerCase();
  
  // Bug indicators
  if (/\b(bug|error|broken|crash|not working|doesn't work|failed|issue)\b/.test(lowerText)) {
    return "bug";
  }
  
  // Feature request / feedback indicators
  if (/\b(would be nice|should|could we|can we|feature|request|wish|want|need|improve|better)\b/.test(lowerText)) {
    return "feedback";
  }
  
  // Question indicators
  if (/\b(how do|how to|what is|where is|can you|could you explain|\?)\b/.test(lowerText)) {
    return "question";
  }
  
  // Too short or likely noise
  if (text.length < 30 || /^(ok|thanks|thank you|lol|haha|👍|yes|no|sure)$/i.test(text.trim())) {
    return "noise";
  }
  
  return "feedback"; // Default to feedback for analysis
}

