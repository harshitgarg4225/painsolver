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
      parsed.searchParams.set("pool_timeout", "20");
    }
    // Add connect timeout to fail fast on cold starts
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "15");
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

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: datasourceUrl
      ? {
          db: {
            url: datasourceUrl
          }
        }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

// Cache globally to reuse across warm invocations in serverless
if (!globalThis.__painsolverPrisma) {
  globalThis.__painsolverPrisma = createPrismaClient();
}

export const prisma = globalThis.__painsolverPrisma;
