/**
 * Ensure Default Company Script
 * 
 * This script runs after build to ensure there's at least one company
 * and that all orphaned data (boards, users without companies) are assigned.
 * 
 * Safe to run multiple times - idempotent.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[Setup] Checking for default company...");

  // Check if any company exists
  const companyCount = await prisma.company.count();
  
  if (companyCount > 0) {
    console.log(`[Setup] Found ${companyCount} existing companies. Skipping setup.`);
    return;
  }

  console.log("[Setup] No companies found. Creating default company...");

  // Create default company with a board
  const company = await prisma.company.create({
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
    include: {
      boards: true
    }
  });

  console.log(`[Setup] Created default company: ${company.name} (${company.id})`);
  console.log(`[Setup] Created default board: ${company.boards[0]?.name}`);

  // Check for orphaned users and assign to default company
  const orphanedUsers = await prisma.user.findMany({
    where: {
      company: null as any // Users without a company
    }
  });

  if (orphanedUsers.length > 0) {
    console.log(`[Setup] Found ${orphanedUsers.length} orphaned users. Assigning to default company...`);
    
    await prisma.user.updateMany({
      where: {
        id: { in: orphanedUsers.map(u => u.id) }
      },
      data: {
        companyId: company.id
      }
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
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

