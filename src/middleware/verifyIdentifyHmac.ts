import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { buildIdentifyPayload, verifyHmacSignature } from "../lib/hash";

export function verifyIdentifyHmac(req: Request, res: Response, next: NextFunction): void {
  const { user, company, hash } = req.body ?? {};

  if (!user || !company || typeof hash !== "string") {
    res.status(400).json({
      error: "Missing identify payload. Expected user, company, and hash."
    });
    return;
  }

  const payload = buildIdentifyPayload(user, company);
  const isValid = verifyHmacSignature(payload, hash, env.PAINSOLVER_CLIENT_SECRET);

  if (!isValid) {
    res.status(401).json({ error: "Invalid HMAC signature" });
    return;
  }

  next();
}
