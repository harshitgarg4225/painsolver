import { Prisma, PainEventSource } from "@prisma/client";

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

async function getSimilarityThreshold(source: PainEventSource): Promise<number> {
  const config = await prisma.aiInboxConfig.findFirst({
    where: { source },
    select: { similarityThreshold: true }
  });
  return config?.similarityThreshold ?? env.AI_SIMILARITY_THRESHOLD;
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
  
  // Skip processing if AI confidence is very low (likely noise)
  if (extracted.confidenceLevel && extracted.confidenceLevel < 0.3) {
    await prisma.painEvent.update({
      where: { id: painEventId },
      data: { status: "skipped" }
    });
    
    return {
      painEventId,
      status: "skipped",
      similarityScore: 0
    };
  }

  const intentEmbedding = await generateIntentEmbedding(extracted.intent);
  const match = await findClosestPostByIntent(extracted.intent, intentEmbedding);

  // Calibrated confidence: combine AI extraction confidence with vector similarity
  const aiConfidence = extracted.confidenceLevel ?? 0.7;
  const calibratedScore = match.similarityScore * (0.5 + aiConfidence * 0.5);

  // Get the configured similarity threshold for this source
  const similarityThreshold = await getSimilarityThreshold(painEvent.source);

  if (
    match.post &&
    calibratedScore > similarityThreshold
  ) {
    const matchedPostId = match.post.id;

    await prisma.$transaction(async (tx) => {
      const actionLog = await tx.aiActionLog.upsert({
        where: { painEventId },
        update: {
          actionTaken: "auto_upvote",
          confidenceScore: calibratedScore,
          status: "approved",
          // Store enhanced metadata
          metadata: {
            extractedIntent: extracted.intent,
            category: extracted.category,
            sentiment: extracted.sentiment,
            urgency: extracted.urgency,
            aiConfidence: aiConfidence,
            vectorSimilarity: match.similarityScore,
            keywords: extracted.keywords
          }
        },
        create: {
          painEventId,
          actionTaken: "auto_upvote",
          confidenceScore: calibratedScore,
          status: "approved",
          metadata: {
            extractedIntent: extracted.intent,
            category: extracted.category,
            sentiment: extracted.sentiment,
            urgency: extracted.urgency,
            aiConfidence: aiConfidence,
            vectorSimilarity: match.similarityScore,
            keywords: extracted.keywords
          }
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
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
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
        confidenceScore: calibratedScore,
        status: "pending_review",
        // Store enhanced metadata including suggested title/description
        metadata: {
          extractedIntent: extracted.intent,
          category: extracted.category,
          sentiment: extracted.sentiment,
          urgency: extracted.urgency,
          aiConfidence: aiConfidence,
          vectorSimilarity: match.similarityScore,
          keywords: extracted.keywords,
          suggestedTitle: extracted.suggestedTitle,
          suggestedDescription: extracted.suggestedDescription
        }
      },
      create: {
        painEventId,
        actionTaken: "suggested_new",
        confidenceScore: calibratedScore,
        status: "pending_review",
        metadata: {
          extractedIntent: extracted.intent,
          category: extracted.category,
          sentiment: extracted.sentiment,
          urgency: extracted.urgency,
          aiConfidence: aiConfidence,
          vectorSimilarity: match.similarityScore,
          keywords: extracted.keywords,
          suggestedTitle: extracted.suggestedTitle,
          suggestedDescription: extracted.suggestedDescription
        }
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
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return {
    painEventId,
    status: "needs_triage",
    similarityScore: calibratedScore,
    matchedPostId: match.post?.id ?? null
  };
}
