import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { aiProcessingQueue } from "../lib/queue";
import { scrubPii } from "../lib/pii";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";
import { getOrCreateActorUser } from "../services/workspaceDataService";
import { processPainEvent } from "../services/painEventService";
import {
  buildZoomAuthorizeUrl,
  createZoomOAuthState,
  exchangeZoomAuthorizationCode,
  fetchZoomProfile,
  listZoomTranscriptImports,
  parseZoomOAuthState,
  refreshZoomAccessToken,
  ZoomConnectionStatusView
} from "../services/zoomService";

const importTranscriptsSchema = z.object({
  daysBack: z.coerce.number().int().min(1).max(365).optional(),
  maxMeetings: z.coerce.number().int().min(1).max(100).optional()
});

function statusFromConnection(connection: {
  zoomUserEmail: string | null;
  zoomUserId: string;
  zoomAccountId: string | null;
  expiresAt: Date | null;
  connectedAt: Date;
  lastSyncedAt: Date | null;
} | null): ZoomConnectionStatusView {
  if (!connection) {
    return {
      connected: false,
      zoomUserEmail: null,
      zoomUserId: null,
      zoomAccountId: null,
      expiresAt: null,
      connectedAt: null,
      lastSyncedAt: null
    };
  }

  return {
    connected: true,
    zoomUserEmail: connection.zoomUserEmail,
    zoomUserId: connection.zoomUserId,
    zoomAccountId: connection.zoomAccountId,
    expiresAt: connection.expiresAt ? connection.expiresAt.toISOString() : null,
    connectedAt: connection.connectedAt.toISOString(),
    lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null
  };
}

async function refreshConnectionIfNeeded(connection: {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
}): Promise<{
  id: string;
  accessToken: string;
}> {
  const expiresSoon =
    connection.expiresAt && connection.expiresAt.getTime() <= Date.now() + 60 * 1000;

  if (!expiresSoon) {
    return {
      id: connection.id,
      accessToken: connection.accessToken
    };
  }

  const refreshed = await refreshZoomAccessToken(connection.refreshToken);
  const updated = await prisma.zoomConnection.update({
    where: {
      id: connection.id
    },
    data: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      tokenType: refreshed.tokenType,
      scope: refreshed.scope,
      expiresAt: refreshed.expiresAt
    }
  });

  return {
    id: updated.id,
    accessToken: updated.accessToken
  };
}

export const zoomIntegrationRoutes = Router();

zoomIntegrationRoutes.get("/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";

  if (error) {
    res.redirect(`/company?zoom=error&reason=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing Zoom callback parameters" });
    return;
  }

  const statePayload = parseZoomOAuthState(state);
  if (!statePayload) {
    res.status(400).json({ error: "Invalid or expired Zoom state" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: statePayload.userId
    }
  });

  if (!user || user.email.toLowerCase() !== statePayload.email.toLowerCase()) {
    res.status(404).json({ error: "User not found for Zoom connection" });
    return;
  }

  try {
    const token = await exchangeZoomAuthorizationCode(code);
    const profile = await fetchZoomProfile(token.accessToken);

    await prisma.zoomConnection.upsert({
      where: {
        userId: user.id
      },
      update: {
        zoomUserId: profile.id,
        zoomAccountId: profile.account_id ?? null,
        zoomUserEmail: profile.email ?? user.email,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenType: token.tokenType,
        scope: token.scope,
        expiresAt: token.expiresAt,
        connectedAt: new Date()
      },
      create: {
        userId: user.id,
        zoomUserId: profile.id,
        zoomAccountId: profile.account_id ?? null,
        zoomUserEmail: profile.email ?? user.email,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenType: token.tokenType,
        scope: token.scope,
        expiresAt: token.expiresAt,
        connectedAt: new Date()
      }
    });

    res.redirect("/company?zoom=connected");
  } catch (callbackError) {
    console.error("Zoom callback failed", callbackError);
    res.redirect("/company?zoom=failed");
  }
});

zoomIntegrationRoutes.get("/status", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const connection = await prisma.zoomConnection.findUnique({
    where: {
      userId: actorUser.id
    },
    select: {
      zoomUserEmail: true,
      zoomUserId: true,
      zoomAccountId: true,
      expiresAt: true,
      connectedAt: true,
      lastSyncedAt: true
    }
  });

  res.status(200).json({
    connection: statusFromConnection(connection)
  });
});

zoomIntegrationRoutes.get("/connect-url", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const state = createZoomOAuthState({
    userId: actorUser.id,
    email: actorUser.email
  });
  const url = buildZoomAuthorizeUrl(state);

  res.status(200).json({ url });
});

zoomIntegrationRoutes.post("/disconnect", requireCompanyWriteAccess, async (req, res) => {
  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  await prisma.zoomConnection.deleteMany({
    where: {
      userId: actorUser.id
    }
  });

  res.status(200).json({
    ok: true
  });
});

zoomIntegrationRoutes.post("/import-transcripts", requireCompanyWriteAccess, async (req, res) => {
  const parsed = importTranscriptsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid import payload", details: parsed.error.flatten() });
    return;
  }

  const actorUser = await getOrCreateActorUser(req.actor);
  if (!actorUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const connection = await prisma.zoomConnection.findUnique({
    where: {
      userId: actorUser.id
    },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true
    }
  });

  if (!connection) {
    res.status(400).json({ error: "Zoom is not connected for this user" });
    return;
  }

  try {
    const refreshed = await refreshConnectionIfNeeded(connection);
    const transcriptItems = await listZoomTranscriptImports({
      accessToken: refreshed.accessToken,
      daysBack: parsed.data.daysBack ?? 30,
      maxMeetings: parsed.data.maxMeetings ?? 40
    });

    let imported = 0;
    let skipped = 0;
    let queued = 0;
    let processed = 0;
    const events: Array<{ painEventId: string; sourceReferenceId: string; topic: string }> = [];

    for (const item of transcriptItems) {
      const cleanedTranscript = scrubPii(item.transcriptText);
      const context = [
        item.topic ? `Zoom call topic: ${item.topic}` : "",
        item.startedAt ? `Call date: ${item.startedAt}` : "",
        item.hostEmail ? `Host: ${item.hostEmail}` : ""
      ]
        .filter(Boolean)
        .join(" • ");
      const rawText = [cleanedTranscript, context ? `Context: ${context}` : ""]
        .filter(Boolean)
        .join("\n\n");

      if (!cleanedTranscript || cleanedTranscript.length < 30) {
        skipped += 1;
        continue;
      }

      const painEvent = await prisma.$transaction(async (tx) => {
        const existing = await tx.painEvent.findUnique({
          where: {
            source_sourceReferenceId: {
              source: "zoom",
              sourceReferenceId: item.sourceReferenceId
            }
          }
        });

        if (existing) {
          return null;
        }

        return tx.painEvent.create({
          data: {
            userId: actorUser.id,
            source: "zoom",
            sourceReferenceId: item.sourceReferenceId,
            rawText: rawText.slice(0, 20000),
            status: "pending_ai"
          }
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      });

      if (!painEvent) {
        skipped += 1;
        continue;
      }

      imported += 1;
      events.push({
        painEventId: painEvent.id,
        sourceReferenceId: item.sourceReferenceId,
        topic: item.topic
      });

      try {
        await aiProcessingQueue.add("process-pain-event", {
          painEventId: painEvent.id
        });
        queued += 1;
      } catch (queueError) {
        console.error("Failed to enqueue Zoom transcript pain event", queueError);
      }

      // Keep Zoom import immediately actionable even when worker process isn't running.
      try {
        await processPainEvent(painEvent.id);
        processed += 1;
      } catch (processingError) {
        console.error("Failed to process imported Zoom pain event", processingError);
      }
    }

    await prisma.zoomConnection.update({
      where: {
        id: refreshed.id
      },
      data: {
        lastSyncedAt: new Date()
      }
    });

    res.status(200).json({
      imported,
      skipped,
      queued,
      processed,
      events
    });
  } catch (importError) {
    console.error("Zoom transcript import failed", importError);
    res.status(500).json({ error: "Failed to import Zoom transcripts" });
  }
});
