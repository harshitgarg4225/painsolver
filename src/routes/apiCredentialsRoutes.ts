import crypto from "crypto";

import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { createApiCredential } from "../lib/apiKey";
import { requireAdminKey } from "../middleware/requireAdminKey";

const createApiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string().min(1)).optional()
});

const revokeApiKeySchema = z.object({
  credentialID: z.string().min(1)
});

export const apiCredentialsRoutes = Router();

apiCredentialsRoutes.use(requireAdminKey);

apiCredentialsRoutes.post("/create", async (req, res) => {
  const parsed = createApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const rawKey = `ps_${crypto.randomBytes(24).toString("hex")}`;
  await createApiCredential(parsed.data.name, rawKey, parsed.data.scopes ?? ["*"]);

  res.status(201).json({
    name: parsed.data.name,
    scopes: parsed.data.scopes ?? ["*"],
    apiKey: rawKey
  });
});

apiCredentialsRoutes.post("/revoke", async (req, res) => {
  const parsed = revokeApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  await prisma.apiCredential.update({
    where: { id: parsed.data.credentialID },
    data: { isActive: false }
  });

  res.status(200).json({ ok: true });
});

apiCredentialsRoutes.get("/list", async (_req, res) => {
  const credentials = await prisma.apiCredential.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({
    credentials: credentials.map((credential) => ({
      id: credential.id,
      name: credential.name,
      isActive: credential.isActive,
      scopes: Array.isArray(credential.scopes)
        ? credential.scopes.filter((value): value is string => typeof value === "string")
        : ["*"],
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt
    }))
  });
});
