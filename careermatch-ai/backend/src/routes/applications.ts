import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { conflict, notFound } from "../lib/errors";

export const applicationRouter = Router();
applicationRouter.use(requireAuth);

const STATUSES = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"] as const;
const date = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable()
  .transform((v) => (v ? new Date(v) : v === null ? null : undefined));

const base = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(150),
  location: z.string().trim().max(120).optional().nullable(),
  status: z.enum(STATUSES).default("SAVED"),
  appliedAt: date, followUpAt: date,
  notes: z.string().trim().max(3000).optional().nullable(),
  url: z.string().trim().url().max(500).optional().nullable().or(z.literal("").transform(() => null)),
  jobId: z.string().optional().nullable(),
});

applicationRouter.get("/", asyncHandler(async (req, res) => {
  const apps = await prisma.application.findMany({ where: { userId: req.user!.id }, orderBy: { updatedAt: "desc" } });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, apps.filter((a) => a.status === s).length]));
  res.json({ applications: apps, counts });
}));

applicationRouter.post("/", validate(base), asyncHandler(async (req, res) => {
  const d = req.body;
  if (d.jobId) {
    const job = await prisma.job.findUnique({ where: { id: d.jobId } });
    if (!job) throw notFound("Job not found");
    if (await prisma.application.findFirst({ where: { userId: req.user!.id, jobId: d.jobId } })) throw conflict("You are already tracking this job");
  }
  if (d.status === "APPLIED" && !d.appliedAt) d.appliedAt = new Date();
  const created = await prisma.application.create({ data: { ...d, userId: req.user!.id } });
  res.status(201).json({ application: created });
}));

// Quick-add straight from a job listing.
applicationRouter.post("/from-job/:jobId", validate(z.object({ status: z.enum(STATUSES).default("SAVED") })), asyncHandler(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: String(req.params.jobId) } });
  if (!job) throw notFound("Job not found");
  if (await prisma.application.findFirst({ where: { userId: req.user!.id, jobId: job.id } })) throw conflict("You are already tracking this job");
  const created = await prisma.application.create({
    data: {
      userId: req.user!.id, jobId: job.id, company: job.company, title: job.title, location: job.location,
      status: req.body.status, url: job.applyUrl, appliedAt: req.body.status === "APPLIED" ? new Date() : null,
    },
  });
  res.status(201).json({ application: created });
}));

applicationRouter.put("/:id", validate(base.partial()), asyncHandler(async (req, res) => {
  const existing = await prisma.application.findFirst({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!existing) throw notFound("Application not found");
  const { jobId: _ignored, ...d } = req.body;
  if (d.status === "APPLIED" && !existing.appliedAt && d.appliedAt === undefined) d.appliedAt = new Date();
  const updated = await prisma.application.update({ where: { id: existing.id }, data: d });
  res.json({ application: updated });
}));

applicationRouter.delete("/:id", asyncHandler(async (req, res) => {
  const r = await prisma.application.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!r.count) throw notFound("Application not found");
  res.json({ ok: true });
}));
