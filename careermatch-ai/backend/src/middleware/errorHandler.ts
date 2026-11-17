import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../lib/errors";
import { isProd } from "../config/env";
import { AIUnavailableError } from "../services/ai/provider";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof AIUnavailableError) {
    const status = err.code === "AI_NOT_CONFIGURED" ? 503 : 502;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    return res.status(400).json({ error: { code: "UPLOAD_ERROR", message } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_JSON", message: "Malformed JSON body" } });
  }
  if (err?.code === "P2002") {
    return res.status(409).json({ error: { code: "CONFLICT", message: "A record with these details already exists" } });
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: { code: "INTERNAL", message: isProd ? "Something went wrong" : String(err?.message ?? err) } });
}
