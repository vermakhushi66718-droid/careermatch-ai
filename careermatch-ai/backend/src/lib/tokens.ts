import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env";

export interface AccessPayload { sub: string; role: "USER" | "ADMIN"; }

export const signAccessToken = (p: AccessPayload) =>
  jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as any });

export const verifyAccessToken = (t: string) => jwt.verify(t, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;

/** Refresh tokens are opaque random strings; only their SHA-256 hash is stored. */
export const newOpaqueToken = () => crypto.randomBytes(48).toString("base64url");
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
