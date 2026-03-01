import { startAiWorker } from "./aiWorker";

const worker = startAiWorker();

console.info("AI worker started. Listening to ai-processing-queue...");

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}. Closing AI worker...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
