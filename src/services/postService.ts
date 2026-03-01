import { Prisma, VoteType } from "@prisma/client";

import { prisma } from "../db/prisma";

export interface PostListItem {
  id: string;
  boardId: string;
  categoryId: string;
  title: string;
  description: string;
  status: string;
  score: number;
  totalAttachedMrr: number;
  implicitVoteCount: number;
  explicitVoteCount: number;
  userVoteType: VoteType | null;
  capturedViaSupport: boolean;
}

export async function listPostsWithVotes(userId?: string): Promise<PostListItem[]> {
  const voteLookupUserId = userId ?? "__no_user__";

  const posts = await prisma.post.findMany({
    orderBy: {
      totalAttachedMrr: "desc"
    },
    include: {
      votes: {
        where: { userId: voteLookupUserId },
        select: {
          voteType: true
        }
      }
    }
  });

  return posts.map((post) => {
    const voteType = userId ? post.votes[0]?.voteType ?? null : null;

    return {
      id: post.id,
      boardId: post.boardId,
      categoryId: post.categoryId,
      title: post.title,
      description: post.description,
      status: post.status,
      score: post.score,
      totalAttachedMrr: post.totalAttachedMrr,
      implicitVoteCount: post.implicitVoteCount,
      explicitVoteCount: post.explicitVoteCount,
      userVoteType: voteType,
      capturedViaSupport: voteType === "implicit"
    };
  });
}

export interface VoteMutationResult {
  voteType: VoteType;
  action: "created_explicit" | "upgraded_implicit_to_explicit" | "already_explicit";
}

export async function createOrUpgradeVote(
  userId: string,
  postId: string
): Promise<VoteMutationResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });

    if (!post) {
      throw new Error("Post not found");
    }

    const existingVote = await tx.vote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    if (!existingVote) {
      await tx.vote.create({
        data: {
          userId,
          postId,
          voteType: "explicit"
        }
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          explicitVoteCount: { increment: 1 },
          totalAttachedMrr: { increment: user.company.monthlySpend }
        }
      });

      return {
        voteType: "explicit",
        action: "created_explicit"
      };
    }

    if (existingVote.voteType === "implicit") {
      await tx.vote.update({
        where: {
          userId_postId: {
            userId,
            postId
          }
        },
        data: {
          voteType: "explicit"
        }
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          implicitVoteCount: { decrement: 1 },
          explicitVoteCount: { increment: 1 }
        }
      });

      return {
        voteType: "explicit",
        action: "upgraded_implicit_to_explicit"
      };
    }

    return {
      voteType: "explicit",
      action: "already_explicit"
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}
