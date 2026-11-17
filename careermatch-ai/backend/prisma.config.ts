import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Default: standard Prisma CLI behaviour (native engines, DATABASE_URL from schema).
// Set PRISMA_JS_ENGINE=1 only in locked-down environments that cannot download Prisma's
// native engine binaries; it switches the CLI to the JS/WASM schema engine + pg adapter.
const useJsEngine = process.env.PRISMA_JS_ENGINE === "1";

const base = {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
};

export default defineConfig(
  (useJsEngine
    ? {
        ...base,
        experimental: { adapter: true },
        engine: "js",
        async adapter() {
          const { PrismaPg } = await import("@prisma/adapter-pg");
          return new PrismaPg({ connectionString: process.env.DATABASE_URL });
        },
      }
    : base) as any
);
