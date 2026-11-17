import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "node:path";
import { app, registerUser, createAdmin, auth, uniq } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { setProvider } from "../src/services/ai/registry";
import { FakeProvider } from "./fakeAI";

const fake = new FakeProvider();
let u: Awaited<ReturnType<typeof registerUser>>;
let other: Awaited<ReturnType<typeof registerUser>>;
let admin: Awaited<ReturnType<typeof createAdmin>>;
let jobId: string;

beforeAll(async () => {
  u = await registerUser("mod"); other = await registerUser("other"); admin = await createAdmin();
  const count = await prisma.job.count();
  if (count === 0) throw new Error("Run `npm run seed` before the test suite");
  jobId = (await prisma.job.findFirstOrThrow({ where: { title: "Full Stack Developer" } })).id;
});
afterAll(async () => {
  setProvider(null);
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
  await prisma.job.deleteMany({ where: { source: "ADMIN", company: "TestCo" } });
  await prisma.$disconnect();
});

describe("profile", () => {
  it("requires auth", async () => { expect((await request(app).get("/api/profile")).status).toBe(401); });
  it("updates profile, normalises lists, completes onboarding", async () => {
    const r = await request(app).put("/api/profile").set(auth(u.token)).send({
      fullName: "Aarav Sharma", college: "SPPU", degree: "BCA", graduationYear: 2026, cgpa: 8.1,
      technicalSkills: ["JavaScript", " javascript ", "React", "Node.js", "PostgreSQL"], preferredRoles: ["Full Stack Developer"],
      preferredLocations: ["Pune"], projects: [{ name: "Expense Tracker" }], completeOnboarding: true,
    });
    expect(r.status).toBe(200);
    expect(r.body.profile.technicalSkills).toEqual(["JavaScript", "React", "Node.js", "PostgreSQL"]);
    expect(r.body.profile.onboardingComplete).toBe(true);
    expect((await request(app).get("/api/profile").set(auth(u.token))).body.profile.fullName).toBe("Aarav Sharma");
  });
  it("validates input", async () => {
    const r = await request(app).put("/api/profile").set(auth(u.token)).send({ cgpa: 14, graduationYear: 1800, phone: "abc" });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.details)).toEqual(expect.arrayContaining(["cgpa", "graduationYear", "phone"]));
  });
  it("rejects non-image photo uploads and accepts a real PNG", async () => {
    const bad = await request(app).post("/api/profile/photo").set(auth(u.token)).attach("photo", Buffer.from("not an image"), "x.png");
    expect(bad.status).toBe(400);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const ok = await request(app).post("/api/profile/photo").set(auth(u.token)).attach("photo", png, "me.png");
    expect(ok.status).toBe(200);
    expect(ok.body.profile.photoUrl).toBeTruthy();
    expect((await request(app).get(`/api/profile/photo/${u.id}`).set(auth(u.token))).status).toBe(200);
    expect((await request(app).get(`/api/profile/photo/${u.id}`).set(auth(other.token))).status).toBe(403);
  });
});

describe("resume analyzer", () => {
  const pdf = path.join(__dirname, "fixtures/resume.pdf");
  it("rejects non-PDF content even with a .pdf name, and missing file", async () => {
    expect((await request(app).post("/api/resumes").set(auth(u.token)).attach("resume", Buffer.from("hello world"), "fake.pdf")).status).toBe(400);
    expect((await request(app).post("/api/resumes").set(auth(u.token))).status).toBe(400);
  });
  it("uploads and stores text but reports a clear message when AI is not configured", async () => {
    setProvider(null); // real provider, no API key
    const r = await request(app).post("/api/resumes").set(auth(other.token)).attach("resume", pdf);
    expect(r.status).toBe(201);
    expect(r.body.resume.rawText).toContain("Aarav Sharma");
    expect(r.body.resume.parsed).toBeNull();
    expect(r.body.resume.analysisError).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.body.aiConfigured).toBe(false);
  });
  it("analyzes with the AI provider, lets the user edit extracted data and apply it to the profile", async () => {
    setProvider(fake);
    const up = await request(app).post("/api/resumes").set(auth(u.token)).attach("resume", pdf);
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const id = up.body.resume.id;
    expect(up.body.resume.isPrimary).toBe(true);
    expect(up.body.resume.atsScore).toBe(72);
    expect(up.body.resume.parsed.technicalSkills).toContain("React");
    const parsed = { ...up.body.resume.parsed, technicalSkills: [...up.body.resume.parsed.technicalSkills, "Docker"] };
    const ed = await request(app).put(`/api/resumes/${id}/parsed`).set(auth(u.token)).send(parsed);
    expect(ed.body.resume.parsed.technicalSkills).toContain("Docker");
    const ap = await request(app).post(`/api/resumes/${id}/apply-to-profile`).set(auth(u.token));
    expect(ap.status).toBe(200);
    expect((await request(app).get("/api/profile").set(auth(u.token))).body.profile.technicalSkills).toContain("Docker");
    const imp = await request(app).post(`/api/resumes/${id}/improve`).set(auth(u.token)).send({ targetRole: "Full Stack Developer" });
    expect(imp.status).toBe(200);
    expect(imp.body.improvement.improvedBullets).toHaveLength(1);
    expect((await request(app).get(`/api/resumes/${id}/improvements`).set(auth(u.token))).body.improvements).toHaveLength(1);
  });
  it("isolates resumes between users", async () => {
    const mine = (await request(app).get("/api/resumes").set(auth(u.token))).body.resumes[0];
    expect((await request(app).get(`/api/resumes/${mine.id}`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/resumes/${mine.id}`).set(auth(other.token))).status).toBe(404);
  });
  it("prompt-injection text inside a resume reaches the model only as delimited data", async () => {
    const before = fake.calls.length;
    const r = (await request(app).get("/api/resumes").set(auth(u.token))).body.resumes[0];
    await request(app).post(`/api/resumes/${r.id}/analyze`).set(auth(u.token));
    const call = fake.calls[before];
    expect(call.system).toMatch(/untrusted user data/);
    expect(call.messages[0].content.startsWith("<resume>")).toBe(true);
  });
});

describe("jobs and matching", () => {
  it("lists seeded jobs with scores, sorted by match, flags sample data", async () => {
    const r = await request(app).get("/api/jobs?pageSize=50").set(auth(u.token));
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(30);
    const scores = r.body.jobs.map((j: any) => j.matchScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(r.body.jobs.every((j: any) => j.isSample === true)).toBe(true);
    expect(r.body.jobs[0].matchedSkills.length).toBeGreaterThan(0);
  });
  it("applies filters and search", async () => {
    const intern = await request(app).get("/api/jobs?type=INTERNSHIP&pageSize=50").set(auth(u.token));
    expect(intern.body.jobs.length).toBeGreaterThan(0);
    expect(intern.body.jobs.every((j: any) => j.type === "INTERNSHIP")).toBe(true);
    const remote = await request(app).get("/api/jobs?mode=REMOTE&pageSize=50").set(auth(u.token));
    expect(remote.body.jobs.every((j: any) => j.workMode === "REMOTE")).toBe(true);
    const q = await request(app).get("/api/jobs?q=flutter").set(auth(u.token));
    expect(q.body.jobs.some((j: any) => /Flutter/.test(j.title))).toBe(true);
    expect((await request(app).get("/api/jobs?type=BOGUS").set(auth(u.token))).status).toBe(400);
  });
  it("gives an explainable breakdown that sums to the score", async () => {
    const r = await request(app).get(`/api/jobs/${jobId}`).set(auth(u.token));
    const b = r.body.match.breakdown;
    const sum = b.skills + b.role + b.location + b.level + b.education;
    expect(Math.abs(sum - r.body.match.score)).toBeLessThanOrEqual(2);
    expect(r.body.match.missingSkills).toEqual(expect.arrayContaining(["REST APIs"]));
  });
  it("recommends jobs and explains a match with the AI", async () => {
    const rec = await request(app).get("/api/jobs/recommendations").set(auth(u.token));
    expect(rec.body.jobs).toHaveLength(6);
    const ex = await request(app).post(`/api/jobs/${jobId}/explain`).set(auth(u.token));
    expect(ex.body.explanation.summary).toBe("Good fit.");
  });
  it("saves and unsaves jobs", async () => {
    expect((await request(app).post(`/api/jobs/${jobId}/save`).set(auth(u.token))).body.saved).toBe(true);
    expect((await request(app).get("/api/jobs?saved=true").set(auth(u.token))).body.total).toBe(1);
    await request(app).delete(`/api/jobs/${jobId}/save`).set(auth(u.token));
    expect((await request(app).get("/api/jobs?saved=true").set(auth(u.token))).body.total).toBe(0);
  });
  it("returns 503 with a clear message from AI endpoints when the key is missing", async () => {
    setProvider(null);
    const r = await request(app).post(`/api/jobs/${jobId}/explain`).set(auth(u.token));
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("AI_NOT_CONFIGURED");
    setProvider(fake);
  });
});

describe("application tracker", () => {
  let appId: string;
  it("creates from a job, prevents duplicates, updates status, edits and deletes", async () => {
    const c = await request(app).post(`/api/applications/from-job/${jobId}`).set(auth(u.token)).send({});
    expect(c.status).toBe(201); appId = c.body.application.id;
    expect((await request(app).post(`/api/applications/from-job/${jobId}`).set(auth(u.token)).send({})).status).toBe(409);
    const up = await request(app).put(`/api/applications/${appId}`).set(auth(u.token)).send({ status: "APPLIED", notes: "Referred by alumni", followUpAt: "2026-12-01" });
    expect(up.body.application.status).toBe("APPLIED");
    expect(up.body.application.appliedAt).toBeTruthy();
    const manual = await request(app).post("/api/applications").set(auth(u.token)).send({ company: "Other Co", title: "Dev", status: "INTERVIEWING", url: "" });
    expect(manual.status).toBe(201);
    const list = await request(app).get("/api/applications").set(auth(u.token));
    expect(list.body.counts.APPLIED).toBe(1); expect(list.body.counts.INTERVIEWING).toBe(1);
    expect((await request(app).put(`/api/applications/${appId}`).set(auth(other.token)).send({ status: "OFFER" })).status).toBe(404);
    expect((await request(app).post("/api/applications").set(auth(u.token)).send({ company: "", title: "x" })).status).toBe(400);
    expect((await request(app).delete(`/api/applications/${appId}`).set(auth(u.token))).status).toBe(200);
  });
});

describe("roadmaps", () => {
  it("generates a roadmap from a job's skill gap, tracks progress, adds skill to profile", async () => {
    const gap = await request(app).get(`/api/roadmaps/skill-gap/${jobId}`).set(auth(u.token));
    expect(gap.body.missing.length).toBeGreaterThan(0);
    const g = await request(app).post("/api/roadmaps/generate").set(auth(u.token)).send({ jobId });
    expect(g.status).toBe(201);
    const rm = g.body.roadmap;
    expect(rm.items).toHaveLength(2);
    const t = await request(app).patch(`/api/roadmaps/${rm.id}/items/${rm.items[0].id}`).set(auth(u.token)).send({ completed: true });
    expect(t.body.roadmap.progress.percent).toBe(50);
    expect((await request(app).post(`/api/roadmaps/${rm.id}/items/${rm.items[0].id}/add-skill`).set(auth(u.token))).status).toBe(200);
    expect((await request(app).get("/api/profile").set(auth(u.token))).body.profile.technicalSkills).toContain("TypeScript");
    expect((await request(app).patch(`/api/roadmaps/${rm.id}/items/${rm.items[0].id}`).set(auth(other.token)).send({ completed: false })).status).toBe(404);
    expect((await request(app).post("/api/roadmaps/generate").set(auth(u.token)).send({})).status).toBe(400);
  });
});

describe("mock interviews", () => {
  it("runs a full interview: generate, answer, complete, summary", async () => {
    const s = await request(app).post("/api/interviews").set(auth(u.token)).send({ targetRole: "Full Stack Developer", difficulty: "medium", count: 3 });
    expect(s.status).toBe(201);
    const { id, questions } = s.body.session;
    expect(questions).toHaveLength(3);
    expect((await request(app).post(`/api/interviews/${id}/complete`).set(auth(u.token))).status).toBe(400);
    expect((await request(app).post(`/api/interviews/${id}/questions/${questions[0].id}/answer`).set(auth(u.token)).send({ answer: "short" })).status).toBe(400);
    const a = await request(app).post(`/api/interviews/${id}/questions/${questions[0].id}/answer`).set(auth(u.token)).send({ answer: "The event loop processes callbacks from the queue when the stack is empty." });
    expect(a.body.question.score).toBe(7);
    expect((await request(app).post(`/api/interviews/${id}/questions/${questions[0].id}/answer`).set(auth(u.token)).send({ answer: "Answering again for the same question." })).status).toBe(400);
    const done = await request(app).post(`/api/interviews/${id}/complete`).set(auth(u.token));
    expect(done.body.session.status).toBe("COMPLETED");
    expect(done.body.session.overallScore).toBe(74);
    expect((await request(app).get(`/api/interviews/${id}`).set(auth(other.token))).status).toBe(404);
  });
});

describe("career assistant", () => {
  it("stores conversation and responds; nothing is stored when AI fails", async () => {
    const r = await request(app).post("/api/assistant/messages").set(auth(u.token)).send({ content: "What should I learn next?" });
    expect(r.status).toBe(201);
    expect(r.body.messages[1].content).toContain("TypeScript");
    expect((await request(app).get("/api/assistant/messages").set(auth(u.token))).body.messages).toHaveLength(2);
    setProvider(null);
    expect((await request(app).post("/api/assistant/messages").set(auth(u.token)).send({ content: "hi" })).status).toBe(503);
    expect((await request(app).get("/api/assistant/messages").set(auth(u.token))).body.messages).toHaveLength(2);
    setProvider(fake);
    await request(app).delete("/api/assistant/messages").set(auth(u.token));
    expect((await request(app).get("/api/assistant/messages").set(auth(u.token))).body.messages).toHaveLength(0);
  });
});

describe("dashboard", () => {
  it("returns computed stats from real data", async () => {
    const r = await request(app).get("/api/dashboard").set(auth(u.token));
    expect(r.status).toBe(200);
    expect(r.body.hasResume).toBe(true);
    expect(r.body.profileCompleteness).toBeGreaterThan(50);
    expect(r.body.atsScore).toBe(72);
    expect(r.body.interviewTrend).toHaveLength(1);
    expect(Array.isArray(r.body.topSkillGaps)).toBe(true);
  });
});

describe("admin", () => {
  it("blocks non-admins and anonymous users", async () => {
    expect((await request(app).get("/api/admin/stats")).status).toBe(401);
    expect((await request(app).get("/api/admin/stats").set(auth(u.token))).status).toBe(403);
    expect((await request(app).post("/api/admin/jobs").set(auth(u.token)).send({})).status).toBe(403);
  });
  it("shows platform stats", async () => {
    const r = await request(app).get("/api/admin/stats").set(auth(admin.token));
    expect(r.body.totals.users).toBeGreaterThan(2);
    expect(r.body.signups).toHaveLength(14);
  });
  it("creates, edits, deactivates, and deletes a job; hidden from users when inactive", async () => {
    const body = { title: "QA Analyst", company: "TestCo", location: "Delhi", description: "Test the product thoroughly and report defects clearly.", requiredSkills: ["Manual Testing", "SQL"], type: "FULL_TIME" };
    expect((await request(app).post("/api/admin/jobs").set(auth(admin.token)).send({ ...body, title: "x" })).status).toBe(400);
    expect((await request(app).post("/api/admin/jobs").set(auth(admin.token)).send({ ...body, salaryMin: 10, salaryMax: 5 })).status).toBe(400);
    const c = await request(app).post("/api/admin/jobs").set(auth(admin.token)).send(body);
    expect(c.status).toBe(201);
    expect(c.body.job.isSample).toBe(false);
    const id = c.body.job.id;
    expect((await request(app).get(`/api/jobs/${id}`).set(auth(u.token))).status).toBe(200);
    expect((await request(app).put(`/api/admin/jobs/${id}`).set(auth(admin.token)).send({ ...body, title: "QA Analyst II" })).body.job.title).toBe("QA Analyst II");
    await request(app).patch(`/api/admin/jobs/${id}/active`).set(auth(admin.token)).send({ isActive: false });
    expect((await request(app).get(`/api/jobs/${id}`).set(auth(u.token))).status).toBe(404);
    expect((await request(app).delete(`/api/admin/jobs/${id}`).set(auth(admin.token))).status).toBe(200);
    expect((await request(app).delete(`/api/admin/jobs/${id}`).set(auth(admin.token))).status).toBe(404);
  });
  it("manages users: deactivation blocks login, admin cannot demote themselves", async () => {
    const victim = await registerUser("victim");
    expect((await request(app).patch(`/api/admin/users/${victim.id}`).set(auth(admin.token)).send({ isActive: false })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: victim.email, password: "Passw0rdX" })).status).toBe(401);
    expect((await request(app).get("/api/profile").set(auth(victim.token))).status).toBe(401);
    const me = (await request(app).get("/api/auth/me").set(auth(admin.token))).body.user;
    expect((await request(app).patch(`/api/admin/users/${me.id}`).set(auth(admin.token)).send({ role: "USER" })).status).toBe(400);
    expect((await request(app).get("/api/admin/users?q=victim").set(auth(admin.token))).body.users.length).toBe(1);
  });
});
