-- PainSolver Database Migration SQL
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This must be executed as the postgres user (which Supabase SQL Editor does by default)

-- ============================================
-- 1. GRANT DDL permissions to painsolver_app
-- ============================================
GRANT CREATE ON SCHEMA public TO painsolver_app;

-- Grant ownership of all existing tables to painsolver_app so Prisma can manage them
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO painsolver_app', tbl.tablename);
    END LOOP;
END $$;

-- Grant ownership of all existing types/enums to painsolver_app
DO $$
DECLARE
    typ record;
BEGIN
    FOR typ IN SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'
    LOOP
        EXECUTE format('ALTER TYPE public.%I OWNER TO painsolver_app', typ.typname);
    END LOOP;
END $$;

-- Grant ownership of all sequences to painsolver_app
DO $$
DECLARE
    seq record;
BEGIN
    FOR seq IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO painsolver_app', seq.sequencename);
    END LOOP;
END $$;

-- Ensure painsolver_app has full privileges on public schema going forward
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO painsolver_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO painsolver_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO painsolver_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TYPES TO painsolver_app;

-- ============================================
-- 2. CREATE new enum
-- ============================================
DO $$ BEGIN
    CREATE TYPE "CustomDomainStatus" AS ENUM ('pending_verification', 'verified', 'failed', 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 3. ALTER existing enums (add new values)
-- ============================================
DO $$ BEGIN ALTER TYPE "PainEventSource" ADD VALUE IF NOT EXISTS 'slack'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PainEventStatus" ADD VALUE IF NOT EXISTS 'skipped'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PainEventStatus" ADD VALUE IF NOT EXISTS 'dismissed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'owner'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 4. ALTER existing tables (add new columns)
-- ============================================

-- AiActionLog
ALTER TABLE "AiActionLog" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- AiInboxConfig
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "similarityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75;
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "slackChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "slackChannelNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "slackLastSyncAt" TIMESTAMP(3);
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "slackTeamId" TEXT;
ALTER TABLE "AiInboxConfig" ADD COLUMN IF NOT EXISTS "slackTeamName" TEXT;

-- ApiCredential
ALTER TABLE "ApiCredential" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT '';

-- Board
ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT '';

-- Comment
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "cannyCompanyId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT '';

-- Post
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "cannyId" TEXT;

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cannyUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "User" ALTER COLUMN "companyId" SET DEFAULT '';

-- ============================================
-- 5. CREATE new tables
-- ============================================

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SlackConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "slackTeamName" TEXT,
    "slackUserId" TEXT NOT NULL,
    "slackUserName" TEXT,
    "accessToken" TEXT NOT NULL,
    "botUserId" TEXT,
    "scope" TEXT,
    "channelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channelNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomDomain" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL DEFAULT '',
    "domain" TEXT NOT NULL,
    "status" "CustomDomainStatus" NOT NULL DEFAULT 'pending_verification',
    "verificationToken" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL DEFAULT 'dns_txt',
    "sslStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortalSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL DEFAULT '',
    "portalName" TEXT NOT NULL DEFAULT 'Feedback Portal',
    "portalLogo" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#004549',
    "accentColor" TEXT NOT NULL DEFAULT '#00eef9',
    "customCss" TEXT,
    "customDomainId" TEXT,
    "allowPublicSignup" BOOLEAN NOT NULL DEFAULT true,
    "requireEmailVerify" BOOLEAN NOT NULL DEFAULT false,
    "maxImageSizeMb" INTEGER NOT NULL DEFAULT 5,
    "allowedImageTypes" TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortalSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UploadedFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'comment',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 6. DROP old unique indexes (moving to compound unique)
-- ============================================
DROP INDEX IF EXISTS "AiInboxConfig_source_key";
DROP INDEX IF EXISTS "Board_name_key";
DROP INDEX IF EXISTS "Company_name_key";
DROP INDEX IF EXISTS "User_appUserId_key";
DROP INDEX IF EXISTS "User_email_key";

-- Drop old FK that we'll recreate
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_companyId_fkey";

-- ============================================
-- 7. CREATE new indexes
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SlackConnection_userId_key" ON "SlackConnection"("userId");
CREATE INDEX IF NOT EXISTS "SlackConnection_slackTeamId_idx" ON "SlackConnection"("slackTeamId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDomain_domain_key" ON "CustomDomain"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDomain_verificationToken_key" ON "CustomDomain"("verificationToken");
CREATE INDEX IF NOT EXISTS "CustomDomain_companyId_idx" ON "CustomDomain"("companyId");
CREATE INDEX IF NOT EXISTS "CustomDomain_status_idx" ON "CustomDomain"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "PortalSettings_companyId_key" ON "PortalSettings"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "PortalSettings_customDomainId_key" ON "PortalSettings"("customDomainId");
CREATE INDEX IF NOT EXISTS "UploadedFile_uploadedBy_idx" ON "UploadedFile"("uploadedBy");
CREATE INDEX IF NOT EXISTS "UploadedFile_purpose_idx" ON "UploadedFile"("purpose");
CREATE INDEX IF NOT EXISTS "AiInboxConfig_companyId_idx" ON "AiInboxConfig"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AiInboxConfig_companyId_source_key" ON "AiInboxConfig"("companyId", "source");
CREATE INDEX IF NOT EXISTS "ApiCredential_companyId_idx" ON "ApiCredential"("companyId");
CREATE INDEX IF NOT EXISTS "Board_companyId_idx" ON "Board"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Board_companyId_name_key" ON "Board"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Board_companyId_slug_key" ON "Board"("companyId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Company_cannyCompanyId_key" ON "Company"("cannyCompanyId");
CREATE INDEX IF NOT EXISTS "Company_slug_idx" ON "Company"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Post_cannyId_key" ON "Post"("cannyId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerifyToken_key" ON "User"("emailVerifyToken");
CREATE UNIQUE INDEX IF NOT EXISTS "User_passwordResetToken_key" ON "User"("passwordResetToken");
CREATE INDEX IF NOT EXISTS "User_companyId_idx" ON "User"("companyId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_companyId_email_key" ON "User"("companyId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_companyId_appUserId_key" ON "User"("companyId", "appUserId");

-- ============================================
-- 8. ADD foreign keys
-- ============================================
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Board" ADD CONSTRAINT "Board_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiInboxConfig" ADD CONSTRAINT "AiInboxConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlackConnection" ADD CONSTRAINT "SlackConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalSettings" ADD CONSTRAINT "PortalSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 9. GRANT ownership of new objects to painsolver_app
-- ============================================
ALTER TABLE "Session" OWNER TO painsolver_app;
ALTER TABLE "SlackConnection" OWNER TO painsolver_app;
ALTER TABLE "CustomDomain" OWNER TO painsolver_app;
ALTER TABLE "PortalSettings" OWNER TO painsolver_app;
ALTER TABLE "UploadedFile" OWNER TO painsolver_app;
ALTER TYPE "CustomDomainStatus" OWNER TO painsolver_app;

-- Grant full table access to painsolver_app for all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO painsolver_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO painsolver_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO painsolver_app;

-- ============================================
-- 10. BACKFILL default company data
-- ============================================
-- Set slug for companies that have empty slugs
UPDATE "Company" SET "slug" = LOWER(REPLACE(REPLACE("name", ' ', '-'), '''', '')) WHERE "slug" = '' OR "slug" IS NULL;

-- Set companyId for boards that have empty companyId
UPDATE "Board" b SET "companyId" = c.id FROM "Company" c WHERE b."companyId" = '' ORDER BY c."createdAt" ASC LIMIT 1;

-- Set slug for boards that have empty slugs
UPDATE "Board" SET "slug" = LOWER(REPLACE(REPLACE("name", ' ', '-'), '''', '')) WHERE "slug" = '' OR "slug" IS NULL;

-- Set companyId for ApiCredentials that have empty companyId
UPDATE "ApiCredential" ac SET "companyId" = c.id FROM (SELECT id FROM "Company" ORDER BY "createdAt" ASC LIMIT 1) c WHERE ac."companyId" = '';

-- Set companyId for AiInboxConfig that have empty companyId
UPDATE "AiInboxConfig" ai SET "companyId" = c.id FROM (SELECT id FROM "Company" ORDER BY "createdAt" ASC LIMIT 1) c WHERE ai."companyId" = '';

SELECT 'Migration complete! All objects owned by painsolver_app.' as status;

