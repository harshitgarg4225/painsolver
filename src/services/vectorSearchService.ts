import { Post } from "@prisma/client";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import {
  cosineSimilarity,
  deterministicEmbedding,
  jaccardSimilarity
} from "../lib/vector";

export interface PostMatch {
  post: Pick<Post, "id" | "title" | "description"> | null;
  similarityScore: number;
}

/**
 * Use pgvector's cosine distance operator to find closest post in SQL.
 * Only works when posts have stored embeddings (production with real OpenAI).
 */
async function findClosestPostByEmbeddingSQL(
  intentEmbedding: number[]
): Promise<PostMatch> {
  const vectorLiteral = `[${intentEmbedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    Array<{ id: string; title: string; description: string; distance: number }>
  >(
    `SELECT id, title, description, (embedding <=> $1::vector) AS distance
     FROM "Post"
     WHERE embedding IS NOT NULL AND "mergedIntoPostId" IS NULL
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    vectorLiteral
  );

  if (!results.length) {
    return { post: null, similarityScore: 0 };
  }

  const best = results[0];
  // pgvector <=> returns cosine distance (0 = identical, 2 = opposite)
  // Convert to similarity: 1 - distance
  const similarityScore = Math.max(0, 1 - best.distance);

  return {
    post: { id: best.id, title: best.title, description: best.description },
    similarityScore: Number(similarityScore.toFixed(4))
  };
}

/**
 * Fallback for mock/dev mode: compute similarity in JS.
 * Limited to 500 most recent posts to avoid memory issues at scale.
 */
async function findClosestPostByDeterministicEmbedding(
  intent: string,
  intentEmbedding: number[]
): Promise<PostMatch> {
  const posts = await prisma.post.findMany({
    where: { mergedIntoPostId: null },
    select: {
      id: true,
      title: true,
      description: true
    },
    orderBy: { createdAt: "desc" },
    take: 500
  });

  if (posts.length === 0) {
    return { post: null, similarityScore: 0 };
  }

  let bestPost: Pick<Post, "id" | "title" | "description"> | null = null;
  let bestScore = 0;

  for (const post of posts) {
    const candidateText = `${post.title} ${post.description}`.trim();
    const candidateEmbedding = deterministicEmbedding(candidateText);

    const cosine = cosineSimilarity(intentEmbedding, candidateEmbedding);
    const jaccard = jaccardSimilarity(intent, candidateText);
    const combinedScore = 0.75 * cosine + 0.25 * jaccard;

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestPost = post;
    }
  }

  return {
    post: bestPost,
    similarityScore: Number(bestScore.toFixed(4))
  };
}

export async function findClosestPostByIntent(
  intent: string,
  intentEmbedding: number[]
): Promise<PostMatch> {
  if (!env.USE_MOCK_OPENAI) {
    // Production: use pgvector SQL for O(1)-ish lookup via index
    const sqlResult = await findClosestPostByEmbeddingSQL(intentEmbedding);
    if (sqlResult.post) {
      return sqlResult;
    }
    // Fall through to JS approach if no posts have embeddings yet
  }

  return findClosestPostByDeterministicEmbedding(intent, intentEmbedding);
}
