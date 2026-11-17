import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { badRequest } from "../lib/errors";

type Part = "body" | "query" | "params";
export const validate = (schema: ZodSchema, part: Part = "body") => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req[part]);
  if (!r.success) {
    const fields: Record<string, string> = {};
    r.error.issues.forEach((i) => { fields[i.path.join(".") || "_"] = i.message; });
    return next(badRequest("Validation failed", fields));
  }
  if (part === "query") { (req as any).validQuery = r.data; } else { (req as any)[part] = r.data; }
  next();
};
