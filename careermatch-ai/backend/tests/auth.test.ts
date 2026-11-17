import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app, registerUser, uniq, auth } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { outbox } from "../src/services/email";

afterAll(async () => { await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } }); await prisma.$disconnect(); });

describe("auth", () => {
  it("rejects weak passwords and bad emails", async () => {
    const r = await request(app).post("/api/auth/register").send({ fullName: "A B", email: "nope", password: "weak" });
    expect(r.status).toBe(400);
    expect(r.body.error.details.email).toBeTruthy();
    expect(r.body.error.details.password).toBeTruthy();
  });

  it("registers, stores a bcrypt hash, sends a verification email, rejects duplicates", async () => {
    const email = `reg-${uniq()}@test.local`;
    const r = await request(app).post("/api/auth/register").send({ fullName: "Reg User", email, password: "Passw0rdX" });
    expect(r.status).toBe(201);
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body.user.passwordHash).toBeUndefined();
    const db = await prisma.user.findUnique({ where: { email } });
    expect(db!.passwordHash.startsWith("$2")).toBe(true);
    expect(outbox.some((m) => m.to === email && m.subject.includes("Verify"))).toBe(true);
    const dup = await request(app).post("/api/auth/register").send({ fullName: "Reg User", email, password: "Passw0rdX" });
    expect(dup.status).toBe(409);
  });

  it("verifies email with the emailed token exactly once", async () => {
    const { email } = await registerUser("verify");
    const mail = [...outbox].reverse().find((m) => m.to === email)!;
    const token = mail.text.match(/token=([\w-]+)/)![1];
    expect((await request(app).post("/api/auth/verify-email").send({ token })).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { email } }))!.emailVerified).toBe(true);
    expect((await request(app).post("/api/auth/verify-email").send({ token })).status).toBe(400);
  });

  it("logs in, protects routes, and gives the same error for bad email vs bad password", async () => {
    const { email } = await registerUser("login");
    const ok = await request(app).post("/api/auth/login").send({ email, password: "Passw0rdX" });
    expect(ok.status).toBe(200);
    const me = await request(app).get("/api/auth/me").set(auth(ok.body.accessToken));
    expect(me.body.user.email).toBe(email);
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    const badPw = await request(app).post("/api/auth/login").send({ email, password: "Wrong123" });
    const noUser = await request(app).post("/api/auth/login").send({ email: `x${uniq()}@test.local`, password: "Wrong123" });
    expect(badPw.status).toBe(401);
    expect(badPw.body.error.message).toBe(noUser.body.error.message);
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const { cookies } = await registerUser("refresh");
    const first = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();
    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(reuse.status).toBe(401);
    const newCookies = first.headers["set-cookie"] as unknown as string[];
    const afterTheft = await request(app).post("/api/auth/refresh").set("Cookie", newCookies);
    expect(afterTheft.status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const { cookies } = await registerUser("logout");
    await request(app).post("/api/auth/logout").set("Cookie", cookies);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookies)).status).toBe(401);
  });

  it("forgot/reset password flow works and does not reveal whether the email exists", async () => {
    const { email } = await registerUser("reset");
    const a = await request(app).post("/api/auth/forgot-password").send({ email });
    const b = await request(app).post("/api/auth/forgot-password").send({ email: `ghost${uniq()}@test.local` });
    expect(a.status).toBe(200); expect(b.status).toBe(200);
    expect(a.body.message).toBe(b.body.message);
    const mail = [...outbox].reverse().find((m) => m.to === email && m.subject.includes("Reset"))!;
    const token = mail.text.match(/token=([\w-]+)/)![1];
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "NewPassw0rd" })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email, password: "Passw0rdX" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "NewPassw0rd" })).status).toBe(200);
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "Another1Pass" })).status).toBe(400);
  });
});
