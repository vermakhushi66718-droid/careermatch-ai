# CareerMatch AI

An AI-powered career platform for students and job seekers: resume analysis, explainable job matching, learning roadmaps, mock interviews, an application tracker, a career assistant and an admin panel.

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS 4 + Framer Motion + Recharts · Node.js + Express + TypeScript · PostgreSQL + Prisma · JWT + refresh tokens · Zod · Multer · pdf-parse / pdf.js · Anthropic API (provider-independent).

> **Demonstration data.** The 32 seeded jobs and internships are fictional (invented companies). Every one is flagged `isSample = true` and labelled “Demo listing” in the UI. Nothing here is a real job opening.

---

## Quick start (local development)

Requirements: Node.js 20+ (22 tested), PostgreSQL 14+.

```bash
# 1. Database
createdb careermatch            # or use any empty PostgreSQL database

# 2. Backend
cd backend
cp .env.example .env            # edit DATABASE_URL, JWT secrets, optional ANTHROPIC_API_KEY
npm install
npx prisma generate
npx prisma migrate deploy       # applies prisma/migrations/0001_init (use an EMPTY database)
npm run seed                    # admin account + 32 demo listings
npm run dev                     # http://localhost:4000

# 3. Frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxies /api to :4000)
```

Sign in as the seeded admin with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env` (defaults: `admin@careermatch.local` / `Admin@12345` — change them). Job seekers register through the app.

**Emails in development** (verification, password reset) are printed to the backend console. Look for `=== [DEV EMAIL] ===` and copy the link.

### Enabling AI features
Resume analysis, match explanations, roadmaps, interview questions/feedback, resume rewrites and the career assistant all need an LLM key. Set `ANTHROPIC_API_KEY` in `backend/.env` and restart. **Without a key the app still runs**: resumes upload and their text is stored, and each AI feature shows a clear “no API key configured” message instead of failing. Job search, the (deterministic) match score, tracker, profile and admin all work without AI.

### Tests
```bash
cd backend && npm run seed && npm test      # 31 integration tests against the real database
cd frontend && npm run typecheck && npm run build
```
Backend tests need the seeded database (they read the demo jobs) and clean up the users they create (`*@test.local`). Set `TEST_DATABASE_URL` to use a separate database.

### Docker
```bash
cp .env.example .env            # fill in secrets
docker compose up --build       # app + PostgreSQL on http://localhost:4000
docker compose exec app npm run seed
```

### Deploy to Render (free tier)
1. Push this folder to a GitHub repository.
2. In Render: **New + → Blueprint**, pick the repo. `render.yaml` creates the PostgreSQL database and the web service.
3. When prompted, paste `ANTHROPIC_API_KEY` (optional; AI features stay off without it).
4. After the first deploy, open the service URL. The admin password is the generated `ADMIN_PASSWORD` under the service's **Environment** tab; sign in with `admin@careermatch.local`.

The blueprint, the seed-on-start command and Render URL auto-detection have **not been run** (no hosting account was available when this was built). Free instances sleep when idle, and uploaded files on the free tier do not persist across deploys. Use a paid disk or object storage for real use.

---

## Architecture

```
backend/src
  config/env.ts            validated environment (Zod); production refuses placeholder secrets
  routes/                  auth, profile, resumes, jobs, applications, roadmaps, interviews, assistant, dashboard, admin
  services/ai/             provider-independent AI layer (see below)
  services/matching.ts     deterministic, explainable job-match scoring
  services/email.ts        console transport (dev) / SMTP via nodemailer (prod)
  middleware/              auth (JWT + RBAC), Zod validation, error handler
backend/prisma             schema.prisma, migrations/, seed.ts
frontend/src
  pages/ components/       UI; pages/admin for the admin panel
  lib/api.ts               fetch client with silent refresh-token rotation
```

### Provider-independent AI
Application code only calls `AIService` (`services/ai/index.ts`), which owns all prompts, output schemas (Zod) and a one-shot JSON repair retry. It talks to an `LLMProvider` (`complete(request) → text`). Adapters: `anthropic.ts` (default) and `openai.ts`. Switch with `AI_PROVIDER=openai` + `OPENAI_API_KEY`. To add another provider, implement the interface and register it in `registry.ts`; no route changes are needed.

### Match scoring (explainable)
Scores are computed in code, not by the LLM: skills 55 (required 45 + preferred 10), role fit 15, location 10, experience level 10, education/CGPA 10. The UI shows every component, matched and missing skills, and the reasons. The LLM only *narrates* the result (“Explain with AI”).

### Jobs and future live APIs
Jobs live in PostgreSQL with `source`, `externalId` and `isSample` fields and a unique `(source, externalId)` key, so an authorised job-API importer can upsert into the same table without schema changes. Admins can create, edit, hide/publish and delete listings.

### Security measures
bcrypt (cost 12) password hashing · short-lived access JWT in memory + rotating refresh token in an httpOnly cookie (hashed in DB; reuse of a rotated token revokes the whole session family) · role-based access on every admin route · per-user data scoping (other users' resources return 404) · Zod validation on all inputs · uniform login/forgot-password responses (no account enumeration) · password-reset/verification tokens are random, hashed, single-use and expiring · rate limits on auth and assistant endpoints · helmet, CORS allow-list · PDF magic-byte and image signature checks, size limits · resume/answer text is passed to the model as delimited, untrusted data · API keys only in backend env · production refuses to start with placeholder JWT secrets.

---

## Feature checklist

### Implemented and tested
| Area | Notes | How it was verified |
|---|---|---|
| Registration, login, logout, refresh rotation, reuse detection | | Integration tests + browser |
| Email verification, forgot/reset/change password | Console emails | Integration tests + browser |
| Role-based access (user / admin), protected routes | | Integration tests + browser |
| Onboarding wizard + editable profile + photo upload | 5 steps; photo type sniffing | Integration tests + browser |
| Resume upload (PDF validation, text extraction, fallback parser) | Text PDFs only | Integration tests + browser, two PDF generators |
| Resume extraction editing, apply skills to profile, primary resume | AI step uses a fake provider in tests | Integration tests |
| Job search, filters, sort, pagination, saved jobs | URL-synced | Integration tests + browser |
| Explainable match score + breakdown | | Integration tests + browser |
| Skill-gap → roadmap generation, progress, add skill to profile | AI step uses a fake provider in tests | Integration tests |
| Mock interviews: generate, answer, score, complete, summary | AI step uses a fake provider in tests | Integration tests |
| Application tracker (CRUD, status, follow-ups) | | Integration tests + browser |
| Career assistant (history, clear) | AI step uses a fake provider in tests | Integration tests |
| Dashboard (stats, charts, skill gaps) | Computed from DB | Integration tests + browser |
| Admin: stats, user management, full job CRUD, hide/publish, audit log | | Integration tests + browser |
| Graceful behaviour with no API key | Every AI endpoint returns 503 `AI_NOT_CONFIGURED` | Integration tests + browser |
| Responsive layout (desktop, tablet, 390px mobile), no horizontal overflow | | Browser |
| Loading skeletons, empty/error states, toasts, confirm dialogs | | Browser |
| Production build, compiled server, SPA static serving, production secret guard | | Run locally |
| Fresh-database install (migration SQL + seed) | | Run locally |

### Needs external configuration — **not tested here**
| Item | What you need |
|---|---|
| **Live Anthropic calls** | `ANTHROPIC_API_KEY`. Prompts, parsing and error paths are tested with a fake provider only; real-model output quality and latency are unverified. Expect to tune prompts. |
| OpenAI adapter | `AI_PROVIDER=openai`, `OPENAI_API_KEY`. Written, never executed. |
| SMTP email | `EMAIL_TRANSPORT=smtp` + `SMTP_*`. Written, never executed. |
| Docker / docker-compose | Not built or run (no Docker daemon in the build environment). |
| `prisma migrate deploy` | The Prisma CLI could not download its engine in the build sandbox, so the migration SQL was generated with `prisma migrate diff` and applied with `psql` (verified on an empty database). Run `migrate deploy` on your machine on an empty database. |
| Google Fonts | Loaded from fonts.googleapis.com; the build sandbox blocked it, so tests ran with fallback fonts. |
| HTTPS | Refresh cookie is `secure` in production, so serve over HTTPS. Set `CLIENT_URL` to your real origin. |

### Known limitations
- Scanned/image-only PDFs are rejected (no OCR).
- Rate limiting is in-memory (single instance); uploads are stored on local disk. Use a shared store/object storage if you scale out.
- The interview and assistant features are text-only.
- No automated frontend unit tests; the UI was verified with browser walkthroughs (not included in the repo).
- No formal accessibility audit (labels, focus and keyboard use were considered; screen-reader testing was not done).
- No load or penetration testing.
