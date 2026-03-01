-- CreateEnum
CREATE TYPE "AiInboxRoutingMode" AS ENUM ('central', 'individual');

-- CreateTable
CREATE TABLE "AiInboxConfig" (
    "id" TEXT NOT NULL,
    "source" "PainEventSource" NOT NULL,
    "routingMode" "AiInboxRoutingMode" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInboxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiInboxConfig_source_key" ON "AiInboxConfig"("source");
