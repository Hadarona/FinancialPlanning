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

## Batch 2 (Stages C–E)

Scope: Stage C (Budget read model + Budget screen + guarded demo seed),
Stage D (Expenses add/delete), Stage E (Create/edit plans + month
navigation), per the approved `developer/plan.md`. Branch:
`feature/budgeting-app`. Commits: `0af6cf1` (Stage C), `d0c57b6` (Stage D),
`7be4b57` (Stage E).

### What was built

**Stage C — Budget read model (commit `0af6cf1`)**

- `server/src/services/calc.js`: `summarizeBudget` (planned = Σ plans,
  available = income − planned incl. negative, per-category actual/progress
  with `Math.round(actual/planned×100)`, states `normal`/`overspent`
  (>100 preserved)/`unplanned` (zero-plan spending → `progressPercent`
  null, never a division by zero)), `monthRange`/`daysInMonth` (pure string
  arithmetic, leap-year aware), `largestRemainderShares` (integers summing
  exactly to 100; all-zero → all-zero; verified against the kit's
  47/18/10/11/14).
- `server/src/repositories/budgetRepo.js` + `transactionRepo.js`
  (`sumByCategory`), `services/budgetService.js`, `controllers/routes` for
  `GET /api/v1/budgets/:month` behind `requireAuth` with strict `YYYY-MM`
  param validation; `validateParams`/`validateQuery` middleware added.
  bigint columns are `Number()`-converted at the repo boundary;
  `occurred_on::text` bypasses pg date parsing (decision #6).
- `server/src/seed/demoSeed.js`: refuses without `ALLOW_DEMO_SEED=true`,
  refuses when `NODE_ENV==='production'`; deterministic fixed expense lists
  (all days ≤28) reproducing kit totals — current 842,000 / previous
  918,000 minor units; idempotent (deletes and recreates only
  `demo@example.com`, in one transaction).
- Budget screen: `features/budget/{BudgetPage,SummaryMetrics,CategoryRow}`,
  shared `Card`/`ProgressBar`/`Skeleton`/`EmptyState`/`ErrorState`,
  `lib/icons.js` (icon-map-restricted lookup). Four states: skeleton;
  "No budget for <Month> yet" + Create action; error + Retry that keeps the
  authenticated shell; data. SR sentence per category ("Housing: 2,520
  spent of 4,000 planned, 63%"); overspent/unplanned flagged with
  `TriangleAlert` + text, never color alone.

**Stage D — Expenses (commit `d0c57b6`)**

- API `GET/POST /budgets/:month/transactions`, `DELETE …/:id`: budget
  resolved by `(session user, month)` first; category validated against the
  budget's fixed set; date-in-month by pure string comparison (also rejects
  impossible days); strict schemas (positive integer cents, note ≤200
  trimmed, optional uuid `clientRequestId`); dedupe via the partial unique
  index — retry returns the existing row with 200 (one row ever);
  missing/unowned/malformed ids share one 404 body; deterministic list
  ordering (`occurred_on DESC, created_at DESC, id DESC`) with limit 1–200
  (default 50); notes never logged.
- UI: shared `Dialog` (portal, `aria-modal`, focus in/trap/return, Escape;
  bottom sheet <768px, centered 480px card ≥768px), `AddExpenseDialog`
  (string-parsed cents, month-bounded date input, note counter, pending
  Save blocks double submit, failed save keeps values + Retry reusing the
  same `clientRequestId`), `ExpensePanel` history (delete buttons name the
  exact transaction), `DeleteExpenseConfirm`. Success invalidates
  budget/transactions/insights queries (no reload) and announces via a
  `role="status"` region. `docs/agile/reviews/review-2-expenses.md` written.

**Stage E — Plans + month navigation (commit `7be4b57`)**

- API `POST /budgets` + `PATCH /budgets/:month`: client sends only
  `{id, plannedMinor}` pairs; stored categories rebuilt from
  `domain/categories.js` constants (metadata unforgeable, set never
  shrinks); creation requires exactly the five ids once each; duplicate
  month decided by the DB constraint (concurrent creates → one 201 + one
  409); patch merges income/plans and returns the recalculated read model;
  over-allocation accepted with negative `availableMinor`.
- UI: `BudgetFormPage` (`/budget/new?month=`, `/budget/:month/edit`) with
  kit-default/stored prefill, live "Planned X · Available Y" per keystroke,
  over-allocation warning (icon + text; saving allowed), 409 recovery link,
  `beforeunload` + router-blocker unsaved-changes dialog (Keep editing /
  Discard changes); `MonthNav` prev/next (kit `ArrowLeft`, mirrored for
  next) driving `/budget?month=`; header menu "Edit budget" enabled once a
  budget is loaded.

### Commands run and results (final state)

| Command | Result |
|---|---|
| `npm run lint` | exit 0, no errors/warnings |
| `npm test -w server` | 4 files, 44 tests passed (calc 18, schemas 13, auth service/middleware 13) |
| `npm run test:integration -w server` | 5 files, 31 tests passed against real listening servers + isolated Neon `test_*` schemas (health 3, auth 7, budget 7, transactions 8, plans 6) |
| `npm test -w client` | 9 files, 32 tests passed |
| `npm run build` | exit 0 (vite production build) |
| `npm run seed:demo` (no flag) | refused with exit 1 ("set ALLOW_DEMO_SEED=true") |
| `ALLOW_DEMO_SEED=true npm run seed:demo` (twice) | exit 0 both runs, identical deterministic summary (months 2026-07/2026-06, totals 842000/918000) — idempotent |
| `ALLOW_DEMO_SEED=true NODE_ENV=production node server/src/seed/demoSeed.js` | refused with exit 1 (production guard) |

Checks were also run per-stage before each commit (each stage's suites were
green before the next stage started).

### Deviations from the plan (with reasons)

1. **Dialog focus-effect bug found and fixed during Stage D (not in the
   plan).** The shared `Dialog`'s focus-management effect initially
   depended on the `onClose` prop; parents recreate that callback every
   render, so each keystroke re-ran the effect and moved focus back to the
   first field (caught by the D-EXP-F1 component test — note text spilled
   into the amount input). Fixed by keeping the latest `onClose` in a ref
   and depending only on `open`. Recorded in `review-2-expenses.md` #1.
2. **jsdom-only `Request` shim added to `client/tests/setup.js` (Stage E,
   not in the plan).** `useBlocker` requires a data router; under vitest's
   jsdom environment, react-router's data-router navigations construct
   undici `Request`s with jsdom `AbortSignal`s, which undici's brand check
   rejects (TypeError) — impossible in a real browser (single realm). The
   shim strips only the cross-realm signal, in tests only; no product code
   changed and no test expectation was weakened.
3. **Explicit 30 s timeouts on multi-round-trip integration tests
   (Stages D/E).** Remote Neon latency makes 7-call journeys exceed
   vitest's 5 s default. Timeout raise only; assertions unchanged.
4. **Malformed DELETE `:id` returns 404, not 400.** The plan says the id is
   "uuid-validated" while also requiring "unowned or missing → 404 same
   body". Routing malformed ids onto the same 404 path (service-level UUID
   check) keeps one indistinguishable code path and avoids a Postgres
   22P02 cast error; an integration test asserts byte-identical bodies for
   malformed vs nonexistent ids.
5. **Kit icon extensions.** The icon map lacks delete/error glyphs; Lucide
   `Trash2` (history delete) and `TriangleAlert` (warnings/overspent) are
   used — same family, outline style. Flagged for design review, like the
   Stage B register-copy extension.
6. **Stage C committed the disabled Add-expense button placeholder** (per
   the plan's own note) and a `/budget/new` placeholder route so the
   Create-budget action never dead-ended between the C and E commits; both
   were replaced by the real implementations inside this batch (D and E
   commits). No dead state remains.
7. **`validateQuery` middleware landed in Stage C's commit** though only
   Stage D uses it — it was written together with `validateParams` in the
   shared middleware file. No behavioral impact on Stage C.
8. **Copy extensions beyond content.json** for expense/plan-form strings
   (labels, statuses, warnings), voice-consistent with the kit, marked in
   `lib/copy.js` comments for design review — same pattern batch 1
   established for the register page.

### Acceptance check status (developer-owned rows, this batch)

- Stage C: D-BUD-D1..D5 (implementation), D-BUD-F1..F6, D-BUD-B1..B7 — pass
  via unit/integration/component tests above. D-BUD-F2's kit numbers are
  asserted both at the API level (integration fixture) and in the
  component fixture test.
- Stage D: D-EXP-D2..D5 (implementation; D-EXP-D1 visual conformance is
  design-review-owned), D-EXP-F1..F6, D-EXP-B1..B6 — pass.
- Stage E: D-PLN-D1..D5 (implementation), D-PLN-F1..F6, D-PLN-B1..B6 —
  pass. D-PLN-F1 (fresh user without seed) is enabled end-to-end
  (register → empty state → create form → budget); the scripted
  full-browser walk remains for the developer self-test phase.
- Browser-based viewport/screenshot verification (320/390/1024/1440) and
  evidence capture are deferred to the developer self-test phase per the
  skill's Test section; all layout is responsive CSS from the kit's specs.

### What batch 3 (Stages F–G, Insights onward) must know

- **Wiring pattern unchanged**: `createApp` builds
  `budgetRepo`/`transactionRepo`/`budgetService`/`transactionService` and
  threads them through `createApiRouter`. Stage F's `insightsService`
  should follow identically (`createInsightsService({ budgetRepo,
  transactionRepo })`, mounted as `/insights/:month` in
  `routes/index.js`).
- **Route mounting order matters**: `/budgets/:month/transactions` is
  mounted BEFORE `/budgets` in `routes/index.js` so the nested router (with
  `mergeParams: true`) wins; keep new routes above `/budgets` if they share
  the prefix.
- **calc.js already provides** `previousMonth`, `monthRange`,
  `daysInMonth`, and `largestRemainderShares` — Stage F needs no new pure
  helpers except the cash-flow sampling; the shares function is
  kit-verified ([47,18,10,11,14]).
- **transactionRepo** has `sumByCategory(userId, budgetPeriodId)`;
  Stage F additionally needs a per-day aggregation (`GROUP BY occurred_on`)
  — add it to the same factory. Remember `occurred_on::text` (never let pg
  parse dates).
- **Demo seed data** is live in the `public` schema: `demo@example.com` /
  `DemoPass123!` with current+previous months matching the kit insights
  numbers — usable for Stage F manual verification.
- **Integration tests**: give any multi-round-trip test an explicit ≥30 s
  timeout (Neon latency); keep using `startTestServer()` + dynamic imports;
  seed budgets via direct pool inserts or the real `POST /budgets` (now
  available).
- **Client**: `useBudgetQuery(month)` accepts a falsy month (disabled
  query). Query keys in use: `["budget", month]`, `["transactions",
  month]`, `["insights"]`-prefixed keys are already invalidated by every
  expense/plan mutation — name Stage F's query `["insights", month]` to
  benefit. `MonthTabs` (Stage F) is still unwritten; `MonthNav` on the
  Budget screen is a different component (arrows, not tabs).
- **The Insights route placeholder** lives in `client/src/app/router.jsx`
  (`InsightsPlaceholder`); replace it like Stage C replaced the budget one.
- The jsdom `Request` shim in `client/tests/setup.js` is required for any
  test that renders a data router (`createMemoryRouter`) — don't remove it.
- `.workflow/state.json` and `.workflow/sprints/delivery/iteration-01/qa/`
  were modified/created by another role during this batch; they were left
  untouched and uncommitted by the developer.

### Blockers

None. Neon and the npm registry were reachable throughout; no schema or
migration changes were needed beyond Stage A's `001_init.sql`.
