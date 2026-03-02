import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { scrubPii } from "../lib/pii";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";
import { getOrCreateActorUser } from "../services/workspaceDataService";
import { processPainEvent } from "../services/painEventService";
import {
  buildSlackAuthorizeUrl,
  createSlackOAuthState,
  defaultSlackConnection,
  exchangeSlackAuthorizationCode,
  fetchSlackChannelMessages,
  fetchSlackUserInfo,
  listSlackChannels,
  parseSlackOAuthState,
  SlackConnectionStatusView
} from "../services/slackService";

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

