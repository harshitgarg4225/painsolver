import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __painsolverPrisma: PrismaClient | undefined;
}

function isPostgresUrl(url: URL): boolean {
  return url.protocol === "postgres:" || url.protocol === "postgresql:";
}

function withServerlessPoolDefaults(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) {
    return rawUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (!isPostgresUrl(parsed)) {
    return rawUrl;
  }

  const runningOnVercel = Boolean(process.env.VERCEL);
  if (runningOnVercel) {
    // Keep Prisma's DB pool tiny in serverless environments to avoid exhausting Supabase/PgBouncer session limits.
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
    }
    if (
      (parsed.hostname.includes("pooler.") || parsed.hostname.includes("supabase")) &&
      !parsed.searchParams.has("pgbouncer")
    ) {
      parsed.searchParams.set("pgbouncer", "true");
    }
  }

  return parsed.toString();
}

const datasourceUrl = withServerlessPoolDefaults(process.env.DATABASE_URL);
const prismaClient =
  globalThis.__painsolverPrisma ??
  new PrismaClient(
    datasourceUrl
      ? {
          datasources: {
            db: {
              url: datasourceUrl
            }
          }
        }
      : undefined
  );

// Cache globally to reuse across warm invocations in serverless
globalThis.__painsolverPrisma = prismaClient;

export const prisma = prismaClient;
