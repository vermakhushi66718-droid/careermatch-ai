import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { scoreJob } from "../services/matching";
import { describeCandidate, loadCandidate } from "../services/candidate";
import { AIService } from "../services/ai";

export const jobRouter = Router();
jobRouter.use(requireAuth);

const csvOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.string().optional().transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
    .refine((arr) => arr.every((x) => (values as readonly string[]).includes(x)), { message: `Allowed values: ${values.join(", ")}` });
const csv = z.string().optional().transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));
const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: csvOf(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]),
  mode: csvOf(["ONSITE", "REMOTE", "HYBRID"]),
  level: csvOf(["FRESHER", "JUNIOR", "MID", "SENIOR"]),
  category: csv,
  location: z.string().trim().max(100).optional(),
  minSalary: z.coerce.number().int().min(0).optional(),
  saved: z.enum(["true", "false"]).optional(),
  sort: z.enum(["match", "recent", "salary"]).default("match"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

const jobView = (j: any) => ({
  id: j.id, title: j.title, company: j.company, location: j.location, workMode: j.workMode, type: j.type,
  experienceLevel: j.experienceLevel, description: j.description, requiredSkills: j.requiredSkills,
  preferredSkills: j.preferredSkills, minCgpa: j.minCgpa, salaryMin: j.salaryMin, salaryMax: j.salaryMax,
  currency: j.currency, applyUrl: j.applyUrl, category: j.category, postedAt: j.postedAt,
  isSample: j.isSample, source: j.source,
});

jobRouter.get("/", validate(querySchema, "query"), asyncHandler(async (req, res) => {
  const q = (req as any).validQuery as z.infer<typeof querySchema>;
  const where: Prisma.JobWhereInput = { isActive: true };
  if (q.q) where.OR = [
    { title: { contains: q.q, mode: "insensitive" } }, { company: { contains: q.q, mode: "insensitive" } },
    { description: { contains: q.q, mode: "insensitive" } }, { requiredSkills: { hasSome: [q.q, q.q.toLowerCase(), q.q.toUpperCase()] } },
  ];
  if (q.type.length) where.type = { in: q.type as any };
  if (q.mode.length) where.workMode = { in: q.mode as any };
  if (q.level.length) where.experienceLevel = { in: q.level as any };
  if (q.category.length) where.category = { in: q.category };
  if (q.location) where.location = { contains: q.location, mode: "insensitive" };
  if (q.minSalary) where.salaryMax = { gte: q.minSalary };
  if (q.saved === "true") where.savedBy = { some: { userId: req.user!.id } };

  const [jobs, saved, applied, { candidate }] = await Promise.all([
    prisma.job.findMany({ where, orderBy: q.sort === "salary" ? { salaryMax: "desc" } : { postedAt: "desc" }, take: 500 }),
    prisma.savedJob.findMany({ where: { userId: req.user!.id }, select: { jobId: true } }),
    prisma.application.findMany({ where: { userId: req.user!.id, jobId: { not: null } }, select: { jobId: true, status: true } }),
    loadCandidate(req.user!.id),
  ]);
  const savedSet = new Set(saved.map((s) => s.jobId));
  const appMap = new Map(applied.map((a) => [a.jobId!, a.status]));
  let rows = jobs.map((j) => {
    const m = scoreJob(j, candidate);
    return { ...jobView(j), matchScore: m.score, matchedSkills: m.matchedSkills, missingSkills: m.missingSkills, isSaved: savedSet.has(j.id), applicationStatus: appMap.get(j.id) ?? null };
  });
  if (q.sort === "match") rows.sort((a, b) => b.matchScore - a.matchScore);
  const total = rows.length;
  rows = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  res.json({ jobs: rows, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) });
}));

jobRouter.get("/meta/filters", asyncHandler(async (_req, res) => {
  const cats = await prisma.job.findMany({ where: { isActive: true }, select: { category: true }, distinct: ["category"] });
  res.json({ categories: cats.map((c) => c.category).filter(Boolean).sort() });
}));

jobRouter.get("/recommendations", asyncHandler(async (req, res) => {
  const { candidate } = await loadCandidate(req.user!.id);
  const jobs = await prisma.job.findMany({ where: { isActive: true }, take: 500 });
  const top = jobs.map((j) => ({ j, m: scoreJob(j, candidate) })).sort((a, b) => b.m.score - a.m.score).slice(0, 6);
  res.json({
    hasSkills: candidate.skills.length > 0,
    jobs: top.map(({ j, m }) => ({ ...jobView(j), matchScore: m.score, matchedSkills: m.matchedSkills, missingSkills: m.missingSkills })),
  });
}));

jobRouter.get("/:id", asyncHandler(async (req, res) => {
  const job = await prisma.job.findFirst({ where: { id: String(req.params.id), isActive: true } });
  if (!job) throw notFound("Job not found");
  const [{ candidate }, saved, app] = await Promise.all([
    loadCandidate(req.user!.id),
    prisma.savedJob.findUnique({ where: { userId_jobId: { userId: req.user!.id, jobId: job.id } } }),
    prisma.application.findFirst({ where: { userId: req.user!.id, jobId: job.id } }),
  ]);
  const m = scoreJob(job, candidate);
  res.json({ job: { ...jobView(job), isSaved: !!saved, applicationId: app?.id ?? null, applicationStatus: app?.status ?? null }, match: m });
}));

// Natural-language explanation of the (deterministic) score. 503 with a clear message if AI isn't configured.
jobRouter.post("/:id/explain", asyncHandler(async (req, res) => {
  const job = await prisma.job.findFirst({ where: { id: String(req.params.id), isActive: true } });
  if (!job) throw notFound("Job not found");
  const { profile, candidate } = await loadCandidate(req.user!.id);
  const m = scoreJob(job, candidate);
  const explanation = await AIService.explainMatch({
    profile: describeCandidate(profile, candidate),
    job: { title: job.title, company: job.company, requiredSkills: job.requiredSkills },
    score: m.score, matched: m.matchedSkills, missing: m.missingSkills,
  });
  res.json({ explanation });
}));

jobRouter.post("/:id/save", asyncHandler(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: String(req.params.id) } });
  if (!job) throw notFound("Job not found");
  await prisma.savedJob.upsert({
    where: { userId_jobId: { userId: req.user!.id, jobId: job.id } }, create: { userId: req.user!.id, jobId: job.id }, update: {},
  });
  res.json({ saved: true });
}));

jobRouter.delete("/:id/save", asyncHandler(async (req, res) => {
  await prisma.savedJob.deleteMany({ where: { userId: req.user!.id, jobId: String(req.params.id) } });
  res.json({ saved: false });
}));
