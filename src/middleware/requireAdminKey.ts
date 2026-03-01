import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  if (!env.PAINSOLVER_MASTER_API_KEY) {
    next();
    return;
  }

  const fromHeader = req.header("x-admin-key") ?? req.header("X-Admin-Key");
  const fromQuery = typeof req.query.adminKey === "string" ? req.query.adminKey : undefined;

  if (fromHeader === env.PAINSOLVER_MASTER_API_KEY || fromQuery === env.PAINSOLVER_MASTER_API_KEY) {
    next();
    return;
  }

  res.status(401).json({ error: "Missing or invalid admin key" });
}
