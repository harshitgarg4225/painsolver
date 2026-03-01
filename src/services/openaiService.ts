import OpenAI from "openai";
import { z } from "zod";

import { env } from "../config/env";
import { deterministicEmbedding } from "../lib/vector";

const extractedIntentSchema = z.object({
  intent: z.string().min(1),
  type: z.enum(["feature", "bug"])
});

export type ExtractedIntent = z.infer<typeof extractedIntentSchema>;

const openaiClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

function mockExtractIntent(ticketText: string): ExtractedIntent {
  const normalized = ticketText.replace(/\s+/g, " ").trim();
  const sentence = normalized.split(/[.!?]/).find(Boolean) ?? normalized;

  const type = /\b(bug|error|broken|crash|issue|fails?)\b/i.test(normalized)
    ? "bug"
    : "feature";

  return {
    intent: sentence.slice(0, 280) || "Unclear support request",
    type
  };
}

export async function extractIntentFromTicket(ticketText: string): Promise<ExtractedIntent> {
  if (env.USE_MOCK_OPENAI) {
    return mockExtractIntent(ticketText);
  }

  const response = await openaiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "Extract the core feature request or bug from this ticket. Output JSON only with shape: { intent: string, type: 'feature' | 'bug' }."
      },
      {
        role: "user",
        content: ticketText
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "intent_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            intent: { type: "string" },
            type: { type: "string", enum: ["feature", "bug"] }
          },
          required: ["intent", "type"],
          additionalProperties: false
        }
      }
    }
  });

  const parsedJson = JSON.parse(response.output_text || "{}");
  return extractedIntentSchema.parse(parsedJson);
}

export async function generateIntentEmbedding(text: string): Promise<number[]> {
  if (env.USE_MOCK_OPENAI) {
    return deterministicEmbedding(text);
  }

  const embeddingResponse = await openaiClient.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return embeddingResponse.data[0]?.embedding ?? deterministicEmbedding(text);
}
