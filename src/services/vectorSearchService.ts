import { Post } from "@prisma/client";

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

export async function findClosestPostByIntent(
  intent: string,
  intentEmbedding: number[]
): Promise<PostMatch> {
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      description: true
    }
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
