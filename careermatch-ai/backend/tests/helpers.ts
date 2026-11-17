import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

export const app = createApp();
export const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

export async function registerUser(prefix = "user") {
  const email = `${prefix}-${uniq()}@test.local`;
  const res = await request(app).post("/api/auth/register").send({ fullName: "Test User", email, password: "Passw0rdX" });
  return { email, token: res.body.accessToken as string, id: res.body.user.id as string, cookies: res.headers["set-cookie"] as unknown as string[] };
}

export async function createAdmin() {
  const email = `admin-${uniq()}@test.local`;
  await prisma.user.create({ data: { email, fullName: "Admin", role: "ADMIN", emailVerified: true, passwordHash: await hashPassword("Passw0rdX"), profile: { create: {} } } });
  const res = await request(app).post("/api/auth/login").send({ email, password: "Passw0rdX" });
  return { email, token: res.body.accessToken as string };
}

export const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
