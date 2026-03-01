-- AlterTable
ALTER TABLE "AiInboxConfig" ADD COLUMN     "freshdeskApiKey" TEXT,
ADD COLUMN     "freshdeskDomain" TEXT,
ADD COLUMN     "freshdeskFieldCatalog" JSONB,
ADD COLUMN     "freshdeskFilterField" TEXT,
ADD COLUMN     "freshdeskFilterValue" TEXT,
ADD COLUMN     "freshdeskLastFieldSyncAt" TIMESTAMP(3),
ADD COLUMN     "freshdeskLastTicketSyncAt" TIMESTAMP(3);
