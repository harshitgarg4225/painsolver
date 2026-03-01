import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { redisConnection } from "./config/redis";
import { app } from "./app";
import { ensureBootstrapData } from "./services/bootstrapService";
import { startAiWorker } from "./workers/aiWorker";

let server: ReturnType<typeof app.listen> | null = null;
let worker: ReturnType<typeof startAiWorker> | null = null;

async function start(): Promise<void> {
  await ensureBootstrapData();

  server = app.listen(env.PORT, () => {
    console.info(`PainSolver API running on port ${env.PORT}`);
  });

  if (env.START_WORKER && !env.DEMO_MODE) {
    worker = startAiWorker();
    console.info("AI worker started in API process");
  }
}

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}. Shutting down...`);

  if (!server) {
    await Promise.allSettled([prisma.$disconnect(), redisConnection.quit()]);
    process.exit(0);
    return;
  }

  server.close(async () => {
    if (worker) {
      await worker.close();
    }

    await Promise.allSettled([prisma.$disconnect(), redisConnection.quit()]);
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

start().catch(async (error) => {
  console.error("Failed to start server", error);
  await Promise.allSettled([prisma.$disconnect(), redisConnection.quit()]);
  process.exit(1);
});
