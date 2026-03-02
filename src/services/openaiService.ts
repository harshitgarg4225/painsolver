import OpenAI from "openai";
import { z } from "zod";

import { env } from "../config/env";
import { deterministicEmbedding } from "../lib/vector";

// Enhanced schema with more context for better matching and confidence
const extractedIntentSchema = z.object({
  intent: z.string().min(1),
  type: z.enum(["feature", "bug"]),
  category: z.string().optional(),
  sentiment: z.enum(["frustrated", "neutral", "positive"]).optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  confidenceLevel: z.number().min(0).max(1).optional(),
  keywords: z.array(z.string()).optional(),
  suggestedTitle: z.string().optional(),
  suggestedDescription: z.string().optional()
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

  // Mock sentiment detection
  const sentiment = /\b(frustrated|angry|upset|terrible|awful)\b/i.test(normalized)
    ? "frustrated"
    : /\b(love|great|awesome|thanks)\b/i.test(normalized)
    ? "positive"
    : "neutral";

  // Mock urgency detection
  const urgency = /\b(asap|urgent|critical|immediately|now)\b/i.test(normalized)
    ? "critical"
    : /\b(soon|important|need)\b/i.test(normalized)
    ? "high"
    : "medium";

  // Extract keywords
  const keywordMatches = normalized.match(/\b(analytics|export|report|integration|dashboard|api|webhook|notification|email|slack)\b/gi);
  const keywords = Array.from(new Set(keywordMatches?.map(k => k.toLowerCase()) || []));

  return {
    intent: sentence.slice(0, 280) || "Unclear support request",
    type,
    sentiment,
    urgency,
    confidenceLevel: 0.7,
    keywords,
    suggestedTitle: sentence.slice(0, 100),
    suggestedDescription: normalized.slice(0, 500)
  };
}

// Enhanced prompt for better intent extraction
const INTENT_EXTRACTION_PROMPT = `You are an AI assistant for a Voice of Customer platform. Your job is to analyze customer feedback, support tickets, call transcripts, and Slack messages to extract actionable product insights.

Analyze the input and extract:
1. **intent**: The core feature request or bug report in 1-2 clear sentences. Focus on WHAT the customer wants, not their complaint.
2. **type**: "feature" for new capabilities/improvements, "bug" for things that are broken.
3. **category**: Product area (e.g., "Analytics", "Integrations", "UI/UX", "Performance", "API", "Notifications", "Reporting", "Authentication")
4. **sentiment**: Customer's emotional state:
   - "frustrated": Angry, upset, threatening to churn
   - "neutral": Matter-of-fact, reporting an issue
   - "positive": Constructive, offering suggestions
5. **urgency**: How pressing is this:
   - "critical": Production blocker, data loss, security issue
   - "high": Significantly impacting workflow
   - "medium": Inconvenient but has workarounds
   - "low": Nice to have, minor annoyance
6. **confidenceLevel**: 0.0 to 1.0 - How confident are you that you correctly understood the request?
   - 0.9-1.0: Very clear, specific request
   - 0.7-0.89: Fairly clear with some ambiguity
   - 0.5-0.69: Somewhat unclear, may need clarification
   - 0.0-0.49: Very unclear or off-topic
7. **keywords**: 3-5 key terms for search/categorization
8. **suggestedTitle**: A concise, professional title for this idea (50 chars max)
9. **suggestedDescription**: A well-written description suitable for a public roadmap (200 chars max)

Guidelines:
- Ignore pleasantries, greetings, and signatures
- Combine related points into a single coherent intent
- If multiple unrelated issues exist, focus on the primary/most urgent one
- If the message is just noise (e.g., "thanks", "got it"), return confidenceLevel of 0.1 and intent "No actionable feedback"
- Be generous with confidenceLevel for legitimate feedback`;

export async function extractIntentFromTicket(ticketText: string): Promise<ExtractedIntent> {
  if (env.USE_MOCK_OPENAI) {
    return mockExtractIntent(ticketText);
  }

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: INTENT_EXTRACTION_PROMPT
        },
        {
          role: "user",
          content: ticketText.slice(0, 8000) // Limit input size
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
              type: { type: "string", enum: ["feature", "bug"] },
              category: { type: "string" },
              sentiment: { type: "string", enum: ["frustrated", "neutral", "positive"] },
              urgency: { type: "string", enum: ["low", "medium", "high", "critical"] },
              confidenceLevel: { type: "number" },
              keywords: { type: "array", items: { type: "string" } },
              suggestedTitle: { type: "string" },
              suggestedDescription: { type: "string" }
            },
            required: ["intent", "type", "category", "sentiment", "urgency", "confidenceLevel", "keywords", "suggestedTitle", "suggestedDescription"],
            additionalProperties: false
          }
        }
      }
    });

    const parsedJson = JSON.parse(response.output_text || "{}");
    return extractedIntentSchema.parse(parsedJson);
  } catch (error) {
    console.error("[OpenAI] Intent extraction failed, using fallback:", error);
    return mockExtractIntent(ticketText);
  }
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
