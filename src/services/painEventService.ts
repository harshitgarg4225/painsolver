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
  status: "auto_merged" | "needs_triage" | "skipped" | "spam";
  similarityScore?: number;
  matchedPostId?: string | null;
}

// Spam detection patterns
const SPAM_PATTERNS = [
  /^(thanks?|thank you|ok|okay|got it|noted|sure|yes|no|hi|hello|hey)\s*[.!]?\s*$/i,
  /unsubscribe/i,
  /\b(buy now|click here|free trial|limited offer|act now|congratulations)\b/i,
  /\b(viagra|casino|lottery|winner|prize)\b/i,
  /^.{0,5}$/,  // Very short messages (less than 6 chars)
];

function isLikelySpam(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 3) return true;
  return SPAM_PATTERNS.some((pattern) => pattern.test(clean));
}

async function getSourceConfig(source: PainEventSource): Promise<{
  similarityThreshold: number;
  triageMode: string;
  spamDetectionEnabled: boolean;
}> {
  const config = await prisma.aiInboxConfig.findFirst({
    where: { source },
    select: {
      similarityThreshold: true,
      triageMode: true,
      spamDetectionEnabled: true,
    }
  });
  return {
    similarityThreshold: config?.similarityThreshold ?? env.AI_SIMILARITY_THRESHOLD,
    triageMode: config?.triageMode ?? "manual",
    spamDetectionEnabled: config?.spamDetectionEnabled ?? true,
  };
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

  // Get source config for triage mode and spam detection
  const sourceConfig = await getSourceConfig(painEvent.source);

  // P1: Spam detection - check before AI processing
  if (sourceConfig.spamDetectionEnabled && isLikelySpam(painEvent.rawText)) {
    await prisma.painEvent.update({
      where: { id: painEventId },
      data: { status: "spam" }
    });
    return {
      painEventId,
      status: "spam",
      similarityScore: 0
    };
  }

  const extracted = await extractIntentFromTicket(painEvent.rawText);
  
  // Skip processing if AI confidence is very low (likely noise)
  if (extracted.confidenceLevel && extracted.confidenceLevel < 0.3) {
    // If spam detection is on and confidence is very low, mark as spam
    const newStatus = sourceConfig.spamDetectionEnabled ? "spam" : "skipped";
    await prisma.painEvent.update({
      where: { id: painEventId },
      data: { status: newStatus as any }
    });
    
    return {
      painEventId,
      status: newStatus as any,
      similarityScore: 0
    };
  }

  const intentEmbedding = await generateIntentEmbedding(extracted.intent);
  const match = await findClosestPostByIntent(extracted.intent, intentEmbedding);

  // Calibrated confidence: combine AI extraction confidence with vector similarity
  const aiConfidence = extracted.confidenceLevel ?? 0.7;
  const calibratedScore = match.similarityScore * (0.5 + aiConfidence * 0.5);

  // Get the configured similarity threshold for this source
  const similarityThreshold = sourceConfig.similarityThreshold;
  const isAutoMode = sourceConfig.triageMode === "auto";

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

  // In auto mode: create the idea automatically without manual triage
  const actionStatus = isAutoMode ? "approved" : "pending_review";
  const eventStatus = isAutoMode ? "auto_merged" : "needs_triage";

  await prisma.$transaction(async (tx) => {
    await tx.aiActionLog.upsert({
      where: { painEventId },
      update: {
        actionTaken: "suggested_new",
        confidenceScore: calibratedScore,
        status: actionStatus,
        metadata: {
          extractedIntent: extracted.intent,
          category: extracted.category,
          sentiment: extracted.sentiment,
          urgency: extracted.urgency,
          aiConfidence: aiConfidence,
          vectorSimilarity: match.similarityScore,
          keywords: extracted.keywords,
          suggestedTitle: extracted.suggestedTitle,
          suggestedDescription: extracted.suggestedDescription,
          autoMode: isAutoMode
        }
      },
      create: {
        painEventId,
        actionTaken: "suggested_new",
        confidenceScore: calibratedScore,
        status: actionStatus,
        metadata: {
          extractedIntent: extracted.intent,
          category: extracted.category,
          sentiment: extracted.sentiment,
          urgency: extracted.urgency,
          aiConfidence: aiConfidence,
          vectorSimilarity: match.similarityScore,
          keywords: extracted.keywords,
          suggestedTitle: extracted.suggestedTitle,
          suggestedDescription: extracted.suggestedDescription,
          autoMode: isAutoMode
        }
      }
    });

    await tx.painEvent.update({
      where: { id: painEventId },
      data: {
        status: eventStatus as any,
        matchedPostId: match.post?.id ?? null
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  return {
    painEventId,
    status: eventStatus as "auto_merged" | "needs_triage",
    similarityScore: calibratedScore,
    matchedPostId: match.post?.id ?? null
  };
}
