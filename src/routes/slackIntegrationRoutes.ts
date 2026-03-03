import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { scrubPii } from "../lib/pii";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";
import { getOrCreateActorUser } from "../services/workspaceDataService";
import { processPainEvent } from "../services/painEventService";
import {
  buildSlackAuthorizeUrl,
  buildThreadContext,
  classifySlackMessage,
  createSlackOAuthState,
  defaultSlackConnection,
  exchangeSlackAuthorizationCode,
  fetchSlackChannelInfo,
  fetchSlackChannelMessages,
  fetchSlackUserInfo,
  listSlackChannels,
  parseSlackOAuthState,
  postSlackMessage,
  SlackConnectionStatusView,
  SlackEventPayload,
  verifySlackSignature
} from "../services/slackService";
import { sendStatusChangeEmail } from "../services/emailService";

const configureChannelsSchema = z.object({
  channelIds: z.array(z.string()).optional(),
  channelNames: z.array(z.string()).optional()
});

const importMessagesSchema = z.object({
  daysBack: z.coerce.number().int().min(1).max(30).optional(),
  maxMessages: z.coerce.number().int().min(1).max(500).optional()
});

function statusFromConnection(connection: {
  slackTeamId: string;
  slackTeamName: string | null;
  slackUserId: string;
  slackUserName: string | null;
  channelIds: string[];
  channelNames: string[];
  connectedAt: Date;
  lastSyncedAt: Date | null;
} | null): SlackConnectionStatusView {
  if (!connection) {
    return defaultSlackConnection();
  }

  return {
    connected: true,
    teamId: connection.slackTeamId,
    teamName: connection.slackTeamName,
    userId: connection.slackUserId,
    userName: connection.slackUserName,
    channelCount: connection.channelIds.length,
    channelNames: connection.channelNames,
    connectedAt: connection.connectedAt.toISOString(),
    lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null
  };
}

export const slackIntegrationRoutes = Router();

slackIntegrationRoutes.get("/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";

  if (error) {
    res.redirect(`/company?slack=error&reason=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing Slack callback parameters" });
    return;
  }

  const statePayload = parseSlackOAuthState(state);
  if (!statePayload) {
    res.status(400).json({ error: "Invalid or expired Slack state" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: statePayload.userId }
  });

  if (!user || user.email.toLowerCase() !== statePayload.email.toLowerCase()) {
    res.status(404).json({ error: "User not found for Slack connection" });
    return;
  }

  try {
    const token = await exchangeSlackAuthorizationCode(code);
    const userInfo = await fetchSlackUserInfo(token.accessToken, token.authedUserId);

    await prisma.slackConnection.upsert({
      where: { userId: user.id },
      update: {
        slackTeamId: token.teamId,
        slackTeamName: token.teamName,
        slackUserId: token.authedUserId,
        slackUserName: userInfo?.name || null,
        accessToken: token.accessToken,
        botUserId: token.botUserId,
        scope: token.scope,
        connectedAt: new Date()
      },
      create: {
        userId: user.id,
        slackTeamId: token.teamId,
        slackTeamName: token.teamName,
        slackUserId: token.authedUserId,
        slackUserName: userInfo?.name || null,
        accessToken: token.accessToken,
        botUserId: token.botUserId,
        scope: token.scope,
        connectedAt: new Date()
      }
    });

    res.redirect("/company?slack=connected");
  } catch (callbackError) {
    console.error("Slack callback failed", callbackError);
    res.redirect("/company?slack=failed");
  }
});

slackIntegrationRoutes.get("/status", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const connection = await prisma.slackConnection.findUnique({
    where: { userId: actorUser.id },
    select: {
      slackTeamId: true,
      slackTeamName: true,
      slackUserId: true,
      slackUserName: true,
      channelIds: true,
      channelNames: true,
      connectedAt: true,
      lastSyncedAt: true
    }
  });

  res.status(200).json({
    connection: statusFromConnection(connection)
  });
});

slackIntegrationRoutes.get("/connect-url", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const state = createSlackOAuthState({
    userId: actorUser.id,
    email: actorUser.email
  });
  const url = buildSlackAuthorizeUrl(state);

  res.status(200).json({ url });
});

slackIntegrationRoutes.get("/channels", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const connection = await prisma.slackConnection.findUnique({
    where: { userId: actorUser.id },
    select: {
      accessToken: true,
      channelIds: true
    }
  });

  if (!connection) {
    res.status(400).json({ error: "Slack is not connected" });
    return;
  }

  try {
    const channels = await listSlackChannels(connection.accessToken);
    const selectedIds = new Set(connection.channelIds);

    res.status(200).json({
      channels: channels.map((ch) => ({
        ...ch,
        isSelected: selectedIds.has(ch.id)
      }))
    });
  } catch (error) {
    console.error("Failed to list Slack channels", error);
    res.status(500).json({ error: "Failed to fetch Slack channels" });
  }
});

slackIntegrationRoutes.post("/configure-channels", requireCompanyWriteAccess, async (req, res) => {
  const parsed = configureChannelsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid channel config", details: parsed.error.flatten() });
    return;
  }

  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const connection = await prisma.slackConnection.findUnique({
    where: { userId: actorUser.id }
  });

  if (!connection) {
    res.status(400).json({ error: "Slack is not connected" });
    return;
  }

  const updated = await prisma.slackConnection.update({
    where: { id: connection.id },
    data: {
      channelIds: parsed.data.channelIds || [],
      channelNames: parsed.data.channelNames || []
    },
    select: {
      slackTeamId: true,
      slackTeamName: true,
      slackUserId: true,
      slackUserName: true,
      channelIds: true,
      channelNames: true,
      connectedAt: true,
      lastSyncedAt: true
    }
  });

  res.status(200).json({
    connection: statusFromConnection(updated)
  });
});

slackIntegrationRoutes.post("/import-messages", requireCompanyWriteAccess, async (req, res) => {
  const parsed = importMessagesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid import payload", details: parsed.error.flatten() });
    return;
  }

  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const connection = await prisma.slackConnection.findUnique({
    where: { userId: actorUser.id },
    select: {
      id: true,
      accessToken: true,
      channelIds: true,
      channelNames: true
    }
  });

  if (!connection) {
    res.status(400).json({ error: "Slack is not connected" });
    return;
  }

  if (!connection.channelIds.length) {
    res.status(400).json({ error: "No channels configured. Select channels to monitor first." });
    return;
  }

  const daysBack = parsed.data.daysBack ?? 7;
  const maxMessages = parsed.data.maxMessages ?? 100;
  const oldest = String((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);

  let imported = 0;
  let skipped = 0;
  let processed = 0;

  try {
    for (let i = 0; i < connection.channelIds.length; i++) {
      const channelId = connection.channelIds[i];
      const channelName = connection.channelNames[i] || channelId;

      const messages = await fetchSlackChannelMessages(connection.accessToken, channelId, {
        oldest,
        limit: Math.min(maxMessages, 100)
      });

      for (const msg of messages) {
        if (!msg.text || msg.text.length < 20) {
          skipped += 1;
          continue;
        }

        const sourceReferenceId = `slack-${channelId}-${msg.messageId}`;
        const cleanedText = scrubPii(msg.text);

        const context = [
          `Slack channel: #${channelName}`,
          msg.timestamp ? `Posted: ${new Date(parseFloat(msg.timestamp) * 1000).toISOString()}` : ""
        ]
          .filter(Boolean)
          .join(" • ");

        const rawText = [cleanedText, context ? `Context: ${context}` : ""].filter(Boolean).join("\n\n");

        const existing = await prisma.painEvent.findUnique({
          where: {
            source_sourceReferenceId: {
              source: "slack",
              sourceReferenceId
            }
          }
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        const painEvent = await prisma.painEvent.create({
          data: {
            userId: actorUser.id,
            source: "slack",
            sourceReferenceId,
            rawText: rawText.slice(0, 20000),
            status: "pending_ai"
          }
        });

        imported += 1;

        try {
          await processPainEvent(painEvent.id);
          processed += 1;
        } catch (processingError) {
          console.error("Failed to process Slack pain event", processingError);
        }
      }
    }

    await prisma.slackConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() }
    });

    res.status(200).json({
      imported,
      skipped,
      processed,
      channelsScanned: connection.channelIds.length
    });
  } catch (error) {
    console.error("Slack message import failed", error);
    res.status(500).json({ error: "Failed to import Slack messages" });
  }
});

slackIntegrationRoutes.post("/disconnect", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  await prisma.slackConnection.deleteMany({
    where: { userId: actorUser.id }
  });

  res.status(200).json({ ok: true });
});

// =============================================
// Slack Events API Webhook (Real-time messages)
// =============================================

// Raw body parser middleware for signature verification
let rawBodyBuffer: Buffer | null = null;

function captureRawBody(req: Request, _res: Response, next: NextFunction): void {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    data += chunk;
  });
  req.on("end", () => {
    rawBodyBuffer = Buffer.from(data);
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
}

slackIntegrationRoutes.post("/events", captureRawBody, async (req, res) => {
  // Verify Slack signature
  const slackSignature = req.headers["x-slack-signature"] as string || "";
  const slackTimestamp = req.headers["x-slack-request-timestamp"] as string || "";
  const rawBody = rawBodyBuffer?.toString() || JSON.stringify(req.body);

  if (!verifySlackSignature(slackSignature, slackTimestamp, rawBody)) {
    console.warn("[Slack Events] Invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = req.body as SlackEventPayload;

  // Handle URL verification challenge
  if (payload.type === "url_verification" && payload.challenge) {
    console.log("[Slack Events] URL verification challenge received");
    res.status(200).json({ challenge: payload.challenge });
    return;
  }

  // Handle event callbacks
  if (payload.type === "event_callback" && payload.event) {
    const event = payload.event;
    const teamId = payload.team_id;

    // Ignore bot messages and message edits
    if (event.bot_id || event.subtype) {
      res.status(200).json({ ok: true });
      return;
    }

    // Only handle message events
    if (event.type !== "message" || !event.text || !event.channel) {
      res.status(200).json({ ok: true });
      return;
    }

    // Respond immediately to avoid timeout (Slack requires response within 3s)
    res.status(200).json({ ok: true });

    // Process message asynchronously
    processSlackEventMessage({
      teamId: teamId || "",
      channelId: event.channel,
      userId: event.user || "",
      text: event.text,
      messageTs: event.ts || "",
      threadTs: event.thread_ts
    }).catch((err) => {
      console.error("[Slack Events] Error processing message:", err);
    });

    return;
  }

  res.status(200).json({ ok: true });
});

interface SlackEventMessage {
  teamId: string;
  channelId: string;
  userId: string;
  text: string;
  messageTs: string;
  threadTs?: string;
}

async function processSlackEventMessage(msg: SlackEventMessage): Promise<void> {
  // Find the Slack connection for this team
  const connection = await prisma.slackConnection.findFirst({
    where: {
      slackTeamId: msg.teamId,
      channelIds: { has: msg.channelId }
    },
    include: {
      user: true
    }
  });

  if (!connection) {
    console.log("[Slack Events] No connection configured for this channel/team");
    return;
  }

  // Classify the message
  const classification = classifySlackMessage(msg.text);
  if (classification === "noise") {
    console.log("[Slack Events] Skipping noise message");
    return;
  }

  // Get channel info
  const channelInfo = await fetchSlackChannelInfo(connection.accessToken, msg.channelId);
  const channelName = channelInfo?.name || msg.channelId;

  // Build context from thread if it's a thread reply
  let fullText = msg.text;
  let context = `Slack channel: #${channelName}`;

  if (msg.threadTs && msg.threadTs !== msg.messageTs) {
    const threadContext = await buildThreadContext(
      connection.accessToken,
      msg.channelId,
      msg.threadTs,
      channelName
    );
    if (threadContext) {
      fullText = `${threadContext}\n\n[Latest message]\n${msg.text}`;
    }
    context += " (thread reply)";
  }

  // Get user info and map to PainSolver user for correct MRR attribution
  const userInfo = await fetchSlackUserInfo(connection.accessToken, msg.userId);
  if (userInfo?.name) {
    context += ` • From: ${userInfo.name}`;
  }

  // Try to map Slack user email to a PainSolver user for accurate attribution
  let painEventUserId = connection.userId;
  const slackUserEmail = userInfo?.email;
  if (slackUserEmail) {
    const matchedUser = await prisma.user.findUnique({
      where: { email: slackUserEmail.toLowerCase() }
    });
    if (matchedUser) {
      painEventUserId = matchedUser.id;
    }
  }

  // Check for duplicate
  const sourceReferenceId = `slack-${msg.channelId}-${msg.messageTs}`;
  const existing = await prisma.painEvent.findUnique({
    where: {
      source_sourceReferenceId: {
        source: "slack",
        sourceReferenceId
      }
    }
  });

  if (existing) {
    console.log("[Slack Events] Duplicate message, skipping");
    return;
  }

  // Scrub PII and create pain event
  const cleanedText = scrubPii(fullText);
  const rawText = [
    cleanedText,
    `Context: ${context}`,
    `Classification: ${classification}`
  ].join("\n\n");

  const painEvent = await prisma.painEvent.create({
    data: {
      userId: painEventUserId,
      source: "slack",
      sourceReferenceId,
      rawText: rawText.slice(0, 20000),
      status: "pending_ai"
    }
  });

  console.log(`[Slack Events] Created pain event ${painEvent.id} from #${channelName}`);

  // Process with AI
  try {
    const result = await processPainEvent(painEvent.id);
    
    // Send acknowledgment back to Slack if we matched/created an idea
    if (result && connection.accessToken) {
      const threadTs = msg.threadTs || msg.messageTs;
      
      if (result.status === "auto_merged" && result.matchedPostId) {
        // Get the matched post title
        const matchedPost = await prisma.post.findUnique({
          where: { id: result.matchedPostId },
          select: { title: true }
        });
        
        if (matchedPost) {
          await postSlackMessage(
            connection.accessToken,
            msg.channelId,
            `📊 This looks like feedback for: *${matchedPost.title}* — vote recorded!`,
            { threadTs }
          );
        }
      } else if (result.status === "needs_triage") {
        await postSlackMessage(
          connection.accessToken,
          msg.channelId,
          `💡 Feedback captured! It will be reviewed in the AI Inbox.`,
          { threadTs }
        );
      }
    }
  } catch (err) {
    console.error("[Slack Events] Failed to process pain event:", err);
  }
}

// =============================================
// Slack Notifications (Post status changes back)
// =============================================

/**
 * Notify Slack channel when an idea status changes
 * Called from post update flows
 */
export async function notifySlackStatusChange(input: {
  postId: string;
  postTitle: string;
  oldStatus: string;
  newStatus: string;
  boardId: string;
}): Promise<void> {
  // Find any Slack connections that have been used for this type of feedback
  const painEvents = await prisma.painEvent.findMany({
    where: {
      source: "slack",
      matchedPostId: input.postId
    },
    select: {
      sourceReferenceId: true,
      userId: true
    },
    take: 5
  });

  if (painEvents.length === 0) return;

  // Get unique user connections
  const userIds = Array.from(new Set(painEvents.map((e) => e.userId)));
  
  for (const userId of userIds) {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: {
        accessToken: true,
        channelIds: true
      }
    });

    if (!connection || connection.channelIds.length === 0) continue;

    // Post to the first configured channel
    const statusEmoji = {
      planned: "📋",
      in_progress: "🚧",
      complete: "✅",
      shipped: "🚀"
    }[input.newStatus] || "📝";

    const message = `${statusEmoji} *Status Update*: "${input.postTitle}" moved to *${input.newStatus.replace("_", " ")}*`;

    try {
      await postSlackMessage(connection.accessToken, connection.channelIds[0], message);
    } catch (err) {
      console.error("[Slack] Failed to post status notification:", err);
    }
  }
}

