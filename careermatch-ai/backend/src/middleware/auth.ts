import { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";
import { prisma } from "../lib/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: { id: string; role: "USER" | "ADMIN" }; }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) throw unauthorized();
    let payload;
    try { payload = verifyAccessToken(h.slice(7)); } catch { throw unauthorized("Session expired"); }
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true } });
    if (!user || !user.isActive) throw unauthorized("Account not available");
    req.user = { id: user.id, role: user.role };
    next();
  } catch (e) { next(e); }
}

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) =>
  req.user?.role === "ADMIN" ? next() : next(forbidden("Administrator access required"));
