import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction, Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
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
  formatTranscriptForAI,
  handleZoomChallenge,
  identifyFeedbackSegments,
  listZoomTranscriptImports,
  parseVttWithSpeakers,
  parseZoomOAuthState,
  refreshZoomAccessToken,
  verifyZoomWebhookSignature,
  ZoomConnectionStatusView,
  ZoomWebhookPayload
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

// =============================================
// Zoom Webhook (Automated transcript capture)
// =============================================

// Raw body capture for signature verification
let zoomRawBodyBuffer: string = "";

function captureZoomRawBody(req: Request, _res: Response, next: NextFunction): void {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    data += chunk;
  });
  req.on("end", () => {
    zoomRawBodyBuffer = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
}

/**
 * Zoom webhook endpoint
 * Configure in Zoom Marketplace App -> Feature -> Event Subscriptions
 * Event types: recording.completed, recording.transcript_completed
 */
zoomIntegrationRoutes.post("/webhook", captureZoomRawBody, async (req, res) => {
  const payload = req.body as ZoomWebhookPayload;

  // Handle URL validation challenge
  if (payload.event === "endpoint.url_validation") {
    const plainToken = (payload.payload as unknown as { plainToken: string })?.plainToken;
    if (plainToken) {
      const response = handleZoomChallenge(plainToken);
      res.status(200).json(response);
      return;
    }
  }

  // Verify webhook signature
  const signature = req.headers["x-zm-signature"] as string || "";
  const timestamp = req.headers["x-zm-request-timestamp"] as string || "";
  
  if (!verifyZoomWebhookSignature(signature, timestamp, zoomRawBodyBuffer)) {
    console.warn("[Zoom Webhook] Invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Respond immediately
  res.status(200).json({ ok: true });

  console.log("[Zoom Webhook] Received event:", payload.event);

  // Handle recording.completed or recording.transcript_completed
  if (payload.event !== "recording.completed" && payload.event !== "recording.transcript_completed") {
    console.log("[Zoom Webhook] Ignoring event:", payload.event);
    return;
  }

  // Process asynchronously
  processZoomRecordingEvent(payload).catch((err) => {
    console.error("[Zoom Webhook] Error processing recording:", err);
  });
});

async function processZoomRecordingEvent(payload: ZoomWebhookPayload): Promise<void> {
  const recording = payload.payload?.object;
  if (!recording) {
    console.log("[Zoom Webhook] No recording object in payload");
    return;
  }

  const meetingUuid = recording.uuid || String(recording.id || "");
  if (!meetingUuid) {
    console.log("[Zoom Webhook] No meeting UUID");
    return;
  }

  // Find transcript files
  const transcriptFiles = (recording.recording_files || []).filter((file) => {
    const type = String(file.file_type ?? "").toUpperCase();
    const recordingType = String(file.recording_type ?? "").toLowerCase();
    const extension = String(file.file_extension ?? "").toLowerCase();
    const status = String(file.status ?? "").toLowerCase();
    
    if (status && status !== "completed") return false;
    return type === "TRANSCRIPT" || recordingType.includes("transcript") || extension === "vtt";
  });

  if (transcriptFiles.length === 0) {
    console.log("[Zoom Webhook] No transcript files found");
    return;
  }

  // Find a user with Zoom connection for this account
  const accountId = payload.payload?.account_id;
  const connection = await prisma.zoomConnection.findFirst({
    where: accountId ? { zoomAccountId: accountId } : {},
    select: {
      id: true,
      userId: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true
    }
  });

  if (!connection) {
    console.log("[Zoom Webhook] No Zoom connection found for account:", accountId);
    return;
  }

  // Refresh token if needed
  const refreshed = await refreshConnectionIfNeeded(connection);

  for (const file of transcriptFiles) {
    const fileId = String(file.id ?? "").trim();
    const downloadUrl = String(file.download_url ?? "").trim();
    
    if (!fileId || !downloadUrl) continue;

    const sourceReferenceId = `zoom:${meetingUuid}:${fileId}`;

    // Check for duplicate
    const existing = await prisma.painEvent.findUnique({
      where: {
        source_sourceReferenceId: {
          source: "zoom",
          sourceReferenceId
        }
      }
    });

    if (existing) {
      console.log("[Zoom Webhook] Duplicate transcript, skipping");
      continue;
    }

    try {
      // Fetch transcript
      const transcriptResponse = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${refreshed.accessToken}` }
      });

      if (!transcriptResponse.ok) {
        // Try with access_token in URL
        const separator = downloadUrl.includes("?") ? "&" : "?";
        const fallbackUrl = `${downloadUrl}${separator}access_token=${encodeURIComponent(refreshed.accessToken)}`;
        const fallbackResponse = await fetch(fallbackUrl);
        
        if (!fallbackResponse.ok) {
          console.error("[Zoom Webhook] Failed to fetch transcript");
          continue;
        }
        
        var rawVtt = await fallbackResponse.text();
      } else {
        var rawVtt = await transcriptResponse.text();
      }

      // Parse with speaker diarization
      const utterances = parseVttWithSpeakers(rawVtt);
      const formattedTranscript = formatTranscriptForAI(utterances);

      // Identify multiple feedback segments for multi-topic extraction
      const feedbackSegments = identifyFeedbackSegments(formattedTranscript);
      
      if (feedbackSegments.length === 0) {
        // No clear feedback identified, process entire transcript
        feedbackSegments.push(formattedTranscript);
      }

      const topic = String(recording.topic ?? "").trim() || "Zoom call";
      const hostEmail = recording.host_email ?? null;
      const startedAt = recording.start_time ?? null;

      // Map host email to PainSolver user for accurate attribution
      let painEventUserId = connection.userId;
      if (hostEmail) {
        const hostUser = await prisma.user.findUnique({
          where: { email: hostEmail.toLowerCase() }
        });
        if (hostUser) {
          painEventUserId = hostUser.id;
        }
      }

      // Create pain events for each identified segment
      for (let i = 0; i < feedbackSegments.length; i++) {
        const segment = feedbackSegments[i];
        const segmentId = feedbackSegments.length > 1 
          ? `${sourceReferenceId}:segment-${i + 1}` 
          : sourceReferenceId;

        // Check for duplicate segment
        const existingSegment = await prisma.painEvent.findUnique({
          where: {
            source_sourceReferenceId: {
              source: "zoom",
              sourceReferenceId: segmentId
            }
          }
        });

        if (existingSegment) continue;

        const cleanedTranscript = scrubPii(segment);
        const context = [
          `Zoom call topic: ${topic}`,
          startedAt ? `Call date: ${startedAt}` : "",
          hostEmail ? `Host: ${hostEmail}` : "",
          feedbackSegments.length > 1 ? `Segment ${i + 1} of ${feedbackSegments.length}` : ""
        ].filter(Boolean).join(" • ");

        const rawText = [
          cleanedTranscript,
          context ? `Context: ${context}` : ""
        ].filter(Boolean).join("\n\n");

        if (rawText.length < 50) continue;

        const painEvent = await prisma.painEvent.create({
          data: {
            userId: painEventUserId,
            source: "zoom",
            sourceReferenceId: segmentId,
            rawText: rawText.slice(0, 20000),
            status: "pending_ai"
          }
        });

        console.log(`[Zoom Webhook] Created pain event ${painEvent.id} for segment ${i + 1} (user: ${painEventUserId})`);

        // Process immediately
        try {
          await processPainEvent(painEvent.id);
        } catch (err) {
          console.error("[Zoom Webhook] Failed to process pain event:", err);
        }
      }

      // Update last synced
      await prisma.zoomConnection.update({
        where: { id: refreshed.id },
        data: { lastSyncedAt: new Date() }
      });

    } catch (err) {
      console.error("[Zoom Webhook] Error processing transcript file:", err);
    }
  }
}

/**
 * Get webhook URL for Zoom setup
 */
zoomIntegrationRoutes.get("/webhook-url", requireCompanyWriteAccess, (_req, res) => {
  res.status(200).json({
    url: `${env.APP_URL}/api/integrations/zoom/webhook`,
    events: ["recording.completed", "recording.transcript_completed"],
    instructions: "Add this URL in your Zoom App's Event Subscriptions settings."
  });
});
