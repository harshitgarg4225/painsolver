import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1).default("postgresql://demo:demo@localhost:5432/painsolver_demo"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("changelog-media"),
  OPENAI_API_KEY: z.string().default("mock-openai-key"),
  STRIPE_API_KEY: z.string().default("mock-stripe-key"),
  PAINSOLVER_CLIENT_SECRET: z.string().min(1).default("demo-client-secret"),
  PAINSOLVER_MASTER_API_KEY: z.string().optional(),
  ALLOW_INSECURE_ACTOR_HEADERS: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  AGENT_REQUIRE_IDEMPOTENCY: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  AGENT_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86400),
  AI_SIMILARITY_THRESHOLD: z.coerce.number().default(0.9),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  USE_MOCK_OPENAI: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  USE_MOCK_STRIPE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  USE_MOCK_FRESHDESK: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  ZOOM_CLIENT_ID: z.string().default("mock-zoom-client-id"),
  ZOOM_CLIENT_SECRET: z.string().default("mock-zoom-client-secret"),
  ZOOM_REDIRECT_URI: z.string().default("http://localhost:3000/api/integrations/zoom/callback"),
  USE_MOCK_ZOOM: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  SLACK_CLIENT_ID: z.string().default(""),
  SLACK_CLIENT_SECRET: z.string().default(""),
  SLACK_REDIRECT_URI: z.string().default("http://localhost:3000/api/integrations/slack/callback"),
  SLACK_STATE_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM_ADDRESS: z.string().default("PainSolver <notifications@painsolver.vercel.app>"),
  EMAIL_REPLY_TO: z.string().default("support@painsolver.vercel.app"),
  APP_URL: z.string().default("https://painsolver.vercel.app"),
  START_WORKER: z
    .string()
    .optional()
    .transform((value) => value === "true")
});

export const env = envSchema.parse(process.env);
