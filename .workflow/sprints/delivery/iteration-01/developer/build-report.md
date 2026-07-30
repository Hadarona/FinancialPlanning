# Developer Build Report — Delivery, Iteration 1

## Batch 1 (Stages A–B)

Scope: Stage A (Foundation, roadmap Sprint 0) and Stage B (Auth, roadmap
Sprint 1) only, per the approved `developer/plan.md`. Branch:
`feature/budgeting-app`.

### What was built

**Stage A — Foundation**

- Root npm workspaces monorepo (`client/`, `server/`), single committed
  lockfile, ESLint flat config (`eslint.config.mjs`), Prettier
  (`.prettierrc.json`), `ALL_LICENSES.md`.
- Server skeleton: `src/config.js` (zod-validated env, fail-fast, prints
  only offending variable *names*), `src/errors.js` (`AppError`),
  `src/app.js` (`createApp(config)` factory: helmet, CORS allowlist,
  `express.json` 32kb limit, cookie-parser, request-id middleware,
  structured logging, safe error envelope, `GET /api/v1/health`, a
  test-only forced-error route), `src/index.js` (bootstrap + graceful
  shutdown).
- Database: `src/db/migrations/001_init.sql` (`users`, `budget_periods`,
  `transactions`, per the plan's DDL), `src/db/migrate.js` (idempotent,
  schema-aware runner), `src/db/pool.js` (pg Pool factory).
- Logging: `src/logging/logger.js` (pino + pino-roll, two rotating files —
  `requests.log`, `error.log` — 5 MB × 5 kept), `src/logging/httpLogger.js`
  (pino-http, metadata-only: no bodies, no headers).
- Test harness: `server/vitest.config.js` (coverage thresholds 70/70/70/60),
  `tests/integration/helpers/{testDb,testServer}.js` (real listening server
  per test run, isolated Postgres schema created/migrated/dropped per run),
  `tests/unit/calc.test.js`, `tests/integration/health.test.js`.
- Client skeleton: Vite + React, `src/styles/tokens.css` (byte-identical
  copy of the design kit's `design-tokens.css`), `global.css`,
  `lib/{money,dates,copy,categories}.js`, placeholder routes
  (Login/Register/Budget/Insights/404), `components/ui/{Button,ErrorBoundary}`,
  a sample component test.
- Docs: `README.md` rewrite, `docs/agile/board.md`, `docs/agile/progress-log.md`,
  `docs/agile/reviews/README.md`.
- D-FND-Q4 intentional-failure exercise: commit `5736938` introduced
  `calc.js`/`calc.test.js` with a deliberately wrong expectation (observed
  failing: `npm test -w server` → 1 failed, 21 passed); commit `d99bf9d`
  fixed it (22 passed) alongside the rest of Stage A.

**Stage B — Auth**

- Backend: `src/validation/schemas.js` (strict zod schemas),
  `src/repositories/userRepo.js`, `src/services/authService.js` (bcrypt
  hashing, generic invalid-credentials error with timing-equalizing dummy
  hash, HS256 JWT sessions), `src/middleware/auth.js` (`requireAuth`),
  `src/middleware/rateLimit.js` (general + strict auth limiters),
  `src/middleware/validate.js`, `src/controllers/authController.js`,
  `src/routes/authRoutes.js`. Wired into `app.js`/`routes/index.js` via
  dependency injection (see deviations).
- Frontend: `components/ui/{TextInput,PasswordInput,TextButton,IconButton,
  Menu,AppHeader}`, `app/AuthProvider.jsx` (react-query-backed session
  bootstrap), `app/ProtectedRoute.jsx`, `app/PublicOnlyRoute.jsx`,
  `api/client.js` (fetch wrapper, `ApiError`, session-expired event),
  `api/hooks.js` (react-query hooks for register/login/logout/me),
  real `pages/LoginPage.jsx` and `RegisterPage.jsx` replacing the Stage A
  placeholders. The Budget/Insights placeholder routes now render inside an
  authenticated shell (`AppHeader` + working Logout) instead of a bare
  `<h1>`.
- Tests: `tests/unit/{schemas,authService,authMiddleware}.test.js`,
  `tests/integration/auth.test.js` (register→me→logout→me 401; duplicate
  email 409; byte-identical unknown-email/wrong-password bodies; malformed
  body 400; strict auth rate-limit 429; no password in logs), client
  `tests/{LoginPage,RegisterPage,PasswordInput,Menu}.test.jsx`.
- `docs/agile/reviews/review-1-auth.md` (major-review substitute record).

### Commands run and results

| Command | Result |
|---|---|
| `npm install` | exit 0; single root `package-lock.json`; no lockfiles inside `client/`/`server/` |
| `npm run lint` | exit 0, no warnings, no errors (final state) |
| `npm run migrate` (twice) | exit 0 both times (idempotent); confirmed via a `node -e` script that `users`, `budget_periods`, `transactions` exist in `public` |
| `npm test -w server` | 4 files, 22 tests passed |
| `npm run test:integration -w server` | 2 files, 10 tests passed (health: 3, auth: 7) against the real Neon database in isolated `test_*` schemas; no leftover schemas after teardown (verified by querying `information_schema.schemata`) |
| `npm test -w client` | 5 files, 10 tests passed |
| `npm run build` (client) | exit 0, no warnings |
| `npm run coverage -w server` | 6 files, 32 tests passed; 83.5%/84.5%/91.5% lines/branches/functions on Stage A/B code (informational only — the ≥70% gate is Stage H's, not this batch's) |
| `npm run test:workflow` | 5/5 passed (verifies the `tools/workflow-core.mjs` unused-import fix didn't regress the controller) |
| Manual: unset `JWT_SECRET` via env override | `npm run migrate`/server start fails fast printing only variable *names* (`DATABASE_URL, JWT_SECRET` when both unset; confirmed individually too), never values (D-FND-B1) |

### Deviations from the plan (with reasons)

1. **App.js/routes/index.js committed under Stage B, not Stage A.** Both
   files are Stage A items in the plan's file layout, but wiring Stage B's
   DB-backed auth surfaced two infrastructure bugs (below) that required
   changing their dependency-wiring pattern. Splitting the fix across two
   commits would have meant committing a known-broken intermediate version,
   so both files' final (Stage-B-inclusive) content is in the Stage B
   commit. Stage A's own acceptance checks were independently verified
   against a temporarily-reverted, Stage-A-only version of both files
   (health endpoint, structured logging to isolated files, forced-error
   handling, env fail-fast — all passing) before Stage B implementation
   began; see `docs/agile/progress-log.md` for the exact verification note.
2. **Config/pool/logger singleton bug found and fixed (not in the plan).**
   The plan's architecture implied module-level `config`/`pool`/logger
   exports. An eagerly-created `config` singleton (module import side
   effect) locked in `process.env` at first import — before per-test
   `DB_SCHEMA`/`LOG_DIR` overrides were set — which would have silently
   made every DB-touching test (starting with Stage B's auth tests) run
   against the real `public` schema instead of an isolated one. Fixed by
   removing the singleton; `config.js` now only exports `loadConfig()`, and
   `db/pool.js`/`logging/logger.js` are per-call factories
   (`createPool(config)`, `createLoggers(config)`) built once inside
   `createApp(config)`. No product behavior changed; this is purely an
   internal wiring correction, recorded because it touches files the plan
   described differently.
3. **Neon pooled-connection `search_path` issues found and fixed (not in
   the plan).** Two related bugs surfaced while validating Stage B against
   the real Neon database (see `review-1-auth.md` for full detail):
   (a) Neon's pooled endpoint rejects the `options=-c search_path=…`
   connection-string startup parameter, so `pool.js` sets `search_path` via
   a `SET` query on the pool's `connect` event instead; (b) a bare
   (non-transactional) `SET search_path` on `migrate.js`'s plain
   `pg.Client` could silently fail to apply under concurrent connection
   establishment, so `migrate.js` now wraps schema creation and every
   migration statement in one transaction using `SET LOCAL`. Verified via a
   direct concurrent-`migrate()` repro (3/3 succeeded after the fix,
   reproduced the failure 2/2 before it) and a full `npm run coverage -w
   server` run (which runs test files without `--no-file-parallelism`).
4. **Test harness `process.env` mutation removed (not in the plan).**
   `startTestServer` originally mutated the shared `process.env` to pass
   per-test `DB_SCHEMA`/`LOG_DIR` overrides to a subsequent dynamic import;
   this raced when two test files' `beforeAll` hooks interleaved under
   file-level parallelism. Fixed by building a local env object passed
   directly to `loadConfig()`. Same category as #2/#3 above — infrastructure
   correctness, not product behavior.
5. **`server/src/domain/categories.js` created during Stage A, not
   explicitly assigned a task letter.** The plan's architecture lists this
   file and the DDL section references it ("exactly the five default ids
   in `domain/categories.js`"), but no A-task bullet explicitly creates it.
   Created it alongside the DB layer since `client/src/lib/categories.js`
   (an explicit A5 deliverable) is described as "mirror of server constant"
   and needs something to mirror.
6. **`docs/design/figma-kit/data/content.json` has no "register" section.**
   `client/src/lib/copy.js` extends it with minimal, voice-consistent
   register-page copy ("Create account", "Already have an account? Sign
   in"). Noted in the copy file itself and flagged here for design review.
7. **One pre-existing lint bug fixed outside product scope.**
   `tools/workflow-core.mjs` had an unused `stat` import that only surfaced
   once `eslint.config.mjs` (an A1 deliverable, per the plan) started
   linting `tools/**`. Removed the unused import (one line) so `npm run
   lint` — an A1 Verify condition — actually exits 0. Confirmed
   `npm run test:workflow` still passes (5/5) after the change.
8. **`review-1-auth.md`'s D-AUTH-D* rows recorded as implemented, not
   verified.** Those rows are design-reviewer-owned per the plan's
   acceptance table; the developer-owned implementation exists (external
   labels, toggle behavior/focus, ≥44px targets, kit tokens) but only design
   review can mark them independently confirmed.

### Acceptance check status (Stage A/B rows only; see plan.md for the full table)

All Stage A `DEV`-owned rows (D-FND-D5/D6, D-FND-F1..F6, D-FND-B1..B6,
D-FND-Q2/Q3/Q4/Q5) and Stage B `DEV`-owned rows (D-AUTH-D2/D3/D4/D5/D6 —
implementation only, D-AUTH-F1..F7, D-AUTH-B1..B7) pass per the automated
tests and manual checks above. `SUB`/`QA`/`DES` rows (D-FND-D1..D4, D-FND-Q1,
D-FND-Q6, D-AUTH-D1, D-AUTH-Q1..Q6) are out of developer scope; the
developer-owned enablers for the QA rows exist (integration tests covering
the same journeys QA will independently verify).

### What the next batch (Stage C onward) must know

- **Config pattern**: never re-introduce a module-level `config`/`pool`/
  logger singleton. Use `loadConfig(env)` and the `createPool(config)`/
  `createLoggers(config)` factories; build new repositories/services as
  factories taking their dependencies as parameters (see
  `repositories/userRepo.js`, `services/authService.js` for the pattern),
  and wire them in `app.js` the same way auth is wired.
- **Migrations**: any new migration file added under
  `src/db/migrations/` is automatically picked up by the existing
  transaction-wrapped `migrate()` — no changes needed there.
- **Test servers**: always use `tests/integration/helpers/testServer.js`'s
  `startTestServer()`/`createCookieJarFetch()`; never statically import
  `config.js`/`app.js`/`pool.js` at the top of a new test file with plain
  `import` — always via the dynamic-import pattern already used there, to
  keep per-test isolation intact.
- **`npm run coverage`** (unscoped) runs unit + integration together without
  `--no-file-parallelism`; this is fine now (the concurrency bug is fixed),
  but keep using `npm run test:integration -w server` (which passes
  `--no-file-parallelism`) as the primary gate, per the plan's stated Neon
  connection-limit rationale.
- `server/src/app.js` currently builds one `pool`/`userRepo`/`authService`/
  `requireAuth` per `createApp(config)` call. Stage C's `budgetRepo`/
  `transactionRepo`/services should be added the same way and threaded
  through `createApiRouter`.
- Budget/Insights routes are still placeholders (`AuthenticatedShellPlaceholder`
  in `client/src/app/router.jsx`); Stage C replaces `BudgetPlaceholder` with
  the real `features/budget/BudgetPage.jsx`.

### Blockers

None. npm registry access and the Neon database (via the repo-root `.env`,
never printed) were both reachable throughout.
