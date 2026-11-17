export type Role = "USER" | "ADMIN";
export interface User { id: string; email: string; fullName: string; role: Role; emailVerified: boolean; onboardingComplete: boolean; }
export type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
export type WorkMode = "ONSITE" | "REMOTE" | "HYBRID";
export type Level = "FRESHER" | "JUNIOR" | "MID" | "SENIOR";
export type AppStatus = "SAVED" | "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN";

export interface Job {
  id: string; title: string; company: string; location: string; workMode: WorkMode; type: JobType; experienceLevel: Level;
  description: string; requiredSkills: string[]; preferredSkills: string[]; minCgpa: number | null; salaryMin: number | null;
  salaryMax: number | null; currency: string; applyUrl: string | null; category: string | null; postedAt: string; isSample: boolean; source: string;
  matchScore?: number; matchedSkills?: string[]; missingSkills?: string[]; isSaved?: boolean; applicationStatus?: AppStatus | null; applicationId?: string | null;
  isActive?: boolean;
}
export interface Match {
  score: number; matchedSkills: string[]; missingSkills: string[]; matchedPreferred: string[]; reasons: string[];
  breakdown: { skills: number; role: number; location: number; level: number; education: number };
  weights: { skills: number; role: number; location: number; level: number; education: number };
}
export interface Profile {
  fullName: string; email: string; onboardingComplete: boolean; emailVerified: boolean; photoUrl: string | null;
  phone: string | null; headline: string | null; summary: string | null; college: string | null; degree: string | null; fieldOfStudy: string | null;
  graduationYear: number | null; cgpa: number | null; technicalSkills: string[]; softSkills: string[];
  certifications: any[]; projects: any[]; internships: any[]; workExperience: any[];
  preferredRoles: string[]; preferredLocations: string[]; expectedSalary: number | null; careerInterests: string[];
}
export interface ParsedResume {
  name: string; email: string; phone: string; location: string; summary: string;
  education: { degree: string; institution: string; year: string; grade: string }[];
  technicalSkills: string[]; softSkills: string[];
  experience: { role: string; company: string; duration: string; description: string }[];
  projects: { name: string; description: string; technologies: string[] }[];
  certifications: { name: string; issuer: string; year: string }[];
}
export interface Resume {
  id: string; fileName: string; fileSize: number; isPrimary: boolean; parsed: ParsedResume | null;
  analysis: { atsScore: number; strengths: string[]; weaknesses: string[]; suggestions: string[]; missingSections: string[] } | null;
  atsScore: number | null; analysisError: string | null; createdAt: string; rawText?: string;
}
export interface Application {
  id: string; jobId: string | null; company: string; title: string; location: string | null; status: AppStatus;
  appliedAt: string | null; followUpAt: string | null; notes: string | null; url: string | null; updatedAt: string;
}
export interface RoadmapItem { id: string; order: number; skill: string; title: string; description: string; resources: { title: string; type: string }[]; estimatedWeeks: number; completed: boolean; }
export interface Roadmap { id: string; title: string; targetRole: string; missingSkills: string[]; createdAt: string; items: RoadmapItem[]; progress: { total: number; done: number; percent: number }; }
export interface InterviewQuestion { id: string; order: number; category: string; question: string; answer: string | null; score: number | null; feedback: { score: number; strengths: string[]; improvements: string[]; sampleAnswer: string } | null; answeredAt: string | null; }
export interface InterviewSession {
  id: string; targetRole: string; difficulty: string; status: "IN_PROGRESS" | "COMPLETED"; overallScore: number | null;
  summary: { summary: string; strengths: string[]; weaknesses: string[]; nextSteps: string[] } | null; questions: InterviewQuestion[]; createdAt: string;
}
export interface Paged<T> { total: number; page: number; pageSize: number; totalPages: number; items?: T[]; }
