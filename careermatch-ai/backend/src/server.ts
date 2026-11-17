import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`CareerMatch API listening on http://localhost:${env.PORT}`);
});

const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
