import { Prisma } from "@prisma/client";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import {
  extractIntentFromTicket,
  generateIntentEmbedding
} from "./openaiService";
import { findClosestPostByIntent } from "./vectorSearchService";

export interface PainEventProcessingResult {
  painEventId: string;
  status: "auto_merged" | "needs_triage" | "skipped";
  similarityScore?: number;
  matchedPostId?: string | null;
}

export async function processPainEvent(
  painEventId: string
): Promise<PainEventProcessingResult> {
  const painEvent = await prisma.painEvent.findUnique({
    where: { id: painEventId },
    include: {
      user: {
        include: {
          company: true
        }
      }
    }
  });

  if (!painEvent) {
    throw new Error(`PainEvent ${painEventId} not found`);
  }

  if (painEvent.status !== "pending_ai") {
    return {
      painEventId,
      status: "skipped"
    };
  }

  const extracted = await extractIntentFromTicket(painEvent.rawText);
  const intentEmbedding = await generateIntentEmbedding(extracted.intent);
  const match = await findClosestPostByIntent(extracted.intent, intentEmbedding);

  if (
    match.post &&
    match.similarityScore > env.AI_SIMILARITY_THRESHOLD
  ) {
    const matchedPostId = match.post.id;

    await prisma.$transaction(async (tx) => {
      const actionLog = await tx.aiActionLog.upsert({
        where: { painEventId },
        update: {
          actionTaken: "auto_upvote",
          confidenceScore: match.similarityScore,
          status: "approved"
        },
        create: {
          painEventId,
          actionTaken: "auto_upvote",
          confidenceScore: match.similarityScore,
          status: "approved"
        }
      });

      const existingVote = await tx.vote.findUnique({
        where: {
          userId_postId: {
            userId: painEvent.userId,
            postId: matchedPostId
          }
        }
      });

      if (!existingVote) {
        await tx.vote.create({
          data: {
            userId: painEvent.userId,
            postId: matchedPostId,
            voteType: "implicit",
            aiActionLogId: actionLog.id
          }
        });

        await tx.post.update({
          where: {
            id: matchedPostId
          },
          data: {
            implicitVoteCount: {
              increment: 1
            },
            totalAttachedMrr: {
              increment: painEvent.user.company.monthlySpend
            }
          }
        });
      } else if (existingVote.voteType === "implicit" && !existingVote.aiActionLogId) {
        await tx.vote.update({
          where: { id: existingVote.id },
          data: { aiActionLogId: actionLog.id }
        });
      }

      await tx.painEvent.update({
        where: { id: painEventId },
        data: {
          status: "auto_merged",
          matchedPostId
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    return {
      painEventId,
      status: "auto_merged",
      similarityScore: match.similarityScore,
      matchedPostId
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiActionLog.upsert({
      where: { painEventId },
      update: {
        actionTaken: "suggested_new",
        confidenceScore: match.similarityScore,
        status: "pending_review"
      },
      create: {
        painEventId,
        actionTaken: "suggested_new",
        confidenceScore: match.similarityScore,
        status: "pending_review"
      }
    });

    await tx.painEvent.update({
      where: { id: painEventId },
      data: {
        status: "needs_triage",
        matchedPostId: match.post?.id ?? null
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  return {
    painEventId,
    status: "needs_triage",
    similarityScore: match.similarityScore,
    matchedPostId: match.post?.id ?? null
  };
}
