import { prisma } from "../lib/prisma";
import { CandidateProfile } from "./matching";
import { cleanList } from "../utils/skills";

function monthsFrom(items: any[]): number {
  let total = 0;
  for (const it of items ?? []) {
    if (typeof it?.months === "number") total += it.months;
    else if (it?.startDate) {
      const s = new Date(it.startDate).getTime();
      const e = it.endDate ? new Date(it.endDate).getTime() : Date.now();
      if (!isNaN(s) && !isNaN(e) && e > s) total += (e - s) / (30.4 * 86400_000);
    }
  }
  return Math.round(total);
}

/** Merges profile + the primary resume's extracted skills into one candidate view. */
export async function loadCandidate(userId: string) {
  const [profile, resume] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.resume.findFirst({ where: { userId, isPrimary: true } }),
  ]);
  const parsed: any = resume?.parsed ?? {};
  const skills = cleanList([...(profile?.technicalSkills ?? []), ...(parsed.technicalSkills ?? [])], 120);
  const candidate: CandidateProfile = {
    skills,
    preferredRoles: profile?.preferredRoles ?? [],
    preferredLocations: profile?.preferredLocations ?? [],
    careerInterests: profile?.careerInterests ?? [],
    cgpa: profile?.cgpa,
    experienceMonths: monthsFrom(profile?.workExperience as any[]) + Math.round(monthsFrom(profile?.internships as any[]) * 0.5),
    expectedSalary: profile?.expectedSalary,
  };
  return { profile, resume, candidate };
}

export function describeCandidate(profile: any, candidate: CandidateProfile): string {
  return [
    profile?.degree ? `Education: ${profile.degree}${profile.fieldOfStudy ? " in " + profile.fieldOfStudy : ""}${profile.college ? ", " + profile.college : ""}${profile.graduationYear ? " (" + profile.graduationYear + ")" : ""}` : "",
    `Skills: ${candidate.skills.join(", ") || "none listed"}`,
    candidate.preferredRoles.length ? `Preferred roles: ${candidate.preferredRoles.join(", ")}` : "",
    candidate.preferredLocations.length ? `Preferred locations: ${candidate.preferredLocations.join(", ")}` : "",
    candidate.careerInterests.length ? `Interests: ${candidate.careerInterests.join(", ")}` : "",
    `Experience: ~${Math.round(candidate.experienceMonths / 12 * 10) / 10} years`,
  ].filter(Boolean).join("\n");
}
