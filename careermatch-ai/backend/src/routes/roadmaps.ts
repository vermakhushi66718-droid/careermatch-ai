import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { AIService } from "../services/ai";
import { loadCandidate } from "../services/candidate";
import { scoreJob } from "../services/matching";
import { normSkill, normSkills, cleanList } from "../utils/skills";

export const roadmapRouter = Router();
roadmapRouter.use(requireAuth);

const include = { items: { orderBy: { order: "asc" as const } } };
const progress = (r: any) => {
  const total = r.items.length, done = r.items.filter((i: any) => i.completed).length;
  return { ...r, progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 } };
};

roadmapRouter.get("/", asyncHandler(async (req, res) => {
  const items = await prisma.roadmap.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, include });
  res.json({ roadmaps: items.map(progress) });
}));

roadmapRouter.get("/skill-gap/:jobId", asyncHandler(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: String(req.params.jobId) } });
  if (!job) throw notFound("Job not found");
  const { candidate } = await loadCandidate(req.user!.id);
  const m = scoreJob(job, candidate);
  res.json({ job: { id: job.id, title: job.title, company: job.company }, matched: m.matchedSkills, missing: m.missingSkills, score: m.score });
}));

const genSchema = z.object({
  jobId: z.string().optional(),
  targetRole: z.string().trim().min(2).max(100).optional(),
  missingSkills: z.array(z.string().trim().min(1).max(60)).max(25).optional(),
}).refine((d) => d.jobId || d.targetRole, { message: "Choose a job or enter a target role" });

roadmapRouter.post("/generate", validate(genSchema), asyncHandler(async (req, res) => {
  const { candidate } = await loadCandidate(req.user!.id);
  let targetRole = req.body.targetRole as string | undefined;
  let missing: string[] = cleanList(req.body.missingSkills ?? []);
  let level = "fresher";
  if (req.body.jobId) {
    const job = await prisma.job.findUnique({ where: { id: req.body.jobId } });
    if (!job) throw notFound("Job not found");
    targetRole = targetRole ?? `${job.title} at ${job.company}`;
    level = job.experienceLevel.toLowerCase();
    if (!missing.length) missing = scoreJob(job, candidate).missingSkills;
  }
  if (!missing.length) {
    if (!req.body.jobId) throw badRequest("Add at least one skill you want to learn, or pick a job to compare against");
    throw badRequest("Great news: you already have all the required skills for this job — no gaps to close.");
  }
  const have = new Set(normSkills(candidate.skills));
  missing = missing.filter((s) => !have.has(normSkill(s)));
  const gen = await AIService.generateRoadmap({ targetRole: targetRole!, currentSkills: candidate.skills.slice(0, 40), missingSkills: missing, level });
  const roadmap = await prisma.roadmap.create({
    data: {
      userId: req.user!.id, title: gen.title.slice(0, 150), targetRole: targetRole!.slice(0, 150), jobId: req.body.jobId ?? null,
      missingSkills: missing, content: gen as any,
      items: { create: gen.items.map((it, i) => ({ order: i, skill: it.skill.slice(0, 80), title: it.title.slice(0, 150), description: it.description.slice(0, 1200), estimatedWeeks: it.estimatedWeeks, resources: it.resources as any })) },
    },
    include,
  });
  res.status(201).json({ roadmap: progress(roadmap) });
}));

roadmapRouter.patch("/:id/items/:itemId", validate(z.object({ completed: z.boolean() })), asyncHandler(async (req, res) => {
  const item = await prisma.roadmapItem.findFirst({ where: { id: String(req.params.itemId), roadmapId: String(req.params.id), roadmap: { userId: req.user!.id } } });
  if (!item) throw notFound("Roadmap item not found");
  await prisma.roadmapItem.update({ where: { id: item.id }, data: { completed: req.body.completed, completedAt: req.body.completed ? new Date() : null } });
  const r = await prisma.roadmap.findUniqueOrThrow({ where: { id: item.roadmapId }, include });
  res.json({ roadmap: progress(r) });
}));

// When a learner finishes an item, they can add that skill to their profile.
roadmapRouter.post("/:id/items/:itemId/add-skill", asyncHandler(async (req, res) => {
  const item = await prisma.roadmapItem.findFirst({ where: { id: String(req.params.itemId), roadmapId: String(req.params.id), roadmap: { userId: req.user!.id } } });
  if (!item) throw notFound("Roadmap item not found");
  const p = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
  await prisma.profile.update({ where: { userId: req.user!.id }, data: { technicalSkills: cleanList([...(p?.technicalSkills ?? []), item.skill], 120) } });
  res.json({ ok: true });
}));

roadmapRouter.delete("/:id", asyncHandler(async (req, res) => {
  const r = await prisma.roadmap.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!r.count) throw notFound("Roadmap not found");
  res.json({ ok: true });
}));
