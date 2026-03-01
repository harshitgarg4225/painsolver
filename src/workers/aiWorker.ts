import { Job, Worker } from "bullmq";

import { env } from "../config/env";
import { AI_PROCESSING_QUEUE_NAME } from "../lib/queue";
import { processPainEvent } from "../services/painEventService";

interface AiProcessingJobPayload {
  painEventId: string;
}

async function processJob(job: Job<AiProcessingJobPayload>): Promise<void> {
  const painEventId = job.data.painEventId;
  await processPainEvent(painEventId);
}

export function startAiWorker(): Worker<AiProcessingJobPayload> {
  const worker = new Worker<AiProcessingJobPayload>(AI_PROCESSING_QUEUE_NAME, processJob, {
    connection: { url: env.REDIS_URL },
    concurrency: 5
  });

  worker.on("completed", (job) => {
    console.info(`AI worker completed job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`AI worker failed job ${job?.id}`, error);
  });

  return worker;
}
