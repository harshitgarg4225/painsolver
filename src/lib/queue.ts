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

export const aiProcessingQueue: AiProcessingQueue = env.DEMO_MODE
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
