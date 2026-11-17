# Single-image deployment: builds the React app and the API, and the API serves both.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:22-slim AS app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend ./
RUN npx prisma generate && npm run build
COPY --from=web /web/dist ./public
RUN mkdir -p uploads && chown -R node:node /app
USER node
ENV NODE_ENV=production STATIC_DIR=public PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_ON_START\" = \"true\" ]; then npx tsx prisma/seed.ts; fi && node dist/server.js"]
