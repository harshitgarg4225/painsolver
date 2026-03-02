import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { scrubPii } from "../lib/pii";
import { aiProcessingQueue } from "../lib/queue";
import { getCompanyNameFromEmail, stripHtml } from "../lib/text";
import { processPainEvent } from "./painEventService";
import { calculateNormalizedMRR } from "./stripeService";

export interface FreshdeskSignalInput {
  sourceReferenceId: string;
  requesterEmail: string;
  requesterName?: string;
  description: string;
}

export interface FreshdeskSignalIngestResult {
  painEventId: string;
  status: "queued" | "processed";
}

export async function ingestFreshdeskSignal(
  input: FreshdeskSignalInput,
  options?: {
    processInline?: boolean;
  }
): Promise<FreshdeskSignalIngestResult> {
  const sourceReferenceId = String(input.sourceReferenceId || "").trim();
  const requesterEmail = String(input.requesterEmail || "").trim().toLowerCase();
  const requesterName = String(input.requesterName || "").trim();
  const cleanText = scrubPii(stripHtml(String(input.description || "")));

  if (!sourceReferenceId) {
    throw new Error("Missing Freshdesk source reference id.");
  }

  if (!requesterEmail) {
    throw new Error("Missing Freshdesk requester email.");
  }

  if (!cleanText) {
    throw new Error("Freshdesk ticket description is empty.");
  }

  const companyName = getCompanyNameFromEmail(requesterEmail);
  const normalizedMrr = await calculateNormalizedMRR(requesterEmail);

  const painEvent = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email: requesterEmail },
      include: { company: true }
    });

    if (!user) {
      let company = await tx.company.findUnique({
        where: { name: companyName }
      });

      if (!company) {
        company = await tx.company.create({
          data: {
            name: companyName,
            monthlySpend: normalizedMrr,
            healthStatus: "unknown"
          }
        });
      } else if (normalizedMrr > 0 && company.monthlySpend !== normalizedMrr) {
        company = await tx.company.update({
          where: { id: company.id },
          data: { monthlySpend: normalizedMrr }
        });
      }

      user = await tx.user.create({
        data: {
          email: requesterEmail,
          name: requesterName || requesterEmail,
          companyId: company.id
        },
        include: { company: true }
      });
    } else {
      if (normalizedMrr > 0 && user.company.monthlySpend !== normalizedMrr) {
        await tx.company.update({
          where: { id: user.companyId },
          data: { monthlySpend: normalizedMrr }
        });
      }

      if (requesterName && requesterName !== user.name) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { name: requesterName },
          include: { company: true }
        });
      }
    }

    return tx.painEvent.upsert({
      where: {
        source_sourceReferenceId: {
          source: "freshdesk",
          sourceReferenceId
        }
      },
      update: {
        userId: user.id,
        rawText: cleanText,
        status: "pending_ai",
        matchedPostId: null
      },
      create: {
        userId: user.id,
        source: "freshdesk",
        sourceReferenceId,
        rawText: cleanText,
        status: "pending_ai"
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  await aiProcessingQueue.add("process-pain-event", {
    painEventId: painEvent.id
  });

  if (options?.processInline) {
    await processPainEvent(painEvent.id);
    return {
      painEventId: painEvent.id,
      status: "processed"
    };
  }

  return {
    painEventId: painEvent.id,
    status: "queued"
  };
}
