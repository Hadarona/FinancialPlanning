# Budgeting App

A single-user personal budgeting app: register/login, one private monthly
budget per user (five fixed categories), expense tracking with instant
recalculation, and a spending-insights dashboard. Built as a single delivery
across the sprint sections of
`docs/product/Budgeting_App_Development_Roadmap.md`.

Stack: **React** (Vite, React Router, TanStack Query) on the client,
**Node.js/Express** on the server, **PostgreSQL** (hosted on **Neon**) for
storage, JWT-in-HTTP-only-cookie sessions, and hand-rolled SVG charts.

> Build status: this README documents the app as built through **Stage B
> (Foundation + Auth)** of the delivery plan. Budget, expenses, plans,
> insights, and the remaining hardening/docs stages land in subsequent
> batches — see `.workflow/sprints/delivery/iteration-01/developer/plan.md`
> and `build-report.md` for the authoritative status.

## Prerequisites

- Node.js 20+ and npm 10+
- Git
- A reachable PostgreSQL database (this project targets Neon; any Postgres
  13+ with `pgcrypto`'s `gen_random_uuid()` available works)

## Setup (macOS/Linux)

```bash
git clone <this-repo>
cd FinancialPlanning
cp .env.example .env
# Edit .env: set DATABASE_URL to your Neon connection string, then generate
# a session-signing secret (never printed/echoed anywhere else):
printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env

npm install          # single root install; one lockfile for both workspaces
npm run migrate      # applies server/src/db/migrations/*.sql (idempotent)
npm run dev          # runs server (http://localhost:4000) + client (http://localhost:5173)
```

Open `http://localhost:5173`. In development the client's Vite dev server
proxies `/api` to the Express server, so no CORS configuration is needed
locally.

## Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Neon/Postgres connection string; never logged |
| `JWT_SECRET` | yes | — | HS256 session-signing secret; never logged |
| `PORT` | no | `4000` | Express listen port |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `LOG_DIR` | no | `<repo>/logs` | gitignored; rotating request/error logs |
| `CORS_ORIGIN` | no | `http://localhost:5173` | comma-separated allowlist |
| `DB_SCHEMA` | no | `public` | tests use isolated `test_*` schemas |
| `BCRYPT_ROUNDS` | no | `10` | password hashing cost |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_AUTH_MAX` | no | `300` / `10` per 15 min | general vs. strict auth limiter |
| `ALLOW_DEMO_SEED` | no | unset | demo seed refuses unless `true` and not production |
| `SERVE_CLIENT` | no | unset | when `true`, Express serves `client/dist` with SPA fallback |

## Scripts

Run from the repo root (npm workspaces: `client/`, `server/`):

| Script | Description |
|---|---|
| `npm run dev` | Runs server + client concurrently |
| `npm run lint` | ESLint across both workspaces |
| `npm run format:check` | Prettier check |
| `npm test` | Server unit tests + client component tests |
| `npm run test:integration` | Server real-HTTP integration tests (needs `DATABASE_URL`) |
| `npm run coverage` | Coverage for both workspaces |
| `npm run build` | Production client build (Vite) |
| `npm run migrate` | Runs pending SQL migrations against `DATABASE_URL` |
| `npm run seed:demo` | Deterministic demo data (guarded; see env table) |
| `npm run smoke` | End-to-end smoke script against a running server |

## Project structure

```text
client/   React app (Vite) — src/{styles,lib,api,app,components,pages,features}
server/   Express API — src/{config,db,logging,middleware,routes,controllers,
                              services,repositories,validation,domain,seed}
docs/     Product roadmap, design kit, agile board/progress log, API docs
.workflow/  Multi-agent delivery workflow state and evidence (not app code)
```

## Data model (Stage A/B slice)

- `users(id, email, password_hash, created_at, updated_at)` — email stored
  lowercase; password hashed with bcrypt, never returned by any endpoint.
- `budget_periods` and `transactions` (full DDL in
  `server/src/db/migrations/001_init.sql`) exist from Stage A onward; the
  read/write budget and expense APIs land in later stages.

## Money and currency

USD, no displayed symbol, `1,234` formatting; **all money is stored and
computed as integer minor units (cents)**. Client input is parsed by string
splitting (never `parseFloat` arithmetic) via `client/src/lib/money.js`;
server responses always carry integer `*Minor` fields.

## Authentication (Stage B)

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`,
  `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- Session: signed JWT (HS256, 24h) in an HTTP-only, `SameSite=Lax` cookie
  named `bb_session` (`Secure` in production). No tokens in `localStorage`.
- Duplicate email -> `409 CONFLICT`; invalid credentials return an identical
  safe message whether the email exists or not; a dedicated, stricter rate
  limit applies to `/auth/*`.

## Logging and security

- Structured JSON request logs (`logs/requests.log`) and error logs
  (`logs/error.log`), rotated by `pino-roll` (5 MB, 5 files kept), both
  git-ignored. Logs are metadata-only: no passwords, tokens, cookies, notes,
  or full request/response bodies are ever written.
- `helmet` security headers, a strict CORS allowlist, `express.json` body
  limit (32 kb), and rate limiting on general traffic and auth endpoints.
- Every request carries an `X-Request-Id` header; error responses use one
  documented envelope shape (`docs/api.md`, finalized in a later stage).

## Testing

- Unit tests: `server/tests/unit`, run with `npm test -w server`.
- Real-HTTP integration tests: `server/tests/integration`, run with
  `npm run test:integration -w server` — each run creates an isolated
  Postgres schema (`test_<timestamp>_<pid>_<random>`) on the same database
  configured by `DATABASE_URL`, migrates it, and drops it afterward. `public`
  data is never touched.
- Client component tests: `client/tests`, run with `npm test -w client`.

## Mandatory vs. bonus requirements (traceability skeleton)

Full traceability is completed at Stage H/I. Current slice:

| Requirement | Status | Evidence |
|---|---|---|
| Register/login/session/logout (mandatory per source-of-truth) | Done (Stage B) | `server/src/services/authService.js`, `server/tests/integration/auth.test.js`, `docs/agile/reviews/review-1-auth.md` |
| Structured external logging, redaction (mandatory) | Implemented Stage A/B | `server/src/logging/*` |
| Security headers, CORS allowlist, rate limiting, body limits (mandatory) | Implemented Stage A/B | `server/src/app.js`, `server/src/middleware/rateLimit.js` |
| Design tokens consumed via CSS variables (mandatory) | Implemented Stage A | `client/src/styles/tokens.css` |
| Budget/expenses/plans/insights (mandatory) | Not yet built (later stage batches) | — |
| ≥70% coverage, lockfile, real-HTTP integration tests (bonus) | In progress; enforced via `vitest` coverage thresholds | `server/vitest.config.js`, `client/vitest.config.js` |

## Known limitations (Stage A/B slice)

- Budget, expenses, plan editing, and insights are not implemented yet in
  this batch; `/budget` and `/insights` routes render an authenticated
  placeholder shell (header + working Logout only).
- Demo seed script, demo credentials, and the clean-room smoke test are
  introduced in later stages.
- `npm run coverage` (unscoped) runs unit and integration tests without
  `--no-file-parallelism`; `npm run test:integration` is the command used to
  validate this batch and always runs serially, as the plan specifies.
