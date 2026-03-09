import { Prisma, UserRole } from "@prisma/client";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { createApiCredential } from "../lib/apiKey";

async function upsertCompany(input: {
  name: string;
  monthlySpend: number;
  healthStatus: string;
  stripeCustomerId?: string;
}): Promise<{ id: string; name: string }> {
  const existing = await prisma.company.findFirst({ where: { name: input.name } });
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
  
  const company = existing
    ? await prisma.company.update({
        where: { id: existing.id },
        data: {
          monthlySpend: input.monthlySpend,
          healthStatus: input.healthStatus,
          stripeCustomerId: input.stripeCustomerId
        }
      })
    : await prisma.company.create({
        data: {
          name: input.name,
          slug,
          monthlySpend: input.monthlySpend,
          healthStatus: input.healthStatus,
          stripeCustomerId: input.stripeCustomerId
        }
      });

  return { id: company.id, name: company.name };
}

async function upsertUser(input: {
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
  appUserId?: string;
  segments?: string[];
}): Promise<{ id: string; email: string }> {
  const existing = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase(), companyId: input.companyId }
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          role: input.role,
          appUserId: input.appUserId,
          segments: input.segments ?? []
        }
      })
    : await prisma.user.create({
        data: {
          companyId: input.companyId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role,
          appUserId: input.appUserId,
          segments: input.segments ?? []
        }
      });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id
    }
  });

  return { id: user.id, email: user.email };
}

async function createBoardWithCategories(input: {
  companyId: string;
  name: string;
  visibility: "public" | "private" | "custom";
  allowedSegments?: string[];
  categoryNames: string[];
}): Promise<{ id: string; categories: Array<{ id: string; name: string }> }> {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existing = await prisma.board.findFirst({ where: { name: input.name, companyId: input.companyId } });

  const board = existing
    ? await prisma.board.update({
        where: { id: existing.id },
        data: {
          visibility: input.visibility,
          isPrivate: input.visibility !== "public",
          allowedSegments: input.allowedSegments ?? []
        }
      })
    : await prisma.board.create({
        data: {
          name: input.name,
          slug,
          companyId: input.companyId,
          visibility: input.visibility,
          isPrivate: input.visibility !== "public",
          allowedSegments: input.allowedSegments ?? []
        }
      });

  const categories: Array<{ id: string; name: string }> = [];
  for (const categoryName of input.categoryNames) {
    const category = await prisma.category.upsert({
      where: {
        boardId_name: {
          boardId: board.id,
          name: categoryName
        }
      },
      update: {},
      create: {
        boardId: board.id,
        name: categoryName
      }
    });
    categories.push({ id: category.id, name: category.name });
  }

  return { id: board.id, categories };
}

async function ensureWorkspaceBackfills(): Promise<void> {
  const [wilberth, sara] = await Promise.all([
    prisma.user.findFirst({ where: { email: "wilberth@acmeagency.com" } }),
    prisma.user.findFirst({ where: { email: "sara@orbitcommerce.com" } })
  ]);

  if (!wilberth || !sara) {
    return;
  }

  const [adBoard, apiBoard, automationBoard] = await Promise.all([
    prisma.board.findFirst({ where: { name: "Ad Reporting and Attribution" } }),
    prisma.board.findFirst({ where: { name: "APIs" } }),
    prisma.board.findFirst({ where: { name: "Automations" } })
  ]);

  if (!adBoard || !apiBoard || !automationBoard) {
    return;
  }

  const [plannerPost, apiPost, competitorPost, attributionPostCandidate] = await Promise.all([
    prisma.post.findFirst({
      where: {
        boardId: adBoard.id,
        title: {
          contains: "Comments bug",
          mode: "insensitive"
        }
      }
    }),
    prisma.post.findFirst({
      where: {
        boardId: apiBoard.id,
        title: {
          contains: "Template Builder API",
          mode: "insensitive"
        }
      }
    }),
    prisma.post.findFirst({
      where: {
        boardId: adBoard.id,
        title: {
          contains: "Competitor analysis",
          mode: "insensitive"
        }
      }
    }),
    prisma.post.findFirst({
      where: {
        boardId: automationBoard.id,
        title: {
          contains: "attribution",
          mode: "insensitive"
        }
      }
    })
  ]);

  const attributionPost =
    attributionPostCandidate ??
    (await prisma.post.findFirst({
      where: {
        boardId: automationBoard.id
      },
      orderBy: {
        updatedAt: "desc"
      }
    }));

  if (apiPost) {
    const existing = await prisma.changelogEntry.findFirst({
      where: {
        title: "Email Template API settings support is now live"
      }
    });

    if (!existing) {
      await prisma.changelogEntry.create({
        data: {
          boardId: apiBoard.id,
          postId: apiPost.id,
          title: "Email Template API settings support is now live",
          content:
            "<p>We now include template settings metadata in API payloads for template sync workflows.</p>",
          tags: ["new", "api"],
          isPublished: true,
          publishedAt: new Date("2026-02-18")
        }
      });
    }
  }

  if (plannerPost) {
    const existing = await prisma.changelogEntry.findFirst({
      where: {
        title: "Planner comments sync reliability update"
      }
    });

    if (!existing) {
      await prisma.changelogEntry.create({
        data: {
          boardId: adBoard.id,
          postId: plannerPost.id,
          title: "Planner comments sync reliability update",
          content:
            "<p>We improved comment sync retries and added better diagnostics in failure logs.</p><ul><li>Retry queue with exponential backoff</li><li>Health checks for sync workers</li><li>Early alerting for partial sync failures</li></ul>",
          tags: ["improvement", "planner"],
          isPublished: true,
          publishedAt: new Date("2026-02-15")
        }
      });
    }
  }

  if (attributionPost) {
    const existing = await prisma.changelogEntry.findFirst({
      where: {
        title: "Attribution model diagnostics (Draft)"
      }
    });

    if (!existing) {
      await prisma.changelogEntry.create({
        data: {
          boardId: automationBoard.id,
          postId: attributionPost.id,
          title: "Attribution model diagnostics (Draft)",
          content:
            "<p>This draft outlines upcoming diagnostics for campaign-level attribution.</p><p><strong>Draft note:</strong> Waiting on final QA before release.</p>",
          tags: ["draft", "analytics"],
          isPublished: false
        }
      });
    }
  }

  if (plannerPost) {
    const pendingEvent = await prisma.painEvent.upsert({
      where: {
        source_sourceReferenceId: {
          source: "freshdesk",
          sourceReferenceId: "fd_1001"
        }
      },
      update: {
        rawText: "We still miss planner comments from posts scheduled in Meta.",
        status: "needs_triage",
        matchedPostId: plannerPost.id,
        userId: wilberth.id
      },
      create: {
        userId: wilberth.id,
        source: "freshdesk",
        sourceReferenceId: "fd_1001",
        rawText: "We still miss planner comments from posts scheduled in Meta.",
        status: "needs_triage",
        matchedPostId: plannerPost.id
      }
    });

    await prisma.aiActionLog.upsert({
      where: { painEventId: pendingEvent.id },
      update: {
        actionTaken: "suggested_new",
        confidenceScore: 0.74,
        status: "pending_review"
      },
      create: {
        painEventId: pendingEvent.id,
        actionTaken: "suggested_new",
        confidenceScore: 0.74,
        status: "pending_review"
      }
    });
  }

  if (competitorPost) {
    const mergedEvent = await prisma.painEvent.upsert({
      where: {
        source_sourceReferenceId: {
          source: "zoom",
          sourceReferenceId: "zoom_9001"
        }
      },
      update: {
        rawText: "Need better competitor benchmark snapshots and exports for stakeholder decks.",
        status: "auto_merged",
        matchedPostId: competitorPost.id,
        userId: sara.id
      },
      create: {
        userId: sara.id,
        source: "zoom",
        sourceReferenceId: "zoom_9001",
        rawText: "Need better competitor benchmark snapshots and exports for stakeholder decks.",
        status: "auto_merged",
        matchedPostId: competitorPost.id
      }
    });

    await prisma.aiActionLog.upsert({
      where: { painEventId: mergedEvent.id },
      update: {
        actionTaken: "auto_upvote",
        confidenceScore: 0.93,
        status: "approved"
      },
      create: {
        painEventId: mergedEvent.id,
        actionTaken: "auto_upvote",
        confidenceScore: 0.93,
        status: "approved"
      }
    });
  }
}

async function ensureAiInboxConfigDefaults(): Promise<void> {
  // Find the first company for AI inbox config
  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) return;

  const existingFd = await prisma.aiInboxConfig.findFirst({ where: { companyId: company.id, source: "freshdesk" } });
  if (!existingFd) {
    await prisma.aiInboxConfig.create({
      data: {
        companyId: company.id,
        source: "freshdesk",
        routingMode: "central",
        enabled: true
      }
    });
  }

  const existingZoom = await prisma.aiInboxConfig.findFirst({ where: { companyId: company.id, source: "zoom" } });
  if (!existingZoom) {
    await prisma.aiInboxConfig.create({
      data: {
        companyId: company.id,
        source: "zoom",
        routingMode: "individual",
        enabled: true
      }
    });
  }
}

export async function ensureBootstrapData(): Promise<void> {
  if (env.DEMO_MODE) {
    return;
  }

  const boardCount = await prisma.board.count();
  if (boardCount > 0) {
    await ensureAiInboxConfigDefaults();
    await ensureWorkspaceBackfills();
    if (env.PAINSOLVER_MASTER_API_KEY) {
      await createApiCredential("master", env.PAINSOLVER_MASTER_API_KEY);
    }
    return;
  }

  const internalCompany = await upsertCompany({
    name: "PainSolver Internal",
    monthlySpend: 0,
    healthStatus: "active"
  });

  const acmeCompany = await upsertCompany({
    name: "Acme Agency",
    monthlySpend: 4200,
    healthStatus: "healthy"
  });

  const orbitCompany = await upsertCompany({
    name: "Orbit Commerce",
    monthlySpend: 3100,
    healthStatus: "healthy"
  });

  const memberAdmin = await upsertUser({
    companyId: internalCompany.id,
    email: "aarav@painsolver.io",
    name: "Aarav (You)",
    role: "admin",
    appUserId: "member_aarav"
  });
  const memberMila = await upsertUser({
    companyId: internalCompany.id,
    email: "mila@painsolver.io",
    name: "Mila",
    role: "member",
    appUserId: "member_mila"
  });
  const memberRavi = await upsertUser({
    companyId: internalCompany.id,
    email: "ravi@painsolver.io",
    name: "Ravi",
    role: "member",
    appUserId: "member_ravi"
  });

  const customerWilberth = await upsertUser({
    companyId: acmeCompany.id,
    email: "wilberth@acmeagency.com",
    name: "Wilberth Martinez",
    role: "customer",
    appUserId: "cust_wilberth",
    segments: ["agency", "beta", "ai"]
  });
  const customerSara = await upsertUser({
    companyId: orbitCompany.id,
    email: "sara@orbitcommerce.com",
    name: "Sara Patel",
    role: "customer",
    appUserId: "cust_sara",
    segments: ["technical", "enterprise"]
  });

  const adReportingBoard = await createBoardWithCategories({
    companyId: internalCompany.id,
    name: "Ad Reporting and Attribution",
    visibility: "public",
    categoryNames: ["Feedback", "Bugs"]
  });

  const apiBoard = await createBoardWithCategories({
    companyId: internalCompany.id,
    name: "APIs",
    visibility: "custom",
    allowedSegments: ["technical", "enterprise", "developer"],
    categoryNames: ["General", "Integrations"]
  });

  const automationBoard = await createBoardWithCategories({
    companyId: internalCompany.id,
    name: "Automations",
    visibility: "public",
    categoryNames: ["General", "Workflow"]
  });

  const voiceBoard = await createBoardWithCategories({
    companyId: internalCompany.id,
    name: "Voice AI",
    visibility: "custom",
    allowedSegments: ["ai", "beta", "enterprise"],
    categoryNames: ["General", "Roadmap"]
  });

  const conversationBoard = await createBoardWithCategories({
    companyId: internalCompany.id,
    name: "Conversations",
    visibility: "private",
    categoryNames: ["Internal", "Escalations"]
  });

  const createdPosts = await prisma.$transaction(async (tx) => {
    const posts = await Promise.all([
      tx.post.create({
        data: {
          boardId: adReportingBoard.id,
          categoryId: adReportingBoard.categories[0].id,
          title: "Comments bug: sync comments from all planners",
          description:
            "Comments from scheduled posts should sync consistently, including direct Meta schedules.",
          status: "planned",
          ownerName: "Mila",
          eta: new Date("2026-03-08"),
          tags: ["planner", "sync"],
          explicitVoteCount: 96,
          implicitVoteCount: 14,
          totalAttachedMrr: 14200
        }
      }),
      tx.post.create({
        data: {
          boardId: adReportingBoard.id,
          categoryId: adReportingBoard.categories[1].id,
          title: "Competitor analysis of social accounts",
          description: "Built-in competitor analysis for social accounts and benchmark alerts.",
          status: "under_review",
          ownerName: "Ravi",
          eta: null,
          tags: ["analytics", "social"],
          explicitVoteCount: 62,
          implicitVoteCount: 8,
          totalAttachedMrr: 9400
        }
      }),
      tx.post.create({
        data: {
          boardId: apiBoard.id,
          categoryId: apiBoard.categories[1].id,
          title: "Fix Email Template Builder API settings payload",
          description: "Expose template setting metadata in API payload for parity with UI.",
          status: "complete",
          ownerName: "Mila",
          eta: new Date("2026-02-12"),
          tags: ["api", "templates"],
          explicitVoteCount: 41,
          implicitVoteCount: 6,
          totalAttachedMrr: 3800
        }
      }),
      tx.post.create({
        data: {
          boardId: automationBoard.id,
          categoryId: automationBoard.categories[1].id,
          title: "Trigger Link Stats",
          description: "Track who clicked links with time, channel, and campaign context.",
          status: "in_progress",
          ownerName: "Aarav (You)",
          eta: new Date("2026-03-22"),
          tags: ["tracking", "automation"],
          explicitVoteCount: 54,
          implicitVoteCount: 12,
          totalAttachedMrr: 6200
        }
      }),
      tx.post.create({
        data: {
          boardId: voiceBoard.id,
          categoryId: voiceBoard.categories[0].id,
          title: "Always-on interrupt routing for Voice AI",
          description: "Support interruption-aware fallback routing in ongoing voice sessions.",
          status: "upcoming",
          ownerName: "Ravi",
          eta: new Date("2026-04-05"),
          tags: ["voice", "routing"],
          explicitVoteCount: 28,
          implicitVoteCount: 10,
          totalAttachedMrr: 5100
        }
      })
    ]);

    await tx.comment.createMany({
      data: [
        {
          postId: posts[0].id,
          authorId: customerWilberth.id,
          value: "This is urgent for our larger accounts.",
          isPrivate: false
        },
        {
          postId: posts[0].id,
          authorId: memberMila.id,
          value: "We have started implementation and will update ETA this week.",
          isPrivate: true
        },
        {
          postId: posts[3].id,
          authorId: customerSara.id,
          value: "Need campaign-level attribution for link click events.",
          isPrivate: false
        }
      ]
    });

    await tx.changelogEntry.createMany({
      data: [
        {
          boardId: apiBoard.id,
          postId: posts[2].id,
          title: "Email Template API settings support is now live",
          content:
            "<p>We now include template settings metadata in API payloads for template sync workflows.</p>",
          tags: ["new", "api"],
          isPublished: true,
          publishedAt: new Date("2026-02-18")
        },
        {
          boardId: adReportingBoard.id,
          postId: posts[0].id,
          title: "Planner comments sync reliability update",
          content:
            "<p>We improved comment sync retries and added better diagnostics in failure logs.</p><ul><li>Retry queue with exponential backoff</li><li>Health checks for sync workers</li><li>Early alerting for partial sync failures</li></ul>",
          tags: ["improvement", "planner"],
          isPublished: true,
          publishedAt: new Date("2026-02-15")
        },
        {
          boardId: automationBoard.id,
          postId: posts[3].id,
          title: "Attribution model diagnostics (Draft)",
          content:
            "<p>This draft outlines upcoming diagnostics for campaign-level attribution.</p><p><strong>Draft note:</strong> Waiting on final QA before release.</p>",
          tags: ["draft", "analytics"],
          isPublished: false,
          publishedAt: null
        }
      ]
    });

    await tx.vote.createMany({
      data: [
        {
          userId: customerWilberth.id,
          postId: posts[0].id,
          voteType: "explicit"
        },
        {
          userId: customerSara.id,
          postId: posts[0].id,
          voteType: "implicit"
        },
        {
          userId: customerSara.id,
          postId: posts[3].id,
          voteType: "explicit"
        }
      ],
      skipDuplicates: true
    });

    const pendingPainEvent = await tx.painEvent.create({
      data: {
        userId: customerWilberth.id,
        source: "freshdesk",
        sourceReferenceId: "fd_1001",
        rawText: "We still miss planner comments from posts scheduled in Meta.",
        status: "needs_triage",
        matchedPostId: posts[0].id
      }
    });

    await tx.aiActionLog.create({
      data: {
        painEventId: pendingPainEvent.id,
        actionTaken: "suggested_new",
        confidenceScore: 0.74,
        status: "pending_review"
      }
    });

    const mergedPainEvent = await tx.painEvent.create({
      data: {
        userId: customerSara.id,
        source: "zoom",
        sourceReferenceId: "zoom_9001",
        rawText: "Need better competitor benchmark snapshots and exports for stakeholder decks.",
        status: "auto_merged",
        matchedPostId: posts[1].id
      }
    });

    await tx.aiActionLog.create({
      data: {
        painEventId: mergedPainEvent.id,
        actionTaken: "auto_upvote",
        confidenceScore: 0.93,
        status: "approved"
      }
    });

    await tx.accessRequest.create({
      data: {
        userId: customerWilberth.id,
        boardId: conversationBoard.id,
        reason: "Need access to internal conversation board for escalations.",
        status: "pending"
      }
    });

    return posts;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  await prisma.notification.create({
    data: {
      userId: customerWilberth.id,
      boardId: createdPosts[0].boardId,
      postId: createdPosts[0].id,
      type: "status_change",
      title: "Status updated: " + createdPosts[0].title,
      body: "Moved to planned."
    }
  });

  await ensureWorkspaceBackfills();
  await ensureAiInboxConfigDefaults();

  if (env.PAINSOLVER_MASTER_API_KEY) {
    await createApiCredential("master", env.PAINSOLVER_MASTER_API_KEY);
  }

  void memberAdmin;
  void memberRavi;
}
