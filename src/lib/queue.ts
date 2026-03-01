import { Queue } from "bullmq";

import { env } from "../config/env";

export const AI_PROCESSING_QUEUE_NAME = "ai-processing-queue";

type AiProcessingQueue = {
  add: (name: string, data: Record<string, unknown>) => Promise<unknown>;
};

class NoopQueue implements AiProcessingQueue {
  async add(_name: string, data: Record<string, unknown>): Promise<unknown> {
    return {
      id: `demo-${Date.now()}`,
      data
    };
  }
}

function shouldUseNoopQueue(): boolean {
  if (env.DEMO_MODE) {
    return true;
  }

  // Vercel functions cannot access local Redis endpoints.
  if (process.env.VERCEL && /(localhost|127\.0\.0\.1)/i.test(env.REDIS_URL)) {
    return true;
  }

  return false;
}

export const aiProcessingQueue: AiProcessingQueue = shouldUseNoopQueue()
  ? new NoopQueue()
  : new Queue(AI_PROCESSING_QUEUE_NAME, {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000
        },
        removeOnComplete: 1000,
        removeOnFail: 1000
      }
    });
