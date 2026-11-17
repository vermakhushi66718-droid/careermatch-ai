import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { z } from "zod";
import { extractPdfText } from "../utils/pdfText";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { badRequest, notFound } from "../lib/errors";
import { AIService, parsedResumeSchema } from "../services/ai";
import { AIUnavailableError } from "../services/ai/provider";
import { cleanList } from "../utils/skills";

export const resumeRouter = Router();
resumeRouter.use(requireAuth);

const dir = path.resolve(env.UPLOAD_DIR, "resumes");
fs.mkdirSync(dir, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

const view = (r: any, withText = false) => ({
  id: r.id, fileName: r.fileName, fileSize: r.fileSize, isPrimary: r.isPrimary, parsed: r.parsed, analysis: r.analysis,
  atsScore: r.atsScore, analysisError: r.analysisError, createdAt: r.createdAt, updatedAt: r.updatedAt,
  ...(withText ? { rawText: r.rawText } : {}),
});

async function runAnalysis(resumeId: string, rawText: string) {
  try {
    const { parsed, analysis } = await AIService.analyzeResume(rawText);
    return prisma.resume.update({
      where: { id: resumeId },
      data: { parsed: parsed as any, analysis: analysis as any, atsScore: Math.round(analysis.atsScore), analysisError: null },
    });
  } catch (e: any) {
    const msg = e instanceof AIUnavailableError ? e.message : "Analysis failed. Please try again.";
    return prisma.resume.update({ where: { id: resumeId }, data: { analysisError: msg } });
  }
}

resumeRouter.get("/", asyncHandler(async (req, res) => {
  const items = await prisma.resume.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
  res.json({ resumes: items.map((r) => view(r)), aiConfigured: AIService.isConfigured() });
}));

resumeRouter.post("/", upload.single("resume"), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest("Please choose a PDF file");
  if (file.buffer.subarray(0, 5).toString() !== "%PDF-") throw badRequest("Only valid PDF files are accepted");
  if (!/\.pdf$/i.test(file.originalname)) throw badRequest("File must have a .pdf extension");

  let text = "";
  try { text = await extractPdfText(file.buffer); }
  catch { throw badRequest("We could not read this PDF. It may be corrupted or password-protected."); }
  if (text.length < 80) throw badRequest("No readable text found. Scanned/image-only PDFs are not supported — please upload a text-based PDF.");

  const stored = `${req.user!.id}-${crypto.randomBytes(8).toString("hex")}.pdf`;
  fs.writeFileSync(path.join(dir, stored), file.buffer);
  const count = await prisma.resume.count({ where: { userId: req.user!.id } });
  const created = await prisma.resume.create({
    data: {
      userId: req.user!.id, fileName: path.basename(file.originalname).slice(0, 150), filePath: stored,
      fileSize: file.size, rawText: text.slice(0, 60000), isPrimary: count === 0,
    },
  });
  const done = await runAnalysis(created.id, created.rawText);
  res.status(201).json({ resume: view(done, true), aiConfigured: AIService.isConfigured() });
}));

async function owned(userId: string, id: string) {
  const r = await prisma.resume.findFirst({ where: { id, userId } });
  if (!r) throw notFound("Resume not found");
  return r;
}

resumeRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ resume: view(await owned(req.user!.id, String(req.params.id)), true) });
}));

resumeRouter.get("/:id/file", asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  res.download(path.join(dir, path.basename(r.filePath)), r.fileName);
}));

resumeRouter.post("/:id/analyze", asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  const done = await runAnalysis(r.id, r.rawText);
  res.json({ resume: view(done, true) });
}));

// Users can correct what the AI extracted.
resumeRouter.put("/:id/parsed", validate(parsedResumeSchema), asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  const body = { ...req.body, technicalSkills: cleanList(req.body.technicalSkills), softSkills: cleanList(req.body.softSkills) };
  const updated = await prisma.resume.update({ where: { id: r.id }, data: { parsed: body } });
  res.json({ resume: view(updated, true) });
}));

resumeRouter.post("/:id/primary", asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  await prisma.$transaction([
    prisma.resume.updateMany({ where: { userId: req.user!.id }, data: { isPrimary: false } }),
    prisma.resume.update({ where: { id: r.id }, data: { isPrimary: true } }),
  ]);
  res.json({ ok: true });
}));

// Copy extracted skills/education etc. into the profile without overwriting what the user already entered.
resumeRouter.post("/:id/apply-to-profile", asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  const p: any = r.parsed;
  if (!p) throw badRequest("This resume has not been analysed yet");
  const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
  const edu = p.education?.[0];
  const data: any = {
    technicalSkills: cleanList([...(profile?.technicalSkills ?? []), ...(p.technicalSkills ?? [])], 120),
    softSkills: cleanList([...(profile?.softSkills ?? []), ...(p.softSkills ?? [])], 60),
  };
  if (!profile?.summary && p.summary) data.summary = String(p.summary).slice(0, 1500);
  if (!profile?.phone && p.phone) data.phone = String(p.phone).slice(0, 20);
  if (!profile?.degree && edu?.degree) data.degree = edu.degree.slice(0, 100);
  if (!profile?.college && edu?.institution) data.college = edu.institution.slice(0, 150);
  if ((profile?.projects as any[] | undefined)?.length === 0 && p.projects?.length) data.projects = p.projects;
  if ((profile?.certifications as any[] | undefined)?.length === 0 && p.certifications?.length) data.certifications = p.certifications;
  await prisma.profile.update({ where: { userId: req.user!.id }, data });
  res.json({ ok: true, added: { technicalSkills: data.technicalSkills.length, softSkills: data.softSkills.length } });
}));

resumeRouter.post("/:id/improve", validate(z.object({ targetRole: z.string().trim().max(100).optional() })),
  asyncHandler(async (req, res) => {
    const r = await owned(req.user!.id, String(req.params.id));
    const result = await AIService.improveResume({ rawText: r.rawText, targetRole: req.body.targetRole });
    const saved = await prisma.resumeImprovement.create({ data: { resumeId: r.id, targetRole: req.body.targetRole, result: result as any } });
    res.json({ improvement: { id: saved.id, targetRole: saved.targetRole, createdAt: saved.createdAt, ...result } });
  }));

resumeRouter.get("/:id/improvements", asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  const items = await prisma.resumeImprovement.findMany({ where: { resumeId: r.id }, orderBy: { createdAt: "desc" }, take: 10 });
  res.json({ improvements: items.map((i) => ({ id: i.id, targetRole: i.targetRole, createdAt: i.createdAt, ...(i.result as object) })) });
}));

resumeRouter.delete("/:id", asyncHandler(async (req, res) => {
  const r = await owned(req.user!.id, String(req.params.id));
  await prisma.resume.delete({ where: { id: r.id } });
  fs.rmSync(path.join(dir, path.basename(r.filePath)), { force: true });
  if (r.isPrimary) {
    const next = await prisma.resume.findFirst({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
    if (next) await prisma.resume.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  res.json({ ok: true });
}));
