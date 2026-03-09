/**
 * Ensure Default Company Script
 * 
 * This script runs after build to ensure there's at least one company
 * and that all orphaned data (boards, users without companies) are assigned.
 * Also backfills slugs for companies and boards that don't have them.
 * 
 * Safe to run multiple times - idempotent.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "default";
}

async function main() {
  console.log("[Setup] Running ensureDefaultCompany...");

  // ── 1. Backfill company slugs ──
  const companiesWithoutSlug = await prisma.company.findMany({
    where: { slug: "" }
  });

  for (const company of companiesWithoutSlug) {
    const slug = slugify(company.name) || `company-${company.id.slice(0, 8)}`;
    try {
      await prisma.company.update({
        where: { id: company.id },
        data: { slug }
      });
      console.log(`[Setup] Backfilled slug for company "${company.name}": ${slug}`);
    } catch (e) {
      // Slug conflict — add suffix
      const fallback = `${slug}-${company.id.slice(0, 6)}`;
      await prisma.company.update({
        where: { id: company.id },
        data: { slug: fallback }
      });
      console.log(`[Setup] Backfilled slug for company "${company.name}": ${fallback}`);
    }
  }

  // ── 2. Ensure at least one company exists ──
  const companyCount = await prisma.company.count();

  let defaultCompany;
  if (companyCount === 0) {
    console.log("[Setup] No companies found. Creating default company...");
    defaultCompany = await prisma.company.create({
      data: {
        name: "Default Company",
        slug: "default",
        boards: {
          create: {
            name: "Feature Requests",
            slug: "feature-requests",
            visibility: "public",
            categories: {
              create: { name: "General" }
            }
          }
        },
        portalSettings: {
          create: {
            portalName: "Feedback Portal"
          }
        }
      },
      include: { boards: true }
    });
    console.log(`[Setup] Created default company: ${defaultCompany.name} (${defaultCompany.id})`);
  } else {
    defaultCompany = await prisma.company.findFirst({
      orderBy: { createdAt: "asc" },
      include: { boards: true }
    });
    console.log(`[Setup] Using existing company: ${defaultCompany?.name} (${defaultCompany?.id})`);
  }

  if (!defaultCompany) {
    console.error("[Setup] No company available. Exiting.");
    return;
  }

  // ── 3. Assign orphaned users (companyId is empty string) ──
  const orphanedUserCount = await prisma.user.count({
    where: { companyId: "" }
  });

  if (orphanedUserCount > 0) {
    console.log(`[Setup] Found ${orphanedUserCount} orphaned users. Assigning to "${defaultCompany.name}"...`);
    await prisma.user.updateMany({
      where: { companyId: "" },
      data: { companyId: defaultCompany.id }
    });
  }

  // ── 4. Assign orphaned boards (companyId is empty string) and backfill slugs ──
  const orphanedBoards = await prisma.board.findMany({
    where: { OR: [{ companyId: "" }, { slug: "" }] }
  });

  for (const board of orphanedBoards) {
    const updates: { companyId?: string; slug?: string } = {};
    if (!board.companyId || board.companyId === "") {
      updates.companyId = defaultCompany.id;
    }
    if (!board.slug || board.slug === "") {
      updates.slug = slugify(board.name) || `board-${board.id.slice(0, 8)}`;
    }
    if (Object.keys(updates).length > 0) {
      try {
        await prisma.board.update({
          where: { id: board.id },
          data: updates
        });
        console.log(`[Setup] Updated board "${board.name}": ${JSON.stringify(updates)}`);
      } catch (e) {
        // Slug conflict — add suffix
        if (updates.slug) {
          updates.slug = `${updates.slug}-${board.id.slice(0, 6)}`;
          await prisma.board.update({
            where: { id: board.id },
            data: updates
          });
          console.log(`[Setup] Updated board "${board.name}" (with fallback slug): ${JSON.stringify(updates)}`);
        }
      }
    }
  }

  // ── 5. Assign orphaned API credentials ──
  const orphanedCreds = await prisma.apiCredential.count({
    where: { companyId: "" }
  });
  if (orphanedCreds > 0) {
    console.log(`[Setup] Found ${orphanedCreds} orphaned API credentials. Assigning...`);
    await prisma.apiCredential.updateMany({
      where: { companyId: "" },
      data: { companyId: defaultCompany.id }
    });
  }

  // ── 6. Assign orphaned AI inbox configs ──
  const orphanedConfigs = await prisma.aiInboxConfig.count({
    where: { companyId: "" }
  });
  if (orphanedConfigs > 0) {
    console.log(`[Setup] Found ${orphanedConfigs} orphaned AI inbox configs. Assigning...`);
    await prisma.aiInboxConfig.updateMany({
      where: { companyId: "" },
      data: { companyId: defaultCompany.id }
    });
  }

  console.log("[Setup] Default company setup complete!");
}

main()
  .then(() => {
    console.log("[Setup] Script finished successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Setup] Script failed:", error);
    // Don't block deployment on setup failures
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
