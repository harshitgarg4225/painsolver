import { Router } from "express";

// Legacy webhook routes - Freshdesk webhook is now at /api/integrations/freshdesk/webhook
// This router is kept for future webhook integrations.
export const webhooksRoutes = Router();
