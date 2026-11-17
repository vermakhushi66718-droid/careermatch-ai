import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { AIService } from "../services/ai";
import { loadCandidate } from "../services/candidate";

export const interviewRouter = Router();
interviewRouter.use(requireAuth);

const include = { questions: { orderBy: { order: "asc" as const } } };

async function owned(userId: string, id: string) {
  const s = await prisma.interviewSession.findFirst({ where: { id, userId }, include });
  if (!s) throw notFound("Interview not found");
  return s;
}

interviewRouter.get("/", asyncHandler(async (req, res) => {
  const items = await prisma.interviewSession.findMany({
    where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, include: { questions: { select: { id: true, answeredAt: true } } },
  });
  res.json({ sessions: items.map((s) => ({
    id: s.id, targetRole: s.targetRole, difficulty: s.difficulty, status: s.status, overallScore: s.overallScore,
    createdAt: s.createdAt, completedAt: s.completedAt, total: s.questions.length, answered: s.questions.filter((q) => q.answeredAt).length,
  })) });
}));

interviewRouter.post("/", validate(z.object({
  targetRole: z.string().trim().min(2).max(100),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.coerce.number().int().min(3).max(10).default(5),
})), asyncHandler(async (req, res) => {
  const { candidate } = await loadCandidate(req.user!.id);
  const qs = await AIService.generateInterviewQuestions({ role: req.body.targetRole, difficulty: req.body.difficulty, skills: candidate.skills.slice(0, 30), count: req.body.count });
  const s = await prisma.interviewSession.create({
    data: {
      userId: req.user!.id, targetRole: req.body.targetRole, difficulty: req.body.difficulty,
      questions: { create: qs.map((q, i) => ({ order: i, category: q.category.slice(0, 30), question: q.question.slice(0, 1000) })) },
    },
    include,
  });
  res.status(201).json({ session: s });
}));

interviewRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ session: await owned(req.user!.id, String(req.params.id)) });
}));

interviewRouter.post("/:id/questions/:qid/answer", validate(z.object({ answer: z.string().trim().min(10, "Please write a fuller answer (at least 10 characters)").max(6000) })),
  asyncHandler(async (req, res) => {
    const s = await owned(req.user!.id, String(req.params.id));
    if (s.status === "COMPLETED") throw badRequest("This interview is already completed");
    const q = s.questions.find((x) => x.id === req.params.qid);
    if (!q) throw notFound("Question not found");
    if (q.answeredAt) throw badRequest("This question has already been answered");
    const ev = await AIService.evaluateAnswer({ role: s.targetRole, question: q.question, answer: req.body.answer });
    const updated = await prisma.interviewQuestion.update({
      where: { id: q.id },
      data: { answer: req.body.answer, feedback: ev as any, score: Math.round(ev.score), answeredAt: new Date() },
    });
    res.json({ question: updated });
  }));

interviewRouter.post("/:id/complete", asyncHandler(async (req, res) => {
  const s = await owned(req.user!.id, String(req.params.id));
  if (s.status === "COMPLETED") return res.json({ session: s });
  const answered = s.questions.filter((q) => q.answeredAt);
  if (!answered.length) throw badRequest("Answer at least one question before finishing");
  const summary = await AIService.summarizeInterview({ role: s.targetRole, qa: answered.map((q) => ({ question: q.question, answer: q.answer!, score: q.score ?? 0 })) });
  await prisma.interviewSession.update({
    where: { id: s.id }, data: { status: "COMPLETED", completedAt: new Date(), summary: summary as any, overallScore: Math.round(summary.overallScore) },
  });
  res.json({ session: await owned(req.user!.id, s.id) });
}));

interviewRouter.delete("/:id", asyncHandler(async (req, res) => {
  const r = await prisma.interviewSession.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!r.count) throw notFound("Interview not found");
  res.json({ ok: true });
}));
