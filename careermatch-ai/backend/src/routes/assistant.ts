import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AIService } from "../services/ai";
import { describeCandidate, loadCandidate } from "../services/candidate";

export const assistantRouter = Router();
assistantRouter.use(requireAuth);

const limiter = rateLimit({
  windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: () => env.NODE_ENV === "test",
  keyGenerator: (req) => req.user?.id ?? "anon",
  message: { error: { code: "RATE_LIMITED", message: "You're sending messages too quickly. Please wait a moment." } },
});

assistantRouter.get("/messages", asyncHandler(async (req, res) => {
  const msgs = await prisma.chatMessage.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "asc" }, take: 100 });
  res.json({ messages: msgs, aiConfigured: AIService.isConfigured() });
}));

assistantRouter.post("/messages", limiter, validate(z.object({ content: z.string().trim().min(1).max(2000) })), asyncHandler(async (req, res) => {
  const { profile, candidate } = await loadCandidate(req.user!.id);
  const recent = await prisma.chatMessage.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 16 });
  const history = [...recent.reverse().map((m) => ({ role: m.role === "USER" ? "user" as const : "assistant" as const, content: m.content })), { role: "user" as const, content: req.body.content }];
  // Call the model first so a failed/unconfigured AI never leaves an orphaned user message.
  const reply = await AIService.chat(describeCandidate(profile, candidate), history);
  const [userMsg, botMsg] = await prisma.$transaction([
    prisma.chatMessage.create({ data: { userId: req.user!.id, role: "USER", content: req.body.content } }),
    prisma.chatMessage.create({ data: { userId: req.user!.id, role: "ASSISTANT", content: reply || "Sorry, I couldn't come up with a response. Please try again." } }),
  ]);
  res.status(201).json({ messages: [userMsg, botMsg] });
}));

assistantRouter.delete("/messages", asyncHandler(async (req, res) => {
  await prisma.chatMessage.deleteMany({ where: { userId: req.user!.id } });
  res.json({ ok: true });
}));
