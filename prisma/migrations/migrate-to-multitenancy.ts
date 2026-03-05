/**
 * Multi-tenancy Migration Script
 * 
 * This script migrates existing data to the multi-tenant schema:
 * 1. Creates a default company for existing data
 * 2. Updates all boards to belong to the default company
 * 3. Updates AiInboxConfig, CustomDomain, PortalSettings, ApiCredential
 * 
 * Run with: npx ts-node prisma/migrations/migrate-to-multitenancy.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting multi-tenancy migration...");

  // Check if default company already exists
  let defaultCompany = await prisma.company.findFirst({
    where: { slug: "default" }
  });

  if (!defaultCompany) {
    console.log("Creating default company...");
    defaultCompany = await prisma.company.create({
      data: {
        name: "Default Company",
        slug: "default"
      }
    });
    console.log(`Created default company: ${defaultCompany.id}`);
  } else {
    console.log(`Using existing default company: ${defaultCompany.id}`);
  }

  // Update all boards without a companyId
  const boardsUpdated = await prisma.board.updateMany({
    where: {
      companyId: null as any  // Update boards that don't have a companyId yet
    },
    data: {
      companyId: defaultCompany.id,
      slug: "default-board"  // Will need to make unique per board
    }
  });
  console.log(`Updated ${boardsUpdated.count} boards`);

  // Generate unique slugs for boards
  const boards = await prisma.board.findMany({
    where: { companyId: defaultCompany.id }
  });
  
  for (let i = 0; i < boards.length; i++) {
    const board = boards[i];
    const slug = board.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `board-${i + 1}`;
    await prisma.board.update({
      where: { id: board.id },
      data: { slug }
    });
  }
  console.log("Generated unique slugs for all boards");

  // Update AiInboxConfig
  const aiConfigsUpdated = await prisma.aiInboxConfig.updateMany({
    where: {
      companyId: null as any
    },
    data: {
      companyId: defaultCompany.id
    }
  });
  console.log(`Updated ${aiConfigsUpdated.count} AiInboxConfig records`);

  // Update CustomDomain
  const domainsUpdated = await prisma.customDomain.updateMany({
    where: {
      companyId: null as any
    },
    data: {
      companyId: defaultCompany.id
    }
  });
  console.log(`Updated ${domainsUpdated.count} CustomDomain records`);

  // Update or create PortalSettings
  const existingPortalSettings = await prisma.portalSettings.findFirst();
  if (existingPortalSettings) {
    await prisma.portalSettings.update({
      where: { id: existingPortalSettings.id },
      data: { companyId: defaultCompany.id }
    });
    console.log("Updated existing PortalSettings");
  } else {
    await prisma.portalSettings.create({
      data: {
        companyId: defaultCompany.id,
        portalName: "Feedback Portal"
      }
    });
    console.log("Created default PortalSettings");
  }

  // Update ApiCredential
  const credentialsUpdated = await prisma.apiCredential.updateMany({
    where: {
      companyId: null as any
    },
    data: {
      companyId: defaultCompany.id
    }
  });
  console.log(`Updated ${credentialsUpdated.count} ApiCredential records`);

  // Update users without a company to belong to default company
  const usersUpdated = await prisma.user.updateMany({
    where: {
      companyId: null as any
    },
    data: {
      companyId: defaultCompany.id
    }
  });
  console.log(`Updated ${usersUpdated.count} users`);

  console.log("\n✅ Multi-tenancy migration complete!");
  console.log(`\nDefault company: ${defaultCompany.name} (${defaultCompany.slug})`);
  console.log(`Company ID: ${defaultCompany.id}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

