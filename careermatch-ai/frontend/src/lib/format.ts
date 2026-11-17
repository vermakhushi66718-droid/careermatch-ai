import type { Job } from "./types";
export const TYPE_LABEL: Record<string, string> = { FULL_TIME: "Full-time", PART_TIME: "Part-time", INTERNSHIP: "Internship", CONTRACT: "Contract" };
export const MODE_LABEL: Record<string, string> = { ONSITE: "On-site", REMOTE: "Remote", HYBRID: "Hybrid" };
export const LEVEL_LABEL: Record<string, string> = { FRESHER: "Fresher", JUNIOR: "Junior", MID: "Mid-level", SENIOR: "Senior" };
export const STATUS_LABEL: Record<string, string> = { SAVED: "Saved", APPLIED: "Applied", INTERVIEWING: "Interviewing", OFFER: "Offer", REJECTED: "Rejected", WITHDRAWN: "Withdrawn" };

const lakh = (n: number) => (n >= 100000 ? `${+(n / 100000).toFixed(1)}L` : n >= 1000 ? `${+(n / 1000).toFixed(0)}K` : `${n}`);
export function salary(j: Pick<Job, "salaryMin" | "salaryMax" | "currency" | "type">) {
  if (!j.salaryMin && !j.salaryMax) return "Not disclosed";
  const sym = j.currency === "INR" ? "₹" : j.currency + " ";
  const range = j.salaryMin && j.salaryMax ? `${sym}${lakh(j.salaryMin)} – ${lakh(j.salaryMax)}` : `${sym}${lakh((j.salaryMin ?? j.salaryMax)!)}`;
  return j.type === "INTERNSHIP" ? `${range} / month` : `${range} / year`;
}
export const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const ago = (s: string) => {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
export const scoreTone = (n: number) => (n >= 75 ? "good" : n >= 50 ? "brand" : n >= 30 ? "warn" : "bad") as "good" | "brand" | "warn" | "bad";
