import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { loadCandidate } from "../services/candidate";
import { scoreJob } from "../services/matching";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", asyncHandler(async (req, res) => {
  const uid = req.user!.id;
  const { profile, resume, candidate } = await loadCandidate(uid);
  const [apps, roadmaps, interviews, jobs, savedCount] = await Promise.all([
    prisma.application.findMany({ where: { userId: uid }, select: { status: true, followUpAt: true, company: true, title: true, id: true } }),
    prisma.roadmap.findMany({ where: { userId: uid }, include: { items: { select: { completed: true } } } }),
    prisma.interviewSession.findMany({ where: { userId: uid, status: "COMPLETED" }, orderBy: { completedAt: "asc" }, select: { overallScore: true, completedAt: true, targetRole: true } }),
    prisma.job.findMany({ where: { isActive: true }, take: 500 }),
    prisma.savedJob.count({ where: { userId: uid } }),
  ]);

  const scored = jobs.map((j) => scoreJob(j, candidate));
  const avgTop = scored.length ? Math.round(scored.map((s) => s.score).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(5, scored.length)) : 0;
  const gapCount = new Map<string, number>();
  scored.sort((a, b) => b.score - a.score).slice(0, 25).forEach((s) => s.missingSkills.forEach((m) => gapCount.set(m, (gapCount.get(m) ?? 0) + 1)));
  const topGaps = [...gapCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([skill, jobs]) => ({ skill, jobs }));

  const p: any = profile ?? {};
  const checks = [
    !!p.headline || !!p.summary, !!p.college && !!p.degree, !!p.graduationYear, (p.technicalSkills?.length ?? 0) >= 3,
    (p.softSkills?.length ?? 0) >= 1, (p.projects?.length ?? 0) >= 1, (p.preferredRoles?.length ?? 0) >= 1, (p.preferredLocations?.length ?? 0) >= 1, !!resume,
  ];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const statusCounts: Record<string, number> = {};
  apps.forEach((a) => { statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1; });
  const upcoming = apps.filter((a) => a.followUpAt && a.followUpAt >= new Date(Date.now() - 86400_000))
    .sort((a, b) => a.followUpAt!.getTime() - b.followUpAt!.getTime()).slice(0, 5);

  res.json({
    profileCompleteness: completeness,
    atsScore: resume?.atsScore ?? null,
    hasResume: !!resume,
    skillCount: candidate.skills.length,
    avgTopMatch: avgTop,
    savedJobs: savedCount,
    applications: { total: apps.length, byStatus: statusCounts },
    upcomingFollowUps: upcoming,
    roadmaps: roadmaps.map((r) => ({ id: r.id, title: r.title, percent: r.items.length ? Math.round(r.items.filter((i) => i.completed).length / r.items.length * 100) : 0 })).slice(0, 4),
    interviewTrend: interviews.map((i) => ({ date: i.completedAt, score: i.overallScore, role: i.targetRole })),
    topSkillGaps: topGaps,
  });
}));
