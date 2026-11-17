import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { resumeRouter } from "./routes/resumes";
import { jobRouter } from "./routes/jobs";
import { applicationRouter } from "./routes/applications";
import { roadmapRouter } from "./routes/roadmaps";
import { interviewRouter } from "./routes/interviews";
import { assistantRouter } from "./routes/assistant";
import { dashboardRouter } from "./routes/dashboard";
import { adminRouter } from "./routes/admin";
import { AIService } from "./services/ai";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.CLIENT_URL.split(","), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use("/api/auth", authRouter);
  app.get("/api/config", (_req, res) => res.json({ aiConfigured: AIService.isConfigured(), aiProvider: AIService.providerName() }));
  app.use("/api/profile", profileRouter);
  app.use("/api/resumes", resumeRouter);
  app.use("/api/jobs", jobRouter);
  app.use("/api/applications", applicationRouter);
  app.use("/api/roadmaps", roadmapRouter);
  app.use("/api/interviews", interviewRouter);
  app.use("/api/assistant", assistantRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  // Optional single-container deployment: serve the built React app (STATIC_DIR) with SPA fallback.
  if (env.STATIC_DIR && fs.existsSync(path.resolve(env.STATIC_DIR, "index.html"))) {
    const dir = path.resolve(env.STATIC_DIR);
    app.use(express.static(dir, { maxAge: "1h", index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(dir, "index.html")));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
