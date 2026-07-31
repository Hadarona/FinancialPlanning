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

## Batch 3 (Stages F–G)

Scope: Stage F (Insights + month comparison, hand-rolled accessible SVG
charts) and Stage G (Responsive completion, accessibility, resilient
experience), per the approved `developer/plan.md`. Branch:
`feature/budgeting-app`. Commits: `fa5b8d7` (Stage F), `c724c41` (Stage G).

### What was built

**Stage F — Insights (commit `fa5b8d7`)**

- API `GET /api/v1/insights/:month` (requireAuth + strict month param):
  one coherent payload — month/previous labels (fixed English table),
  `hasPrevious`, totals, per-category comparison with donut shares via the
  documented largest-remainder rule (always exactly 100), and two
  cumulative cash-flow series sampled at days 1/6/11/16/21/26/last
  (leap-aware clamp). `calc.js` gained `monthName`, `shortDateLabel`,
  `cashFlowSampleDates`, `cumulativeAtDates`; `transactionRepo` gained
  `sumByDay` (`occurred_on::text`, per the batch-2 note). The service runs
  two independent aggregations per month (per-category, per-day) and
  refuses to respond on mismatch (500 + server-side diagnostic only);
  January compares with the previous year's December; a missing previous
  month is an explicit `hasPrevious:false` 200 (null/empty previous
  fields). The independent previous-month lookup runs in parallel with the
  current-month aggregation. EXPLAIN confirms both `GROUP BY` aggregations
  use `transactions_user_period_idx`.
- **Infrastructure bug found and fixed (`server/src/db/pool.js`).** The
  coherence guard intermittently fired ("category total 0 != cumulative
  total 842000"): the Neon DATABASE_URL is the pooled endpoint (pgbouncer,
  transaction pooling), where batch 1's session-level `SET search_path` on
  the pool's `connect` event is unreliable — consecutive autocommit
  queries from one client may run on different backends, and one that
  never saw the SET reads the default schema. Fix: for non-`public`
  (test) schemas, `pool.query` wraps each statement in its own transaction
  (`BEGIN; SET LOCAL search_path …` → query → `COMMIT`), pinning one
  backend per statement. Verified by an 80-iteration repro harness
  (previously failed by attempt 3) and consecutive fully green integration
  runs. `public`-schema (dev/production) behavior unchanged.
- Charts (`client/src/features/insights/charts/`, no chart library): pure
  chart math in `chartMath.js` (nice axis scale, compact "5K" labels,
  donut segment geometry, line points, rounded-top bar paths —
  unit-tested); `BarChart` (grouped pairs; previous-month bars carry a
  diagonal SVG pattern), `DonutChart` (center total; savings segment uses
  kit blue-700 — see deviations), `LineChart` (current solid blue-500,
  previous dashed yellow-500), shared `ChartTooltip` (focus + hover),
  `Legend`, `VisuallyHiddenTable` (real table per chart), measured-width
  rendering (`useMeasuredWidth`) so label text keeps a fixed legible size
  at 320px (bar labels rotate in tight columns; line chart tightens its
  gutter; donut scales 128–200px with fixed-size center text).
- Screen: `MonthTabs` (tablist, roving tabindex, arrow keys; selected
  current = blue/white, selected previous = yellow/near-black),
  `InsightsPage` (hero total + kit "vs 9,180 last month" comparison with
  the amount in yellow-700; honest no-comparison / no-spending states;
  skeleton / 404-create-budget / error-retry states; desktop grid bar 8 /
  donut 4 / line 12; donut+line two-up on mobile only while each column
  keeps ≥150px). `useInsightsQuery(["insights", month])` benefits from the
  existing mutation invalidations. Navigation: Budget menu → "View
  insights"; Insights back arrow + menu → Budget. `AppHeader` generalized
  to `menuItems` + optional back button.
- `docs/agile/reviews/review-3-insights.md`; board/progress-log updated.
- Chart palette validated with the dataviz method: kit blue-500/yellow-500
  pass CVD separation (worst ΔE 27+); the kit yellow's low
  surface-contrast is relieved by the mandated secondary encodings
  (pattern/dash/gaps/labels/tables). Donut adjacency validated (worst
  adjacent pair ΔE 11.4; savings blue-700 vs housing blue-500 ΔE 17).

**Stage G — Responsive/accessibility/resilience (commit `c724c41`)**

- Session expiry (D-RESP-F5): the API client's `session-expired` event now
  has a consumer — AuthProvider drops the cached session and every cached
  private query, ProtectedRoute redirects to
  `/login?reason=session-expired`, LoginPage explains via `role="status"`;
  login/register clear the flag. Insights route code-split (`React.lazy`
  + skeleton-matched fallback). In-app 404 restyled with a route home.
  ErrorState shows an explicit offline hint when `navigator.onLine` is
  false. Viewport audit fix: summary metric values 20px below 360px.
- Error contract (D-RESP-B1/B2): `errorContract.test.js` asserts the
  single envelope (code/message/requestId, matching `X-Request-Id` header,
  no stacks/paths/driver text) for unknown route, malformed path,
  unauthenticated, conflict, invalid body (per-field messages), malformed
  transaction id, and forced 500.
- DB failure (D-RESP-B4): schema dropped under a live server → safe 500
  correlated by requestId in the external error log; `/health` keeps
  serving; process survives. While building this, removed the `public`
  fallback from the schema-scoped pool's search_path: with it, a missing
  test schema silently fell back to real `public` tables (the test
  initially got a 401 because the server "found" `public.users`) — now a
  broken schema fails loudly.
- Graceful shutdown (D-RESP-B5, closes D-FND-B6's process-level proof):
  `shutdown.test.js` spawns the real `node src/index.js`, waits for
  health, sends SIGTERM, asserts "Shutdown complete.", exit 0, port
  refusal, and flushed (not truncated) rotating request logs.
- Accessibility (D-RESP-D3..D6, G3): computed contrast audit in
  `developer/evidence/contrast.md`; in-kit fixes applied (small error text
  and warning banners → coral-700; danger buttons → coral-700; Income
  label → blue-700; Available value → green-600; comparison amount
  19px/700 so yellow-700 clears the large-text bar). `tokens.css` remains
  byte-identical to the kit. Keyboard/zoom/reduced-motion checklist in
  `developer/evidence/a11y-keyboard-checklist.md` with per-row automated
  evidence; heading/live-region sweep done (one h1 per page, alerts and
  status regions associated to inputs).

### Commands run and results (final state)

| Command | Result |
|---|---|
| `npm run lint` | exit 0, no errors/warnings |
| `npm test -w server` | 4 files, 52 tests passed (calc +8 for insights helpers) |
| `npm run test:integration -w server` | 8 files, 46 tests passed against real listening servers + isolated Neon `test_*` schemas (health 3, auth 7, budget 7, transactions 8, plans 6, insights 6, error contract 8, shutdown 1); run twice consecutively green after the pool fix |
| `npm test -w client` | 13 files, 55 tests passed (insights page 7, chart math 12, session expiry/404/offline 4) |
| `npm run build` | exit 0; `InsightsPage-*.js` emitted as a separate lazy chunk |
| End-to-end demo check | real server + seeded `demo@example.com`: `GET /api/v1/insights/2026-07` → July/June, 842000/918000, shares [47,18,10,11,14], cumulative endpoints equal totals |
| EXPLAIN (one-off script) | both insights aggregations use `transactions_user_period_idx` |
| Repro harness (scratchpad, not committed) | pooled-endpoint schema bug: failed by attempt 3 before the pool fix; 80/80 attempts clean after |

Checks were run per-stage before each commit (Stage F suites green before
Stage G started).

### Deviations from the plan (with reasons)

1. **`db/pool.js` schema scoping rewritten (not in the plan).** Plan/batch-1
   mechanism (session `SET search_path` on `connect`) is unsound on Neon's
   pooled endpoint (pgbouncer transaction pooling) — see Stage F notes
   above. Product behavior on `public` unchanged; only isolated-schema
   (test) behavior became deterministic. The extra per-query round trips
   pushed two `budget.test.js` tests past vitest's 5 s default, so that
   file gained the same explicit 30 s timeouts the other integration files
   already had (assertions unchanged).
2. **Donut Savings segment uses kit token blue-700, not the category's
   blue-500.** The kit maps both Housing and Savings to "blue"; identical
   fills meet where the donut ring wraps and would be indistinguishable.
   Same blue family, validated ΔE 17 separation; legend + hidden table
   carry identities regardless. Flagged for design review
   (`review-3-insights.md` #3).
3. **Desktop insights grid follows the responsive-layout spec (bar 8 +
   donut 4, line 12 below) rather than the approved desktop composition's
   full-width bar.** The two kit sources disagree; the spec is the explicit
   normative document and the plan repeats it. Mobile matches the approved
   composition. Flagged for design review (`review-3-insights.md` #7).
4. **Insights perf guard (D-INS-B7) is soft at 500 ms.** Measured 1.6–1.8 s
   over 1,000 transactions against remote Neon (hard cap 2 s per the plan's
   risk #2 — remote latency dominates: every query now carries transaction
   pinning). The soft-budget warning is logged by the test as designed.
5. **Copy/navigation extensions beyond content.json** (same pattern as
   batches 1–2, marked in `lib/copy.js`): chart titles, no-comparison and
   no-data strings, "View insights"/"Back to budget" navigation entries
   (the kit defines no route between Budget and Insights; the mobile
   composition's back arrow motivated the header back button), tooltip
   "<Category/date> — <Month>: <value> USD" wording per the kit checklist's
   category/month/value/unit requirement.
6. **Contrast remedies changed which kit tokens some components consume**
   (coral-700/blue-700/green-600 swaps and the 19px comparison amount —
   full before/after table in `developer/evidence/contrast.md`);
   `tokens.css` itself is untouched. Two kit-internal conflicts were NOT
   silently fixed and are documented for design review instead:
   white-on-blue-500 primary buttons/selected tab (3.60 vs 4.5 — the kit
   mandates the color and its checklist asks for exactly this
   verification) and the 14px yellow-700 "Planned" label (4.17 — no darker
   yellow token exists).
7. **`AppHeader` API changed** from `editBudgetEnabled`/`onEditBudget` to
   generic `menuItems` (+ optional `onBack`) to host the new navigation
   items; BudgetPage behavior is unchanged and covered by existing tests.
8. **Browser-based verification deferred to the developer self-test
   phase** (same recorded deferral as batch 2): viewport screenshot matrix
   (320/390/768/1024/1440), real-browser keyboard walk, 200% zoom, reduced
   -motion emulation, and console-clean checks (D-RESP-F7's browser half).
   All layout is responsive CSS from the kit specs and every mechanism has
   component-test coverage; the a11y checklist marks per-row what is
   automated vs deferred.

### Acceptance check status (developer-owned rows, this batch)

- Stage F: D-INS-D1..D6 (implementation; visual conformance is
  design-review-owned), D-INS-F1..F6, D-INS-B1..B7 — pass via the unit/
  integration/component tests and the end-to-end demo check above.
  D-INS-B7's <500 ms soft budget is a logged warning on remote Neon
  (deviation #4).
- Stage G: D-RESP-D1..D6 (implementation; D-RESP-D1/D3 final call is
  design-review-owned), D-RESP-F1..F6, D-RESP-B1..B5 — pass via the tests
  and evidence docs above. D-RESP-F7 (production build console-clean) is
  built and lint/build-verified; the in-browser console check is part of
  the deferred browser pass (deviation #8).

### What batch 4 (Stages H–I) must know

- **Pool contract**: `pool.query` on non-`public` schemas is now
  transaction-per-statement. If Stage H adds any multi-statement atomic
  flow against a test schema, acquire a client and manage
  `BEGIN; SET LOCAL search_path …`/`COMMIT` manually (see `demoSeed.js` /
  `migrate.js` patterns). Never re-introduce session-level `SET
  search_path` — the pooled endpoint reassigns backends.
- **Integration timing**: expect ~2.5–3 min for the full suite (8 files,
  serial) — the schema-scoping transactions add round trips. Give any new
  multi-round-trip test an explicit ≥30 s timeout up front.
- **Coverage (Stage H)**: charts have fixture-driven component tests
  (chartMath 100% unit-covered); `useMeasuredWidth`'s ResizeObserver
  branch and `ChartTooltip` positioning run only in real browsers — jsdom
  coverage counts the fallback paths. `server/src/index.js` is excluded
  from coverage but now has a real process-level test
  (`shutdown.test.js`).
- **Smoke script (H2)**: `GET /insights/:month` is live; assert the
  coherence triple (Σ categories = total = last cumulative) like
  `insights.test.js` does.
- **Security file inventory (H1)**: new endpoints since batch 2 —
  `/api/v1/insights/:month` (requireAuth; include it in the
  ownership-matrix test).
- **Error contract**: `errorContract.test.js`'s `expectErrorEnvelope`
  helper is reusable for the injection-corpus and 413 tests.
- **Session expiry** is fully wired client-side; Stage I's demo script can
  show it by deleting the cookie.
- `.workflow/state.json` was modified by another role during this batch;
  left untouched and uncommitted, as in batch 2.

### Blockers

None. Neon and the npm registry were reachable throughout; no schema or
migration changes were needed (the pool fix is connection-layer only).

## Batch 4 (Stages H–I)

Scope: Stage H (Security, observability, coverage — roadmap Sprint 7) and
Stage I (Documentation and reproducibility — roadmap Sprint 8), per the
approved `developer/plan.md`. Branch: `feature/budgeting-app`. Commits:
`19fb2b5` (Stage H, the release-candidate commit) and `d17ba8e` (Stage I).

### What was built

**Stage H — Security, observability, coverage (commit `19fb2b5`)**

- `server/tests/integration/security.test.js` (9 tests, real HTTP against
  isolated Neon schemas): helmet headers + hidden `x-powered-by`; CORS
  allowlist (allowed origin gets ACAO + credentials; a foreign origin gets
  no CORS headers on simple requests and failed preflights); oversized body
  → documented 413 envelope; unparseable JSON → 400; five-string injection
  corpus rejected as validation errors (email/month/category) or stored
  verbatim as inert text and round-tripped (note) with the table intact;
  a 7-endpoint ownership matrix (anonymous → 401 `UNAUTHENTICATED`;
  foreign authenticated user → 404 `NOT_FOUND` with zero mutation, owner
  data re-verified); `Secure` cookie flag proven on a real
  `NODE_ENV=production` server instance.
- Hardening fixes that fell out of writing those tests (product code):
  `errorHandler.js` now maps body-parser failures onto the documented
  envelope (`entity.too.large` → 413 `PAYLOAD_TOO_LARGE`,
  `entity.parse.failed` → 400 `VALIDATION_ERROR` — both were opaque 500s);
  `requestId` middleware moved before `express.json` so parse-stage
  failures carry an id; CORS foreign origins get `callback(null, false)`
  (headers withheld) instead of an error that surfaced as a 500.
- `server/tests/unit/logRotation.test.js` (D-SEC-B5): drives the real
  pino/pino-roll path with tiny bounds (paced batches — pino-roll sizes
  per flushed chunk) and proves rotation plus retention (family ≤ keep+1,
  every file within one flush of the size bound). `createLoggers` gained
  optional `logRotateSize`/`logRotateKeep` overrides used only by this
  test; production bounds stay 5 MB × 5.
- `server/scripts/smoke.mjs` (`npm run smoke`, D-SEC-F2): 15 checks
  against a really-running server (`SMOKE_BASE_URL`, default
  `http://localhost:4000`): health + request id → register throwaway user
  → create budget (asserting planned/available math) → add expense →
  budget aggregate delta → insights coherence (Σ categories = total =
  last cumulative; donut shares exactly 100) → delete → rollback → logout
  → me 401. Verified passing (exit 0) against a live server and failing
  (exit 1) with the server down.
- Coverage (D-SEC-F1/B7): thresholds 70/70/70 (branches 60) were already
  enforced in both `vitest.config.js` files; added targeted tests for the
  weakest critical modules — `client/tests/apiClient.test.js` (envelope
  parsing, fallback errors, session-expired dispatch rules, 204 handling,
  `describeAuthError`), `ExpensePanel.test.jsx` (list rendering, per-
  transaction delete naming, empty, error), `TextButton.test.jsx`.
  `vitest.config.js` excluded from server coverage; eslint node-globals
  glob widened to `server/**/*.{js,mjs}` so the smoke script is linted.
- Release review: production bundle marker-scan clean (no
  `DATABASE_URL`/`JWT_SECRET`/connection-string/`console.log|debug`
  matches); `npm audit --omit=dev` 0 critical/high with 2 moderate
  react-router 6.x advisories accepted with rationale; dev-only
  `brace-expansion` highs accepted (never shipped; fix is a breaking major
  bump). Full checklist:
  `developer/evidence/security-checklist.md`. README gained the completed
  mandatory-vs-bonus traceability tables; `ALL_LICENSES.md` verified
  programmatically against all three `package.json` dependency lists (no
  drift). Dead-code sweep: remaining `console.*` uses are operator-facing
  CLI output only (config fail-fast, index bootstrap/shutdown,
  migrate/seed status, ErrorBoundary).

**Stage I — Documentation and reproducibility (commit `d17ba8e`)**

- `docs/api.md`: full REST reference — conventions (cookie auth, request
  ids, strict validation, 32 kb limit, rate limits, calendar-date policy,
  ownership-as-404), the single error envelope + code/status table, and
  every endpoint with sanitized examples matching the integration suite,
  including the budget read-model semantics (negative available, progress
  rounding, `normal`/`overspent`/`unplanned`) and insights coherence
  guarantees.
- `README.md` finalized: clone-to-running steps (npm ci → migrate → dev),
  production-style `SERVE_CLIENT` run, guarded demo seed + credentials,
  backup/reset note, mermaid architecture diagram, data model, env table,
  scripts, testing/coverage summary with final numbers, logging/security
  summary, design-source and agile pointers, completed traceability
  tables, honest known limitations (no expense edit, savings semantics,
  fixed categories, illustrative kit percentages, stateless logout,
  accepted advisories, local-only hosting).
- `docs/demo-script.md` (D-DOC-D*/F*): rehearsed Register → Budget → Add
  Expense → Insights → Comparison (seeded `demo@example.com`) → Logout
  walk, with fallback/recovery notes (server loss, session expiry, missing
  seed, duplicate month, keyboard-only completion) and the pre-demo
  `npm run smoke` health check.
- `server/tests/integration/serveClient.test.js` (D-DOC-F2): with
  `SERVE_CLIENT=true`, `/`, `/login`, `/budget`, `/budget/:month/edit`,
  and `/insights` all serve `index.html` on refresh; real assets serve
  directly; `/api` routes are never swallowed (JSON 404 envelope + live
  health). Uses a stub `client/dist` under a temp `repoRoot`, so the suite
  does not depend on a prior build; the real built app was verified in the
  clean room.
- Board: Stages H and I moved to Done with evidence (all A–I cards Done);
  progress log records both stages and names `19fb2b5` as the release
  candidate.

### Commands run and results (final state, main repo)

| Command | Result |
|---|---|
| `npm run lint` | exit 0, no errors/warnings |
| `npm test -w server` | 5 files, 53 tests passed |
| `npm run test:integration -w server` | 9 files, 55 tests passed (before Stage I; 10 files / 60 tests including `serveClient` verified in the clean room) |
| `npm test -w client` | 15 files, 71 tests passed |
| `npm run build` | exit 0 |
| `npm run coverage -w server` | exit 0 — **96.75% stmts / 92.2% branches / 99.02% funcs** (thresholds 70/60/70 enforced) |
| `npm run coverage -w client` | exit 0 — **84.71% stmts / 82.57% branches / 79.29% funcs** |
| `npm run smoke` (server running on :4000) | 15/15 checks, exit 0; exit 1 verified with the server down |
| Bundle scan / `npm audit` / license check | clean / accepted-with-rationale / no drift (see security-checklist.md) |

### Clean-room validation (I2) — pristine `git clone` of `feature/budgeting-app` at `d17ba8e`

Executed in a fresh clone (scratchpad `cleanroom/`), following only the
README: `cp .env.example .env` + fill `DATABASE_URL`/`JWT_SECRET` (values
supplied by copying the local `.env`; never printed).

| Step | Exit | Notes |
|---|---|---|
| `npm ci` | 0 | single root lockfile |
| `npm run lint` | 0 | |
| `npm test -w server` / `-w client` | 0 / 0 | 53 / 71 tests |
| `npm run test:integration` | 0 | 10 files, 60 tests vs. real Neon test schemas |
| `npm run coverage` | 0 | server 97.11/92.28/99.02, client 84.71/82.57/79.29 (thresholds enforced) |
| `npm run build` | 0 | |
| `npm run migrate` (×2) | 0 / 0 | idempotent ("No pending migrations" on both — schema already live) |
| `ALLOW_DEMO_SEED=true npm run seed:demo` | 0 | deterministic: months 2026-07/2026-06, totals 842000/918000 |
| `PORT=4100 SERVE_CLIENT=true node src/index.js` + `curl /budget` | — | SPA fallback returns the real built `index.html`; `/api/v1/health` live |
| `SMOKE_BASE_URL=http://localhost:4100 npm run smoke` | 0 | 15/15 checks against the production-style server |
| `git status --short` after everything | empty | logs/dist/node_modules/.env all ignored (D-FND-Q2 re-proof) |

### Deviations from the plan (with reasons)

1. **CORS foreign-origin handling changed** (Stage H, product behavior):
   the Stage A implementation surfaced disallowed origins as opaque 500s
   (`callback(new Error(...))`). Now `callback(null, false)` withholds all
   CORS headers — the standard `cors`-package pattern; browsers refuse the
   response and credentialed JSON preflights fail, while SameSite=Lax
   cookies remain the CSRF control. Asserted by two tests.
2. **413/JSON-parse mapping added to `errorHandler.js` and `requestId`
   moved before the body parser.** The plan's error contract documents
   `PAYLOAD_TOO_LARGE` 413, but body-parser errors previously fell through
   as 500s and parse-stage failures had no request id. In-plan-spirit fix
   required by H1's "body limit 413 test".
3. **Log-rotation proof is a committed unit test, not a throwaway script**
   (plan says "in a script"): a permanent test is stronger, repeatable
   evidence and counts toward coverage. It required optional
   `logRotateSize`/`logRotateKeep` fields on `createLoggers`' config
   (defaults unchanged) because pino-roll's 5 MB production bound cannot be
   exercised quickly; the test paces writes because pino-roll evaluates
   size per flushed chunk.
4. **Bundle secret scan and `npm audit` recorded as evidence, not a
   committed script**: one-off verifications with results captured in
   `developer/evidence/security-checklist.md` (the plan's "in a script"
   phrasing satisfied by the documented grep commands there).
5. **Clean-room performed in a pristine temp `git clone`** rather than
   `rm -rf node_modules` in place (plan I2): a clone is strictly more
   pristine (also proves no untracked file is load-bearing) and safer for
   the working tree. Same commands, all recorded above.
6. **`developer/test-report.json` not produced in this batch.** The plan's
   I2 text mentions producing it after the Stage I commit, but the
   assignment scopes this batch to BUILD only and the skill assigns the
   report template to the developer *self-test* phase, which starts next
   and owns executing/recording the full acceptance-check matrix. Nothing
   is lost: every automated proof it needs is committed and indexed here.
7. **Real-browser verification remains deferred to the self-test phase**
   (same recorded deferral as batches 2–3): demo-script browser walk at
   390/1440, viewport screenshot matrix, keyboard/zoom/reduced-motion
   walks, console-clean check (D-RESP-F7 browser half, D-DOC-F1's clean
   browser session). The API-level equivalent of the demo journey is fully
   proven by `npm run smoke` + the clean room.
8. **`npm audit` items accepted, not fixed** (D-SEC-F4 allows accepted
   items with rationale): react-router 6.x moderates are unreachable here
   (no user-controlled navigation targets, no SSR) and fixable only via a
   breaking v7 upgrade; `brace-expansion` highs are dev-tooling-only.
   Full rationale in the security checklist.

### Acceptance check status (developer-owned rows, this batch)

- Stage H: D-SEC-F1..F5, D-SEC-B1..B7 — pass via the tests, scans, and
  clean-install runs above (D-SEC-F5's "from clean install" proven in the
  clean room). D-SEC-D1..D4 are design-review-owned (state inventory
  supplied via README/api.md/demo-script); D-SEC-Q1..Q7 are QA-owned with
  developer enablers in place (traceability matrix, three review records,
  verified ALL_LICENSES, RC commit `19fb2b5` noted in the progress log).
- Stage I: D-DOC-F1..F4 (F1's scripted browser walk deferred per deviation
  #7; F2 proven by test + clean-room curl; F3/F4 by construction and
  documented), D-DOC-B1..B5 — pass per the clean-room table (B3 = smoke,
  B4 = external gitignored rotating logs re-proven, B5 = api.md examples
  match the integration suite). D-DOC-D1..D4 SUB (kit) + demo script;
  D-DOC-Q1..Q7 QA-owned with all developer-provided docs in place.
- Release gates (roadmap §9): every R-* row's proving stage checks are now
  implemented; the self-test phase's `test-report.json` lists them with
  references, per the plan.

### Delivery build complete — starting point for the self-test phase

All nine stages (A–I) of the delivery plan are implemented and committed on
`feature/budgeting-app` (latest: `d17ba8e`). Every automated gate is green
end to end: lint, 53 server unit + 71 client component tests, 60
real-HTTP integration tests (isolated Neon schemas), coverage far above the
enforced ≥70% thresholds (server ~97%, client ~85%), production build,
idempotent migrations, guarded deterministic seed, 15-check smoke against a
production-style `SERVE_CLIENT` server, and a pristine-clone clean room
reproducing all of it from the README alone. What remains for self-test:
the real-browser evidence pass (screenshot matrix 320–1440, keyboard/zoom/
reduced-motion walks, demo-script rehearsal, console-clean check), then
compiling `developer/test-report.json` over the full D-*/R-* acceptance
matrix with statuses and evidence paths.

### Blockers

None. Neon and the npm registry were reachable throughout; no schema or
migration changes were needed in this batch.

## Fix cycle 01 (2026-07-31) — resolve the two self-test findings

Plan: `cycle-01/plan.md`. Inputs: `test-report.json` openIssues
DEV-SELFTEST-001 (medium) and DEV-SELFTEST-002 (low). Both resolved; the
developer report is now `pass` with `openIssues` empty (the findings moved to
`resolvedIssues` with their resolutions).

### DEV-SELFTEST-001 — Insights horizontal scroll at 320px (D-INS-F6, D-RESP-F1, R-FE-1)

Root cause (from the self-test diagnostic): `.visually-hidden` sets
`width: 1px`, but Chromium's automatic table layout treats an explicit width
on a `<table>` as a minimum and sized the three hidden chart tables to
269–335px, pushing the page to scrollWidth 371 at a 320px viewport.

Fix (root-cause, not symptomatic):

- `client/src/features/insights/charts/VisuallyHiddenTable.jsx` — the
  `visually-hidden` class now sits on a new `<div>` wrapper instead of the
  `<table>`. A block wrapper honors `width: 1px` + `overflow: hidden`, so it
  clips the table out of the layout entirely; the table's
  caption/`th scope` semantics are untouched, preserving the screen-reader
  data view (D-INS-F4).
- `client/src/styles/global.css` — documented the table pitfall on the
  `.visually-hidden` comment and added
  `.visually-hidden table, table.visually-hidden { table-layout: fixed; width: 1px; }`
  as defense in depth so cell content can never drive min-content sizing.
  Honest caveat recorded in the comment: Chromium still widens the table
  wrapper box to a nowrap `<caption>`'s width, so the 1px clipped wrapper is
  the load-bearing containment (measured: table box still ~335px *inside*
  the wrapper, wrapper 1px, page scrollWidth exactly 320 — no propagation).
- `client/tests/InsightsPage.test.jsx` — new regression test
  ("keeps hidden chart tables out of the layout width") asserting the
  structural contract jsdom can verify: all three chart tables never carry
  the class themselves, always sit inside a `div.visually-hidden` wrapper,
  and keep caption + column/row-header semantics. The real layout claim is
  proven by DOM measurement (below), since jsdom computes no layout.

Verification (Chromium via the scratchpad Playwright install, real UI login
with seeded demo data, `SERVE_CLIENT=true` server on port 4050):
`document.scrollingElement.scrollWidth` is exactly **320 on Login, Budget,
and Insights** at a 320px viewport (was 371 on Insights), all
`.visually-hidden` wrappers measure 1px, zero pageerrors. Evidence:
`cycle-01/evidence/insights-320-recheck.json` +
`cycle-01/evidence/screenshots/{login,budget,insights}-320-cycle01.png`.

### DEV-SELFTEST-002 — `npm run format:check` exits 1 (D-SEC-F5/R-QE-1 adjacent)

Decision: conform the writable files to the repo's own declared style
contract (`.prettierrc.json`, printWidth 90) rather than hide product files
behind ignore entries, and ignore only what the developer must not rewrite.

- New `.prettierignore` with per-entry justification: `.workflow/`
  (phase-owned role reports/evidence), `tools/` (orchestrator-owned
  controller), `docs/design/`, `docs/product/`, `docs/workflow/`,
  `Project_requirements_English.md` (read-only sources per CLAUDE.md's
  ownership table; the figma-kit export must stay byte-identical),
  `CLAUDE.md` (governance doc, byte-stable), and
  `client/src/styles/tokens.css` (must stay byte-identical to
  `docs/design/figma-kit/tokens/design-tokens.css` per D-FND-D1 — formatting
  it would silently break the verbatim-copy invariant).
- `npx prettier --write .` then reformatted **66 files** (all 32 flagged
  product source files under `server/` and `client/`, developer-owned tests,
  scripts, and developer-authored docs). `npm run format:check` now exits 0.
- Zero behavior change verified: unit/component suites green immediately
  before the rewrite, and the **full** suite green after it (below);
  `git diff` is whitespace/line-wrapping only.

### Cycle-01 check suite (all from the repo root, after both fixes)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | 0 | pass |
| `npm run format:check` | 0 | pass (was 1) |
| `npm test -w server` | 0 | 53 tests |
| `npm run test:integration -w server` | 0 | 60 tests (real HTTP, isolated Neon schemas) |
| `npm test -w client` | 0 | 72 tests (71 + 1 new regression guard) |
| `npm run coverage` | 0 | server 97.06/92.3/99.02; client 85.19/82.57/79.29 |
| `npm run build` | 0 | production build clean |
| `npm run smoke` (running server, port 4050) | 0 | 15/15 checks |
| `npm run workflow:validate` | 0 | `{"ok":true,"errors":[],"warnings":[]}` |
| `npm audit --omit dev` | 1 | only the 2 accepted moderate react-router advisories (unchanged) |
| Playwright 320px re-check (Login/Budget/Insights) | 0 | scrollWidth 320 everywhere, pass |

### Deviations and housekeeping

- No plan deviations; both tasks executed as written in `cycle-01/plan.md`.
- The cycle's server (port 4050) was stopped afterward; demo seed re-run
  (exit 0) before the browser pass.
- Untouched, per constraints: `.workflow/state.json`, `qa/`, design areas,
  `tools/`. `DATABASE_URL`/`JWT_SECRET` never printed or logged.
