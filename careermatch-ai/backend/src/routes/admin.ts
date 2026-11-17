import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { cleanList } from "../utils/skills";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const audit = (actorId: string, action: string, entity?: string, entityId?: string, meta?: object) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta as any } }).catch(() => undefined);

adminRouter.get("/stats", asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [users, newUsers, jobs, sampleJobs, resumes, applications, interviews, roadmaps, byStatus, recent] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.job.count({ where: { isActive: true } }), prisma.job.count({ where: { isSample: true } }),
    prisma.resume.count(), prisma.application.count(), prisma.interviewSession.count(), prisma.roadmap.count(),
    prisma.application.groupBy({ by: ["status"], _count: true }),
    prisma.user.findMany({ where: { createdAt: { gte: new Date(Date.now() - 14 * 86400_000) } }, select: { createdAt: true } }),
  ]);
  const signups: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) signups[new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)] = 0;
  recent.forEach((u) => { const k = u.createdAt.toISOString().slice(0, 10); if (k in signups) signups[k]++; });
  res.json({
    totals: { users, newUsers, jobs, sampleJobs, resumes, applications, interviews, roadmaps },
    applicationsByStatus: byStatus.map((b) => ({ status: b.status, count: b._count })),
    signups: Object.entries(signups).map(([date, count]) => ({ date, count })),
  });
}));

// ---------- users ----------
adminRouter.get("/users", validate(z.object({
  q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(15),
}), "query"), asyncHandler(async (req, res) => {
  const { q, page, pageSize } = (req as any).validQuery;
  const where: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }] } : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, email: true, fullName: true, role: true, isActive: true, emailVerified: true, createdAt: true, lastLoginAt: true, _count: { select: { applications: true, resumes: true } } } }),
  ]);
  res.json({ users, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}));

adminRouter.patch("/users/:id", validate(z.object({ isActive: z.boolean().optional(), role: z.enum(["USER", "ADMIN"]).optional() })), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user!.id) throw badRequest("You cannot change your own role or status");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound("User not found");
  const user = await prisma.user.update({ where: { id }, data: req.body, select: { id: true, email: true, role: true, isActive: true } });
  if (req.body.isActive === false) await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req.user!.id, "user.update", "User", id, req.body);
  res.json({ user });
}));

adminRouter.delete("/users/:id", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user!.id) throw badRequest("You cannot delete your own account");
  const r = await prisma.user.deleteMany({ where: { id } });
  if (!r.count) throw notFound("User not found");
  await audit(req.user!.id, "user.delete", "User", id);
  res.json({ ok: true });
}));

// ---------- jobs ----------
const jobSchema = z.object({
  title: z.string().trim().min(2).max(150),
  company: z.string().trim().min(1).max(120),
  location: z.string().trim().min(2).max(120),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]).default("ONSITE"),
  type: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]).default("FULL_TIME"),
  experienceLevel: z.enum(["FRESHER", "JUNIOR", "MID", "SENIOR"]).default("FRESHER"),
  description: z.string().trim().min(20).max(8000),
  requiredSkills: z.array(z.string().trim().min(1).max(60)).max(40).transform((a) => cleanList(a)),
  preferredSkills: z.array(z.string().trim().min(1).max(60)).max(40).default([]).transform((a) => cleanList(a)),
  minCgpa: z.coerce.number().min(0).max(10).optional().nullable(),
  salaryMin: z.coerce.number().int().min(0).optional().nullable(),
  salaryMax: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().trim().length(3).default("INR"),
  applyUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal("").transform(() => null)),
  category: z.string().trim().max(60).optional().nullable(),
  isActive: z.boolean().default(true),
  isSample: z.boolean().default(false),
}).refine((d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax, { message: "Minimum salary cannot exceed maximum", path: ["salaryMax"] });

adminRouter.get("/jobs", validate(z.object({
  q: z.string().trim().max(100).optional(), status: z.enum(["all", "active", "inactive"]).default("all"),
  source: z.enum(["all", "sample", "custom"]).default("all"),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(15),
}), "query"), asyncHandler(async (req, res) => {
  const { q, status, source, page, pageSize } = (req as any).validQuery;
  const where: Prisma.JobWhereInput = {};
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }];
  if (status !== "all") where.isActive = status === "active";
  if (source !== "all") where.isSample = source === "sample";
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { applications: true } } } }),
  ]);
  res.json({ jobs, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}));

adminRouter.post("/jobs", validate(jobSchema), asyncHandler(async (req, res) => {
  const job = await prisma.job.create({ data: { ...req.body, source: "ADMIN" } });
  await audit(req.user!.id, "job.create", "Job", job.id);
  res.status(201).json({ job });
}));

adminRouter.put("/jobs/:id", validate(jobSchema), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.job.findUnique({ where: { id } }))) throw notFound("Job not found");
  const job = await prisma.job.update({ where: { id }, data: req.body });
  await audit(req.user!.id, "job.update", "Job", id);
  res.json({ job });
}));

adminRouter.patch("/jobs/:id/active", validate(z.object({ isActive: z.boolean() })), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.job.findUnique({ where: { id } }))) throw notFound("Job not found");
  const job = await prisma.job.update({ where: { id }, data: { isActive: req.body.isActive } });
  await audit(req.user!.id, req.body.isActive ? "job.activate" : "job.deactivate", "Job", id);
  res.json({ job });
}));

adminRouter.delete("/jobs/:id", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const r = await prisma.job.deleteMany({ where: { id } });
  if (!r.count) throw notFound("Job not found");
  await audit(req.user!.id, "job.delete", "Job", id);
  res.json({ ok: true });
}));

adminRouter.get("/audit", asyncHandler(async (_req, res) => {
  res.json({ logs: await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) });
}));
