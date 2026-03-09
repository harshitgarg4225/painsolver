import crypto from "crypto";

import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { ingestFreshdeskSignal } from "../services/freshdeskIngestionService";
import { matchesFreshdeskFieldFilter } from "../services/freshdeskService";

const freshdeskPayloadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    requester: z.object({
      email: z.string().email(),
      name: z.string().optional()
    }),
    ticket_description: z.string().optional(),
    description: z.string().optional(),
    ticket: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        description: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export const webhooksRoutes = Router();

webhooksRoutes.post("/freshdesk", async (req, res) => {
  const parsed = freshdeskPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid Freshdesk payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const payload = parsed.data;
    const sourceConfig = await prisma.aiInboxConfig.findFirst({
      where: {
        source: "freshdesk"
      },
      select: {
        enabled: true,
        freshdeskFilterField: true,
        freshdeskFilterValue: true
      }
    });

    if (sourceConfig && !sourceConfig.enabled) {
      res.status(200).json({
        ok: true,
        ignored: true,
        reason: "freshdesk_source_disabled"
      });
      return;
    }

    const matchesTicketLevel = matchesFreshdeskFieldFilter({
      payload: payload.ticket ?? payload,
      filterField: sourceConfig?.freshdeskFilterField,
      filterValue: sourceConfig?.freshdeskFilterValue
    });
    const matchesRootLevel = matchesFreshdeskFieldFilter({
      payload,
      filterField: sourceConfig?.freshdeskFilterField,
      filterValue: sourceConfig?.freshdeskFilterValue
    });
    const matchesFilter = matchesTicketLevel || matchesRootLevel;

    if (!matchesFilter) {
      res.status(200).json({
        ok: true,
        ignored: true,
        reason: "freshdesk_filter_no_match"
      });
      return;
    }

    const rawDescription =
      payload.ticket_description ?? payload.ticket?.description ?? payload.description ?? "";

    if (!rawDescription.trim()) {
      res.status(400).json({ error: "Missing ticket description" });
      return;
    }

    const sourceReferenceId = String(
      payload.id ?? payload.ticket?.id ?? `freshdesk-${crypto.randomUUID()}`
    );
    const requesterEmail = payload.requester.email.trim().toLowerCase();
    const requesterName = payload.requester.name?.trim();

    const result = await ingestFreshdeskSignal({
      sourceReferenceId,
      requesterEmail,
      requesterName,
      description: rawDescription
    });
    res.status(200).json({ ok: true, painEventId: result.painEventId, status: result.status });
  } catch (error) {
    console.error("Freshdesk webhook processing failed", error);
    res.status(500).json({ error: "Failed to process Freshdesk webhook" });
  }
});
