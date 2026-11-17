import type { Job } from "@prisma/client";
import { normSkill, normSkills } from "../utils/skills";

export interface CandidateProfile {
  skills: string[];
  preferredRoles: string[];
  preferredLocations: string[];
  careerInterests: string[];
  cgpa?: number | null;
  experienceMonths: number;
  expectedSalary?: number | null;
}

export interface MatchResult {
  score: number;
  breakdown: { skills: number; role: number; location: number; level: number; education: number };
  weights: { skills: number; role: number; location: number; level: number; education: number };
  matchedSkills: string[];
  missingSkills: string[];
  matchedPreferred: string[];
  reasons: string[];
}

const W = { skills: 55, role: 15, location: 10, level: 10, education: 10 };

const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length > 2);

function levelFit(level: Job["experienceLevel"], months: number): number {
  const years = months / 12;
  const need = { FRESHER: 0, JUNIOR: 1, MID: 3, SENIOR: 6 }[level];
  if (years >= need) return level === "FRESHER" || years - need < 4 ? 1 : 0.7;
  const gap = need - years;
  return Math.max(0, 1 - gap / 3);
}

/** Deterministic, explainable compatibility score (0-100). The LLM only narrates this result; it never decides it. */
export function scoreJob(job: Job, c: CandidateProfile): MatchResult {
  const have = new Set(normSkills(c.skills));
  const req = normSkills(job.requiredSkills);
  const pref = normSkills(job.preferredSkills);

  // Compare on normalised names, but report skills with the job's own spelling (e.g. "REST APIs", not "rest apis").
  const display = new Map<string, string>();
  [...job.requiredSkills, ...job.preferredSkills].forEach((s) => { if (!display.has(normSkill(s))) display.set(normSkill(s), s.trim()); });
  const show = (k: string) => display.get(k) ?? k;
  const matchedSkills = req.filter((s) => have.has(s));
  const missingSkills = req.filter((s) => !have.has(s));
  const matchedPreferred = pref.filter((s) => have.has(s));
  const reqCov = req.length ? matchedSkills.length / req.length : 1;
  const prefCov = pref.length ? matchedPreferred.length / pref.length : 0;
  // 45 of the 55 skill points for required skills, 10 for nice-to-haves.
  const skillsPts = (req.length ? reqCov * 45 : 45) + prefCov * 10;

  let rolePts = 0;
  const jobTokens = new Set(tokens(`${job.title} ${job.category ?? ""}`));
  const wanted = [...c.preferredRoles, ...c.careerInterests];
  if (wanted.length) {
    const best = Math.max(...wanted.map((r) => {
      const t = tokens(r);
      if (!t.length) return 0;
      return t.filter((x) => jobTokens.has(x)).length / t.length;
    }));
    rolePts = best * W.role;
  } else rolePts = W.role * 0.5;

  let locPts = 0;
  if (job.workMode === "REMOTE") locPts = W.location;
  else if (!c.preferredLocations.length) locPts = W.location * 0.5;
  else {
    const jl = job.location.toLowerCase();
    locPts = c.preferredLocations.some((l) => jl.includes(l.toLowerCase()) || l.toLowerCase().includes(jl.split(",")[0])) ? W.location : 0;
  }

  const levelPts = levelFit(job.experienceLevel, c.experienceMonths) * W.level;

  let eduPts = W.education;
  if (job.minCgpa != null) eduPts = c.cgpa == null ? W.education * 0.5 : c.cgpa >= job.minCgpa ? W.education : Math.max(0, W.education * (1 - (job.minCgpa - c.cgpa) / 2));

  const breakdown = {
    skills: Math.round(skillsPts), role: Math.round(rolePts), location: Math.round(locPts),
    level: Math.round(levelPts), education: Math.round(eduPts),
  };
  const score = Math.max(0, Math.min(100, Math.round(skillsPts + rolePts + locPts + levelPts + eduPts)));

  const reasons: string[] = [];
  if (req.length) reasons.push(`You have ${matchedSkills.length} of ${req.length} required skills.`);
  if (matchedPreferred.length) reasons.push(`You also match ${matchedPreferred.length} preferred skill(s).`);
  if (rolePts >= W.role * 0.6) reasons.push("The role aligns with your preferred roles/interests.");
  if (job.workMode === "REMOTE") reasons.push("This role is remote.");
  else if (locPts === W.location) reasons.push("The location matches your preferences.");
  if (job.minCgpa != null && c.cgpa != null && c.cgpa < job.minCgpa) reasons.push(`Minimum CGPA is ${job.minCgpa}; yours is ${c.cgpa}.`);

  return { score, breakdown, weights: W, matchedSkills: matchedSkills.map(show), missingSkills: missingSkills.map(show), matchedPreferred: matchedPreferred.map(show), reasons };
}

export { normSkill };
