import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";
import { requireTenantContext, getCompanyId } from "../middleware/tenantContext";
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
};

type FreshdeskConfigRecord = Awaited<ReturnType<typeof ensureFreshdeskConfigRaw>>;

async function ensureFreshdeskConfigRaw(companyId: string) {
  return prisma.aiInboxConfig.upsert({
    where: {
      companyId_source: {
        companyId,
        source: "freshdesk"
      }
    },
    update: {},
    create: {
      companyId,
      source: "freshdesk",
      routingMode: "central",
      enabled: true
    },
    select: { ...freshdeskConfigSelect, companyId: true }
  });
}

async function ensureFreshdeskConfig(companyId: string): Promise<FreshdeskConfigRecord> {
  return ensureFreshdeskConfigRaw(companyId);
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
      freshdeskFieldCatalog: JSON.parse(JSON.stringify(params)),
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

freshdeskIntegrationRoutes.use(requireCompanyWriteAccess);
freshdeskIntegrationRoutes.use(requireTenantContext);

// =============================================
// Test Connection - Validates credentials
// =============================================
freshdeskIntegrationRoutes.post("/test-connection", async (req, res) => {
  const companyId = getCompanyId(req);
  const { domain, apiKey } = req.body as { domain?: string; apiKey?: string };
  
  const config = await ensureFreshdeskConfig(getCompanyId(req));
  const testDomain = domain || config.freshdeskDomain;
  const testApiKey = apiKey || config.freshdeskApiKey;

  if (!testDomain || !testApiKey) {
    res.status(400).json({ 
      success: false, 
      error: "Missing domain or API key",
      details: { domain: !testDomain, apiKey: !testApiKey }
    });
    return;
  }

  try {
    // Test by fetching ticket fields (lightweight API call)
    const fields = await listFreshdeskTicketFields({
      domain: testDomain,
      apiKey: testApiKey
    });

    res.status(200).json({
      success: true,
      message: "Connection successful!",
      details: {
        fieldsFound: fields.length,
        sampleFields: fields.slice(0, 5).map(f => f.label)
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isAuthError = errorMessage.includes("401") || errorMessage.includes("403");
    const isDomainError = errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo");

    res.status(200).json({
      success: false,
      error: isAuthError 
        ? "Invalid API key. Check your Freshdesk API key in Profile Settings."
        : isDomainError 
        ? "Invalid domain. Make sure your Freshdesk subdomain is correct."
        : `Connection failed: ${errorMessage}`,
      details: { isAuthError, isDomainError }
    });
  }
});

// =============================================
// Activity Log - Recent processed events
// =============================================
freshdeskIntegrationRoutes.get("/activity", async (req, res) => {
  const companyId = getCompanyId(req);
  try {
    const recentEvents = await prisma.painEvent.findMany({
      where: { 
        source: "freshdesk",
        user: { companyId }
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        sourceReferenceId: true,
        status: true,
        createdAt: true,
        rawText: true,
        matchedPostId: true,
        matchedPost: {
          select: {
            id: true,
            title: true
          }
        },
        user: {
          select: {
            email: true,
            name: true,
            company: {
              select: {
                name: true,
                monthlySpend: true
              }
            }
          }
        },
        aiActionLog: {
          select: {
            actionTaken: true,
            confidenceScore: true,
            metadata: true
          }
        }
      }
    });

    const summary = await prisma.painEvent.groupBy({
      by: ["status"],
      where: { 
        source: "freshdesk",
        user: { companyId }
      },
      _count: { id: true }
    });

    const summaryMap: Record<string, number> = {};
    summary.forEach((s: { status: string; _count: { id: number } }) => {
      summaryMap[s.status] = s._count.id;
    });

    res.status(200).json({
      events: recentEvents.map((e: typeof recentEvents[number]) => ({
        id: e.id,
        ticketId: e.sourceReferenceId.replace("freshdesk-", ""),
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        preview: e.rawText.slice(0, 150) + (e.rawText.length > 150 ? "..." : ""),
        user: {
          email: e.user.email,
          name: e.user.name,
          company: e.user.company.name,
          mrr: e.user.company.monthlySpend
        },
        matchedPost: e.matchedPost ? {
          id: e.matchedPost.id,
          title: e.matchedPost.title
        } : null,
        aiAction: e.aiActionLog ? {
          action: e.aiActionLog.actionTaken,
          confidence: e.aiActionLog.confidenceScore,
          category: (e.aiActionLog.metadata as Record<string, unknown>)?.category,
          sentiment: (e.aiActionLog.metadata as Record<string, unknown>)?.sentiment
        } : null
      })),
      summary: {
        total: Object.values(summaryMap).reduce((a, b) => a + b, 0),
        autoMerged: summaryMap.auto_merged || 0,
        needsTriage: summaryMap.needs_triage || 0,
        pending: summaryMap.pending_ai || 0,
        skipped: summaryMap.skipped || 0
      }
    });
  } catch (error) {
    console.error("Failed to fetch Freshdesk activity:", error);
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
});

// =============================================
// Sync Now - Manual trigger with progress
// =============================================
freshdeskIntegrationRoutes.post("/sync-now", async (req, res) => {
  const config = await ensureFreshdeskConfig(getCompanyId(req));
  const domain = config.freshdeskDomain ?? "";
  const apiKey = config.freshdeskApiKey ?? "";

  if (!config.enabled) {
    res.status(400).json({ error: "Freshdesk integration is paused. Enable it first." });
    return;
  }

  if ((!domain || !apiKey) && !env.USE_MOCK_FRESHDESK) {
    res.status(400).json({ error: "Freshdesk not configured. Add domain and API key first." });
    return;
  }

  const { daysBack = 7, maxTickets = 50 } = req.body as { daysBack?: number; maxTickets?: number };

  try {
    const tickets = await listFreshdeskTickets({
      domain,
      apiKey,
      daysBack: Math.min(daysBack, 30),
      maxTickets: Math.min(maxTickets, 100)
    });

    const results = {
      scanned: tickets.length,
      matched: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ ticketId: string; status: string; error?: string }>
    };

    for (const ticket of tickets) {
      const matches = matchesFreshdeskFieldFilter({
        payload: ticket.rawTicket,
        filterField: config.freshdeskFilterField,
        filterValue: config.freshdeskFilterValue
      });

      if (!matches) {
        results.skipped++;
        continue;
      }

      results.matched++;

      try {
        // Get conversation for full context
        let fullDescription = ticket.description;
        if (domain && apiKey) {
          const conversation = await fetchFreshdeskTicketConversation({
            domain,
            apiKey,
            ticketId: ticket.sourceReferenceId
          });
          if (conversation.length > 0) {
            fullDescription = conversation.join("\n\n") + "\n\n---\n\n" + ticket.description;
          }
        }

        await ingestFreshdeskSignal({
          sourceReferenceId: ticket.sourceReferenceId,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requesterName,
          description: scrubPii(fullDescription)
        }, { processInline: true });

        results.imported++;
        results.details.push({ ticketId: ticket.sourceReferenceId, status: "imported" });
      } catch (err) {
        results.errors++;
        results.details.push({ 
          ticketId: ticket.sourceReferenceId, 
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    await prisma.aiInboxConfig.update({
      where: { id: config.id },
      data: { freshdeskLastTicketSyncAt: new Date() }
    });

    res.status(200).json({
      success: true,
      ...results,
      connection: statusFromFreshdeskConfig(config)
    });
  } catch (error) {
    console.error("Freshdesk sync failed:", error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : "Sync failed" 
    });
  }
});

freshdeskIntegrationRoutes.get("/status", async (req, res) => {
  const config = await ensureFreshdeskConfig(getCompanyId(req));
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

  const existing = await ensureFreshdeskConfig(getCompanyId(req));
  const payload = parsed.data;

  const updateData: Record<string, unknown> = {};

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

freshdeskIntegrationRoutes.get("/params", async (req, res) => {
  const config = await ensureFreshdeskConfig(getCompanyId(req));

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

freshdeskIntegrationRoutes.get("/fields", async (req, res) => {
  const config = await ensureFreshdeskConfig(getCompanyId(req));

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

  const config = await ensureFreshdeskConfig(getCompanyId(req));
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
      await ingestFreshdeskSignal(
        {
          sourceReferenceId: ticket.sourceReferenceId,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requesterName,
          description: ticket.description
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

freshdeskIntegrationRoutes.post("/disconnect", async (req, res) => {
  const config = await ensureFreshdeskConfig(getCompanyId(req));
  const updated = await prisma.aiInboxConfig.update({
    where: {
      id: config.id
    },
    data: {
      freshdeskDomain: null,
      freshdeskApiKey: null,
      freshdeskFilterField: null,
      freshdeskFilterValue: null,
      freshdeskFieldCatalog: null as unknown as object,
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
// Freshdesk Webhook (Real-time ticket events)
// =============================================

/**
 * Webhook endpoint for Freshdesk automation rules
 * Configure in Freshdesk: Admin -> Automations -> Ticket Updates -> Webhook
 * URL: https://painsolver.vercel.app/api/integrations/freshdesk/webhook
 */
freshdeskIntegrationRoutes.post("/webhook", async (req, res) => {
  // Respond immediately (Freshdesk expects quick response)
  res.status(200).json({ ok: true });

  const payload = req.body as FreshdeskWebhookPayload;
  
  console.log("[Freshdesk Webhook] Received event:", {
    ticketId: payload.ticket_id,
    event: payload.triggered_event,
    subject: payload.ticket_subject
  });

  // Parse the webhook payload
  const ticketData = parseWebhookPayload(payload);
  if (!ticketData) {
    console.log("[Freshdesk Webhook] Skipping - invalid or empty ticket data");
    return;
  }

  // Get Freshdesk config to check filters
  const config = await ensureFreshdeskConfig(getCompanyId(req));
  
  if (!config.enabled) {
    console.log("[Freshdesk Webhook] Skipping - Freshdesk source is disabled");
    return;
  }

  // Check if ticket matches filters
  const matches = matchesFreshdeskFieldFilter({
    payload: ticketData.rawTicket,
    filterField: config.freshdeskFilterField,
    filterValue: config.freshdeskFilterValue
  });

  if (!matches) {
    console.log("[Freshdesk Webhook] Skipping - ticket doesn't match filters");
    return;
  }

  try {
    // Check for duplicate
    const sourceReferenceId = `freshdesk-${ticketData.sourceReferenceId}`;
    const existing = await prisma.painEvent.findUnique({
      where: {
        source_sourceReferenceId: {
          source: "freshdesk",
          sourceReferenceId
        }
      }
    });

    if (existing) {
      console.log("[Freshdesk Webhook] Duplicate ticket, skipping");
      return;
    }

    // Fetch full conversation if we have API credentials
    let fullContext = ticketData.description;
    if (config.freshdeskDomain && config.freshdeskApiKey) {
      const conversation = await fetchFreshdeskTicketConversation({
        domain: config.freshdeskDomain,
        apiKey: config.freshdeskApiKey,
        ticketId: ticketData.sourceReferenceId
      });

      if (conversation.length > 0) {
        fullContext = conversation.join("\n\n") + "\n\n[Latest message]\n" + ticketData.description;
      }
    }

    // Ingest as pain event with full context
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
