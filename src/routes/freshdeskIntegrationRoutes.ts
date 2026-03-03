import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";
import { ingestFreshdeskSignal } from "../services/freshdeskIngestionService";
import { processPainEvent } from "../services/painEventService";
import {
  addFreshdeskTicketNote,
  fetchFreshdeskTicketConversation,
  FreshdeskWebhookPayload,
  listFreshdeskTicketFields,
  listFreshdeskTickets,
  mapPainSolverStatusToFreshdesk,
  matchesFreshdeskFieldFilter,
  normalizeFreshdeskDomain,
  parseWebhookPayload,
  statusFromFreshdeskConfig,
  updateFreshdeskTicketStatus
} from "../services/freshdeskService";
import { scrubPii } from "../lib/pii";

const configureFreshdeskSchema = z.object({
  domain: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
  filterField: z.string().trim().optional(),
  filterValue: z.string().trim().optional(),
  clearApiKey: z.boolean().optional()
});

const importTicketsSchema = z.object({
  daysBack: z.coerce.number().int().min(1).max(365).optional(),
  maxTickets: z.coerce.number().int().min(1).max(300).optional(),
  processInline: z.boolean().optional()
});

const freshdeskConfigSelect = {
  id: true,
  source: true,
  enabled: true,
  freshdeskDomain: true,
  freshdeskApiKey: true,
  freshdeskFilterField: true,
  freshdeskFilterValue: true,
  freshdeskFieldCatalog: true,
  freshdeskLastFieldSyncAt: true,
  freshdeskLastTicketSyncAt: true
} satisfies Prisma.AiInboxConfigSelect;

type FreshdeskConfigRecord = Prisma.AiInboxConfigGetPayload<{
  select: typeof freshdeskConfigSelect;
}>;

async function ensureFreshdeskConfig(): Promise<FreshdeskConfigRecord> {
  return prisma.aiInboxConfig.upsert({
    where: {
      source: "freshdesk"
    },
    update: {},
    create: {
      source: "freshdesk",
      routingMode: "central",
      enabled: true
    },
    select: freshdeskConfigSelect
  });
}

async function syncFreshdeskParams(config: FreshdeskConfigRecord): Promise<{
  config: FreshdeskConfigRecord;
  params: Array<{ key: string; label: string; type: string; choices: string[] }>;
}> {
  const domain = config.freshdeskDomain ?? "";
  const apiKey = config.freshdeskApiKey ?? "";

  if ((!domain || !apiKey) && !env.USE_MOCK_FRESHDESK) {
    throw new Error("Connect Freshdesk first by adding domain and API key.");
  }

  const params = await listFreshdeskTicketFields({
    domain,
    apiKey
  });

  const saved = await prisma.aiInboxConfig.update({
    where: {
      id: config.id
    },
    data: {
      freshdeskFieldCatalog: params as unknown as Prisma.InputJsonValue,
      freshdeskLastFieldSyncAt: new Date()
    },
    select: freshdeskConfigSelect
  });

  return {
    config: saved,
    params
  };
}

function fieldsFromConfig(config: FreshdeskConfigRecord): Array<{
  key: string;
  label: string;
  type: string;
  choices: string[];
}> {
  const raw = config.freshdeskFieldCatalog;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((field) => {
      if (!field || typeof field !== "object") {
        return null;
      }
      const record = field as Record<string, unknown>;
      const key = String(record.key ?? "").trim();
      const label = String(record.label ?? key).trim();
      if (!key || !label) {
        return null;
      }
      return {
        key,
        label,
        type: String(record.type ?? "text"),
        choices: Array.isArray(record.choices)
          ? record.choices.map((choice) => String(choice))
          : []
      };
    })
    .filter((field): field is { key: string; label: string; type: string; choices: string[] } => Boolean(field));
}

export const freshdeskIntegrationRoutes = Router();

// =============================================
// Freshdesk Webhook (Real-time ticket events)
// Registered BEFORE requireCompanyWriteAccess since
// Freshdesk sends webhooks without company auth headers.
// =============================================

/**
 * Webhook endpoint for Freshdesk automation rules
 * Configure in Freshdesk: Admin -> Automations -> Ticket Updates -> Webhook
 * URL: {APP_URL}/api/integrations/freshdesk/webhook
 * Add header: x-freshdesk-webhook-token: <your FRESHDESK_WEBHOOK_TOKEN from .env>
 */
freshdeskIntegrationRoutes.post("/webhook", async (req, res) => {
  // Verify webhook authentication token
  const expectedToken = env.FRESHDESK_WEBHOOK_TOKEN;
  if (expectedToken) {
    const providedToken = req.headers["x-freshdesk-webhook-token"] as string | undefined;
    if (providedToken !== expectedToken) {
      console.warn("[Freshdesk Webhook] Authentication failed - invalid or missing token");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } else {
    console.warn("[Freshdesk Webhook] No FRESHDESK_WEBHOOK_TOKEN configured - webhook is unauthenticated");
  }

  const payload = req.body as FreshdeskWebhookPayload;

  console.log("[Freshdesk Webhook] Received event:", {
    ticketId: payload.ticket_id,
    event: payload.triggered_event,
    subject: payload.ticket_subject
  });

  // Parse the webhook payload
  const ticketData = parseWebhookPayload(payload);
  if (!ticketData) {
    res.status(200).json({ ok: true, ignored: true, reason: "invalid_payload" });
    return;
  }

  // Get Freshdesk config to check filters
  const config = await ensureFreshdeskConfig();

  if (!config.enabled) {
    res.status(200).json({ ok: true, ignored: true, reason: "source_disabled" });
    return;
  }

  // Check if ticket matches filters (try both raw payload and nested ticket object)
  const matchesRaw = matchesFreshdeskFieldFilter({
    payload: ticketData.rawTicket,
    filterField: config.freshdeskFilterField,
    filterValue: config.freshdeskFilterValue
  });
  const matchesRoot = matchesFreshdeskFieldFilter({
    payload: payload,
    filterField: config.freshdeskFilterField,
    filterValue: config.freshdeskFilterValue
  });

  if (!matchesRaw && !matchesRoot) {
    res.status(200).json({ ok: true, ignored: true, reason: "filter_no_match" });
    return;
  }

  // Respond 202 Accepted - processing continues async
  res.status(202).json({ ok: true, ticketId: ticketData.sourceReferenceId });

  try {
    // Fetch full conversation if we have API credentials
    let fullContext = ticketData.description;
    if (config.freshdeskDomain && config.freshdeskApiKey) {
      try {
        const conversation = await fetchFreshdeskTicketConversation({
          domain: config.freshdeskDomain,
          apiKey: config.freshdeskApiKey,
          ticketId: ticketData.sourceReferenceId
        });
        if (conversation.length > 0) {
          fullContext = conversation.join("\n\n") + "\n\n[Latest message]\n" + ticketData.description;
        }
      } catch (convErr) {
        console.warn("[Freshdesk Webhook] Failed to fetch conversation, using description only:", convErr);
      }
    }

    await ingestFreshdeskSignal({
      sourceReferenceId: ticketData.sourceReferenceId,
      requesterEmail: ticketData.requesterEmail,
      requesterName: ticketData.requesterName,
      description: scrubPii(fullContext)
    }, {
      processInline: true
    });

    console.log(`[Freshdesk Webhook] Processed ticket ${ticketData.sourceReferenceId}`);
  } catch (error) {
    console.error("[Freshdesk Webhook] Error processing ticket:", error);
  }
});

// All routes below require company admin/member auth
freshdeskIntegrationRoutes.use(requireCompanyWriteAccess);

freshdeskIntegrationRoutes.get("/status", async (_req, res) => {
  const config = await ensureFreshdeskConfig();
  res.status(200).json({
    source: {
      source: "freshdesk",
      enabled: config.enabled
    },
    connection: statusFromFreshdeskConfig(config),
    params: fieldsFromConfig(config)
  });
});

freshdeskIntegrationRoutes.post("/configure", async (req, res) => {
  const parsed = configureFreshdeskSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Freshdesk config payload", details: parsed.error.flatten() });
    return;
  }

  const existing = await ensureFreshdeskConfig();
  const payload = parsed.data;

  const updateData: Prisma.AiInboxConfigUpdateInput = {};

  try {
    if (typeof payload.domain === "string") {
      const domain = payload.domain.trim();
      updateData.freshdeskDomain = domain ? normalizeFreshdeskDomain(domain) : null;
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid Freshdesk domain" });
    return;
  }

  if (typeof payload.apiKey === "string") {
    updateData.freshdeskApiKey = payload.apiKey.trim() || null;
  }

  if (payload.clearApiKey) {
    updateData.freshdeskApiKey = null;
  }

  if (typeof payload.filterField === "string") {
    updateData.freshdeskFilterField = payload.filterField.trim() || null;
  }

  if (typeof payload.filterValue === "string") {
    updateData.freshdeskFilterValue = payload.filterValue.trim() || null;
  }

  const config = await prisma.aiInboxConfig.update({
    where: {
      id: existing.id
    },
    data: updateData,
    select: freshdeskConfigSelect
  });

  res.status(200).json({
    source: {
      source: "freshdesk",
      enabled: config.enabled
    },
    connection: statusFromFreshdeskConfig(config),
    params: fieldsFromConfig(config)
  });
});

freshdeskIntegrationRoutes.get("/params", async (_req, res) => {
  const config = await ensureFreshdeskConfig();

  try {
    const synced = await syncFreshdeskParams(config);

    res.status(200).json({
      connection: statusFromFreshdeskConfig(synced.config),
      params: synced.params
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Connect Freshdesk first")) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Failed to sync Freshdesk params", error);
    res.status(500).json({ error: "Failed to fetch Freshdesk params" });
  }
});

freshdeskIntegrationRoutes.get("/fields", async (_req, res) => {
  const config = await ensureFreshdeskConfig();

  try {
    const synced = await syncFreshdeskParams(config);
    res.status(200).json({
      connection: statusFromFreshdeskConfig(synced.config),
      params: synced.params
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Connect Freshdesk first")) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Failed to sync Freshdesk fields", error);
    res.status(500).json({ error: "Failed to fetch Freshdesk fields" });
  }
});

freshdeskIntegrationRoutes.post("/import-tickets", async (req, res) => {
  const parsed = importTicketsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Freshdesk import payload", details: parsed.error.flatten() });
    return;
  }

  const config = await ensureFreshdeskConfig();
  const domain = config.freshdeskDomain ?? "";
  const apiKey = config.freshdeskApiKey ?? "";

  if (!config.enabled) {
    res.status(400).json({ error: "Freshdesk source is paused. Enable it in routing settings first." });
    return;
  }

  if ((!domain || !apiKey) && !env.USE_MOCK_FRESHDESK) {
    res.status(400).json({ error: "Connect Freshdesk first by adding domain and API key." });
    return;
  }

  const processInline = parsed.data.processInline !== false;

  try {
    const tickets = await listFreshdeskTickets({
      domain,
      apiKey,
      daysBack: parsed.data.daysBack,
      maxTickets: parsed.data.maxTickets
    });

    let matched = 0;
    let imported = 0;

    for (const ticket of tickets) {
      const matches = matchesFreshdeskFieldFilter({
        payload: ticket.rawTicket,
        filterField: config.freshdeskFilterField,
        filterValue: config.freshdeskFilterValue
      });

      if (!matches) {
        continue;
      }

      matched += 1;

      // Enrich with conversation context if API credentials available
      let enrichedDescription = ticket.description;
      if (domain && apiKey) {
        try {
          const conversation = await fetchFreshdeskTicketConversation({
            domain,
            apiKey,
            ticketId: ticket.sourceReferenceId
          });
          if (conversation.length > 0) {
            enrichedDescription = conversation.join("\n\n") + "\n\n[Ticket description]\n" + ticket.description;
          }
        } catch (convErr) {
          // Continue with original description if conversation fetch fails
          console.warn(`[Freshdesk Import] Failed to fetch conversation for ticket ${ticket.sourceReferenceId}:`, convErr);
        }
      }

      await ingestFreshdeskSignal(
        {
          sourceReferenceId: ticket.sourceReferenceId,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requesterName,
          description: enrichedDescription
        },
        {
          processInline
        }
      );
      imported += 1;
    }

    const saved = await prisma.aiInboxConfig.update({
      where: {
        id: config.id
      },
      data: {
        freshdeskLastTicketSyncAt: new Date()
      },
      select: freshdeskConfigSelect
    });

    res.status(200).json({
      scanned: tickets.length,
      matched,
      imported,
      processInline,
      connection: statusFromFreshdeskConfig(saved)
    });
  } catch (error) {
    console.error("Failed to import Freshdesk tickets", error);
    res.status(500).json({ error: "Failed to import Freshdesk tickets" });
  }
});

freshdeskIntegrationRoutes.post("/disconnect", async (_req, res) => {
  const config = await ensureFreshdeskConfig();
  const updated = await prisma.aiInboxConfig.update({
    where: {
      id: config.id
    },
    data: {
      freshdeskDomain: null,
      freshdeskApiKey: null,
      freshdeskFilterField: null,
      freshdeskFilterValue: null,
      freshdeskFieldCatalog: Prisma.JsonNull,
      freshdeskLastFieldSyncAt: null,
      freshdeskLastTicketSyncAt: null
    },
    select: freshdeskConfigSelect
  });

  res.status(200).json({
    ok: true,
    connection: statusFromFreshdeskConfig(updated),
    params: []
  });
});

// =============================================
// Bi-directional Sync (PainSolver -> Freshdesk)
// =============================================

/**
 * Notify Freshdesk when a PainSolver post status changes
 * Called from post update flows
 */
export async function notifyFreshdeskStatusChange(input: {
  postId: string;
  postTitle: string;
  oldStatus: string;
  newStatus: string;
}): Promise<void> {
  // Find pain events from Freshdesk that are matched to this post
  const painEvents = await prisma.painEvent.findMany({
    where: {
      source: "freshdesk",
      matchedPostId: input.postId
    },
    select: {
      sourceReferenceId: true
    },
    take: 10
  });

  if (painEvents.length === 0) return;

  // Get Freshdesk config
  const config = await prisma.aiInboxConfig.findUnique({
    where: { source: "freshdesk" },
    select: {
      freshdeskDomain: true,
      freshdeskApiKey: true
    }
  });

  if (!config?.freshdeskDomain || !config?.freshdeskApiKey) {
    console.log("[Freshdesk Sync] No credentials configured, skipping sync");
    return;
  }

  const statusEmoji: Record<string, string> = {
    planned: "📋",
    in_progress: "🚧",
    complete: "✅",
    shipped: "🚀"
  };

  for (const event of painEvents) {
    // Extract ticket ID (sourceReferenceId format: "freshdesk-12345" or just "12345")
    const ticketId = event.sourceReferenceId.replace(/^freshdesk-/, "");
    
    try {
      // Add a note to the Freshdesk ticket
      const noteBody = `${statusEmoji[input.newStatus] || "📝"} **PainSolver Update**\n\n` +
        `Feature request "${input.postTitle}" has been moved to **${input.newStatus.replace("_", " ")}**.\n\n` +
        `View in PainSolver: ${env.APP_URL}/portal?post=${input.postId}`;

      await addFreshdeskTicketNote({
        domain: config.freshdeskDomain,
        apiKey: config.freshdeskApiKey,
        ticketId,
        body: noteBody,
        isPrivate: true
      });

      // Optionally update ticket status if mapping exists
      const freshdeskStatus = mapPainSolverStatusToFreshdesk(input.newStatus);
      if (freshdeskStatus && (input.newStatus === "complete" || input.newStatus === "shipped")) {
        await updateFreshdeskTicketStatus({
          domain: config.freshdeskDomain,
          apiKey: config.freshdeskApiKey,
          ticketId,
          status: freshdeskStatus
        });
      }

      console.log(`[Freshdesk Sync] Updated ticket ${ticketId}`);
    } catch (error) {
      console.error(`[Freshdesk Sync] Failed to update ticket ${ticketId}:`, error);
    }
  }
}
