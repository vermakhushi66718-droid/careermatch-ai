import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLIENT_URL: z.string().default(process.env.RENDER_EXTERNAL_URL ?? "http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  AI_PROVIDER: z.string().default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  EMAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("CareerMatch AI <no-reply@careermatch.local>"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  ADMIN_EMAIL: z.string().default("admin@careermatch.local"),
  ADMIN_PASSWORD: z.string().default("Admin@12345"),
  STATIC_DIR: z.string().optional().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;

// Refuse to boot in production with placeholder secrets or a plain-HTTP client URL.
if (env.NODE_ENV === "production") {
  const weak = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET].some((s) => /change-me|replace-with|dev-/i.test(s) || s.length < 32);
  if (weak) { console.error("Refusing to start: set strong, unique JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (32+ chars) in production."); process.exit(1); }
  if (env.EMAIL_TRANSPORT === "smtp" && !env.SMTP_HOST) { console.error("EMAIL_TRANSPORT=smtp requires SMTP_HOST."); process.exit(1); }
}
export const isProd = env.NODE_ENV === "production";
