import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env, isProd } from "../config/env";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import { hashToken, newOpaqueToken, signAccessToken } from "../lib/tokens";
import { badRequest, conflict, unauthorized } from "../lib/errors";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email";

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
});

export const passwordSchema = z.string().min(8, "At least 8 characters")
  .regex(/[a-z]/, "Include a lowercase letter").regex(/[A-Z]/, "Include an uppercase letter").regex(/\d/, "Include a number");

const REFRESH_COOKIE = "cm_refresh";
const cookieOpts = {
  httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
};

const publicUser = (u: any) => ({
  id: u.id, email: u.email, fullName: u.fullName, role: u.role,
  emailVerified: u.emailVerified, onboardingComplete: u.onboardingComplete,
});

async function issueSession(res: Response, user: { id: string; role: "USER" | "ADMIN" }, userAgent?: string) {
  const refresh = newOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id, tokenHash: hashToken(refresh), userAgent: userAgent?.slice(0, 200),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000),
    },
  });
  res.cookie(REFRESH_COOKIE, refresh, cookieOpts);
  return signAccessToken({ sub: user.id, role: user.role });
}

async function createAuthToken(userId: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", ttlMs: number) {
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const raw = newOpaqueToken();
  await prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

async function consumeAuthToken(raw: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET") {
  const rec = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!rec || rec.type !== type || rec.usedAt || rec.expiresAt < new Date()) throw badRequest("This link is invalid or has expired");
  await prisma.authToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
  return rec.userId;
}

authRouter.post("/register", limiter,
  validate(z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    password: passwordSchema,
  })),
  asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;
    if (await prisma.user.findUnique({ where: { email } })) throw conflict("An account with this email already exists");
    const user = await prisma.user.create({
      data: { fullName, email, passwordHash: await hashPassword(password), profile: { create: {} } },
    });
    const token = await createAuthToken(user.id, "EMAIL_VERIFICATION", 24 * 3600_000);
    await sendVerificationEmail(email, fullName, token).catch((e) => console.error("[email]", e.message));
    const accessToken = await issueSession(res, user, req.headers["user-agent"]);
    res.status(201).json({ user: publicUser(user), accessToken });
  }));

authRouter.post("/login", limiter,
  validate(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    // Same message for unknown email and wrong password (no account enumeration).
    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) throw unauthorized("Incorrect email or password");
    if (!user.isActive) throw unauthorized("This account has been deactivated");
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await issueSession(res, user, req.headers["user-agent"]);
    res.json({ user: publicUser(user), accessToken });
  }));

authRouter.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw unauthorized("No session");
  const rec = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
  if (!rec) throw unauthorized("Invalid session");
  if (rec.revokedAt) {
    // A rotated token was presented again: treat as theft, revoke the whole family.
    await prisma.refreshToken.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    throw unauthorized("Session no longer valid. Please sign in again.");
  }
  if (rec.expiresAt < new Date() || !rec.user.isActive) throw unauthorized("Session expired");
  await prisma.refreshToken.update({ where: { id: rec.id }, data: { revokedAt: new Date() } });
  const accessToken = await issueSession(res, rec.user, req.headers["user-agent"]);
  res.json({ user: publicUser(rec.user), accessToken });
}));

authRouter.post("/logout", asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ ok: true });
}));

authRouter.post("/verify-email", validate(z.object({ token: z.string().min(10) })),
  asyncHandler(async (req, res) => {
    const userId = await consumeAuthToken(req.body.token, "EMAIL_VERIFICATION");
    const user = await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    res.json({ user: publicUser(user) });
  }));

authRouter.post("/resend-verification", limiter, requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const token = await createAuthToken(user.id, "EMAIL_VERIFICATION", 24 * 3600_000);
  await sendVerificationEmail(user.email, user.fullName, token);
  res.json({ ok: true });
}));

authRouter.post("/forgot-password", limiter, validate(z.object({ email: z.string().trim().toLowerCase().email() })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user?.isActive) {
      const token = await createAuthToken(user.id, "PASSWORD_RESET", 3600_000);
      await sendPasswordResetEmail(user.email, user.fullName, token).catch((e) => console.error("[email]", e.message));
    }
    // Identical response either way.
    res.json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
  }));

authRouter.post("/reset-password", limiter, validate(z.object({ token: z.string().min(10), password: passwordSchema })),
  asyncHandler(async (req, res) => {
    const userId = await consumeAuthToken(req.body.token, "PASSWORD_RESET");
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(req.body.password) } });
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  }));

authRouter.post("/change-password", requireAuth,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(req.body.currentPassword, user.passwordHash))) throw badRequest("Current password is incorrect");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  }));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ user: publicUser(user) });
}));
