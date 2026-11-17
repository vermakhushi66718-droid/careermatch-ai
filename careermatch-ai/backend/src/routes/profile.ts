import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { badRequest, forbidden } from "../lib/errors";
import { cleanList } from "../utils/skills";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const list = z.array(z.string().trim().min(1).max(80)).max(60).default([]).transform((a) => cleanList(a));
const entry = z.object({}).passthrough();

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).regex(/^[+\d\s()-]*$/, "Invalid phone number").optional().nullable(),
  headline: z.string().trim().max(150).optional().nullable(),
  summary: z.string().trim().max(1500).optional().nullable(),
  college: z.string().trim().max(150).optional().nullable(),
  degree: z.string().trim().max(100).optional().nullable(),
  fieldOfStudy: z.string().trim().max(100).optional().nullable(),
  graduationYear: z.coerce.number().int().min(1990).max(2040).optional().nullable(),
  cgpa: z.coerce.number().min(0).max(10).optional().nullable(),
  technicalSkills: list.optional(),
  softSkills: list.optional(),
  certifications: z.array(entry).max(30).optional(),
  projects: z.array(entry).max(30).optional(),
  internships: z.array(entry).max(30).optional(),
  workExperience: z.array(entry).max(30).optional(),
  preferredRoles: list.optional(),
  preferredLocations: list.optional(),
  expectedSalary: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  careerInterests: list.optional(),
  completeOnboarding: z.boolean().optional(),
});

const shape = (user: any, profile: any) => ({
  fullName: user.fullName, email: user.email, onboardingComplete: user.onboardingComplete, emailVerified: user.emailVerified,
  ...profile, photoUrl: profile?.photoPath ? `/api/profile/photo/${user.id}?v=${new Date(profile.updatedAt).getTime()}` : null,
});

profileRouter.get("/", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { profile: true } });
  res.json({ profile: shape(user, user.profile) });
}));

profileRouter.put("/", validate(profileSchema), asyncHandler(async (req, res) => {
  const { fullName, completeOnboarding, ...data } = req.body;
  const clean: any = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) clean[k] = v;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(fullName ? { fullName } : {}),
      ...(completeOnboarding ? { onboardingComplete: true } : {}),
      profile: { upsert: { create: clean, update: clean } },
    },
    include: { profile: true },
  });
  res.json({ profile: shape(user, user.profile) });
}));

// ---- profile photo ----
const photoDir = path.resolve(env.UPLOAD_DIR, "photos");
fs.mkdirSync(photoDir, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

function sniffImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

profileRouter.post("/photo", upload.single("photo"), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest("Please choose an image file");
  const ext = sniffImage(req.file.buffer);
  if (!ext) throw badRequest("Only JPG, PNG or WebP images are allowed");
  const name = `${req.user!.id}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const existing = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
  fs.writeFileSync(path.join(photoDir, name), req.file.buffer);
  if (existing?.photoPath) fs.rmSync(path.join(photoDir, path.basename(existing.photoPath)), { force: true });
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { profile: { upsert: { create: { photoPath: name }, update: { photoPath: name } } } },
    include: { profile: true },
  });
  res.json({ profile: shape(user, user.profile) });
}));

profileRouter.delete("/photo", asyncHandler(async (req, res) => {
  const p = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
  if (p?.photoPath) fs.rmSync(path.join(photoDir, path.basename(p.photoPath)), { force: true });
  await prisma.profile.update({ where: { userId: req.user!.id }, data: { photoPath: null } });
  res.json({ ok: true });
}));

// Photos are served to authenticated users only; owner or admin.
profileRouter.get("/photo/:userId", asyncHandler(async (req, res) => {
  const targetId = String(req.params.userId);
  if (targetId !== req.user!.id && req.user!.role !== "ADMIN") throw forbidden();
  const p = await prisma.profile.findUnique({ where: { userId: targetId } });
  if (!p?.photoPath) return res.status(404).json({ error: { code: "NOT_FOUND", message: "No photo" } });
  res.sendFile(path.join(photoDir, path.basename(p.photoPath)));
}));
