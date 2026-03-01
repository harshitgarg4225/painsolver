import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header("x-request-id");
  const requestId = inbound && inbound.trim() ? inbound.trim() : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
