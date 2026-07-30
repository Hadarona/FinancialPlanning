# Progress Log

Repo-only substitute for sprint ceremonies (see `developer/plan.md` →
"External-tool substitutions"). One entry per build stage, appended at the
matching commit.

## Stage A — Foundation

**Architecture.** npm workspaces monorepo (`client/`, `server/`) in one repo,
one eventual PR. Server: Express + `pg` against Neon Postgres, `pino` +
`pino-roll` structured/rotating logs, `zod` validation. Client: Vite + React
+ React Router + TanStack Query, hand-rolled SVG charts (no chart library —
keeps license/audit surface minimal and gives full control over
keyboard-focusable data points and dashed-line semantics required later for
insights). See `developer/plan.md` → "Architecture reference" for the full
rationale and package table.

**Data model decision (#7 — fixed category set).** The five budget
categories (Housing, Groceries, Transport, Fun, Savings) are a constant
(`server/src/domain/categories.js`, mirrored in `client/src/lib/categories.js`),
not a user-editable table. Only `plannedMinor` (per category, inside a
budget's own `categories` JSONB column) and `incomeMinor` are ever editable.
This means "a category with transactions" can never be orphaned — there is
no delete-category operation to guard against. Stored as JSONB on
`budget_periods` rather than a normalized categories table, since the set
never varies per user.

**Currency decision (#1).** USD, no displayed symbol, `1,234` formatting.
All money is stored and computed as integer minor units (cents) end to end;
no floating-point currency arithmetic anywhere. Client input parsing uses
string splitting (`client/src/lib/money.js`), never `parseFloat`.

**Testing strategy.** Real HTTP integration tests only (no `supertest`):
`server/tests/integration` starts the actual Express app with `listen(0)`
and drives it with Node 20's built-in `fetch`, against an isolated Postgres
schema (`test_<timestamp>_<pid>_<random>`) created and migrated on the same
Neon database referenced by `DATABASE_URL`, then dropped on teardown.
`public` data is never touched by tests. Coverage thresholds (≥70%
lines/statements/functions, ≥60% branches) are enforced via
`vitest --coverage` in both workspaces.

**Intentional-failure exercise (D-FND-Q4).** To demonstrate the test harness
actually catches regressions (not just passes trivially), `server/src/services/calc.js`
was introduced with its first pure function, `previousMonth`, together with
a unit test that initially asserted a deliberately wrong expectation. That
commit was run and observed failing (`npm test -w server` — 1 failed, 21
passed), then the expectation was corrected in the following commit.

- Commit `5736938` — `test(server): add calc.previousMonth with an
  intentionally wrong expectation` — red (`npm test -w server` failed: 1
  test).
- Commit `d99bf9d` — `Stage A: Foundation — …` — includes the fix (green:
  `npm test -w server` passed, 22 tests) plus the rest of Stage A.

**Stage A commit scoping (recorded deviation).** `server/src/app.js` and
`server/src/routes/index.js` are committed in Stage B, not Stage A, even
though they are Stage A files per the plan's file layout. Reason: wiring
Stage B's DB-backed auth surfaced two pre-existing infrastructure bugs
(below) that required changing these two files' dependency-wiring pattern;
splitting the change across two commits would have meant committing a
known-broken intermediate version. Stage A's own acceptance checks (health
endpoint, structured logging, forced-error handling, env fail-fast) were
independently verified against a temporarily-reverted, Stage-A-only version
of both files before Stage B implementation began (see build-report.md).

## Stage B — Auth

**Auth implementation.** `bcryptjs` password hashing, `jsonwebtoken` HS256
sessions (24h) in an HTTP-only `SameSite=Lax` cookie (`bb_session`, `Secure`
in production), generic `UNAUTHENTICATED` error for both unknown-email and
wrong-password login attempts (one bcrypt compare always runs, against a
precomputed dummy hash when no user exists, to equalize timing), and a
strict `express-rate-limit` limiter on `/auth/*` separate from the general
limiter.

**Infrastructure bugs found and fixed while wiring Stage B (see
`docs/agile/reviews/review-1-auth.md` for full detail):**

1. An eagerly-created module-level `config` singleton locked in
   `process.env` at first import, before test-specific `DB_SCHEMA`/`LOG_DIR`
   overrides were set, silently defeating test isolation. Fixed by removing
   the singleton (`config.js` now only exports `loadConfig()`) and turning
   `db/pool.js` and `logging/logger.js` into per-call factories.
2. Neon's pooled connection endpoint rejects the `options=-c search_path=…`
   startup parameter. Fixed by setting `search_path` via a `SET` query on
   the pool's `connect` event instead.
3. A bare (non-transactional) `SET search_path` on a plain `pg.Client` can
   silently fail to apply under concurrent connection establishment against
   Neon's pooled endpoint, observed as `server/src/db/migrate.js` migrating
   the wrong (`public`) schema under concurrent test runs (`npm run
   coverage`, which does not pass `--no-file-parallelism`). Fixed by
   wrapping the whole migration run in one transaction with `SET LOCAL`.
4. The test harness itself mutated the shared `process.env` to pass
   per-test overrides to the next dynamic import, which raced when two test
   files' `beforeAll` hooks interleaved. Fixed by building a local env
   object instead of writing to `process.env`.

All four are infrastructure/test-harness fixes, not product-behavior
changes; auth business logic was unaffected. Verified via a direct
concurrent-`migrate()` repro (3/3 runs succeeded after the fix) and a full
`npm run coverage -w server` run (32/32 tests passed, 83.5% line coverage on
the Stage A/B code so far — coverage itself is a Stage H gate, recorded here
only as a positive signal).

- This commit (`Stage B: Auth — …`) — see build-report.md for the full
  verification log and its hash once recorded.

## Stage C — Budget read model

**Read model.** `GET /api/v1/budgets/:month` (strict `YYYY-MM` validation)
returns a fully server-computed read model: `plannedMinor` = Σ category
plans, `availableMinor` = income − planned (may go negative — over-allocation
is allowed per decision #2), per-category `actualMinor` from a
`SUM(amount_minor) GROUP BY category_id` over the authenticated user's
transactions only. Progress rule (decision #10): `Math.round(actual/planned
× 100)`; a zero-plan category never divides by zero — `progressPercent` is
`null` and the state is `unplanned` when money was spent. States: `normal` |
`overspent` (>100 preserved) | `unplanned`. Ownership: every repo query
filters `user_id`; a month owned by another user is indistinguishable from a
missing one (404).

**Demo seed (guarded, deterministic).** `npm run seed:demo` refuses unless
`ALLOW_DEMO_SEED=true` and `NODE_ENV !== 'production'` (verified both
refusals). Creates/refreshes only `demo@example.com` (cascade delete + fresh
insert, idempotent — verified two consecutive runs) with budgets for the
current and previous calendar months; fixed expense lists reproduce the
authoritative kit totals: current 842,000 minor units, previous 918,000.
Recorded decision (plan risk #1): with one coherent dataset the Budget
progress bars show ~99/101/105/103/39%, not the illustrative kit percentages
— content.json §2.2 totals win.

**Budget screen.** `features/budget/BudgetPage.jsx` with four states
(skeleton / empty "No budget for <Month> yet" + Create action / error +
retry that keeps the authenticated shell / data), `SummaryMetrics` (Income /
Planned / Available with the kit's semantic colors, over-allocation warning
with icon + text), `CategoryRow` (tinted icon circle, planned amount, 8px
progress track, screen-reader sentence "Housing: 2,520 spent of 4,000
planned, 63%", overspent/unplanned flagged by icon + text — never color
alone). Add-expense button rendered disabled until Stage D wires the dialog.

## Stage D — Expenses

**API.** `POST/GET /budgets/:month/transactions`, `DELETE …/:id`. The budget
is always resolved by `(authenticated user id, month)` first; category ids
are validated against that budget's fixed set; date membership in `:month`
is a pure string comparison against the calendar bounds (decision #6), which
also rejects impossible days. Non-positive/non-integer/malformed amounts and
oversized notes are rejected without mutation. Duplicate-submission
protection (decision #8): a client-generated `clientRequestId` UUID hits the
partial unique index and the retry gets the existing row back with 200 — one
row, ever. Deletes of missing, unowned, or malformed ids all share one 404
body (no existence/ownership leak). History ordering is deterministic
(`occurred_on DESC, created_at DESC, id DESC`) with enforced limit bounds
(1–200, default 50). Notes never reach the logs (metadata-only logging,
asserted by test).

**UI.** Shared `Dialog` (portal, `aria-modal`, focus moved in / trapped /
returned to opener, Escape closes; bottom sheet <768px, centered 480px card
above). `AddExpenseDialog` string-parses amounts to integer cents, offers
the five fixed categories with icons, bounds the date input to the month,
counts note characters, keeps all values with a Retry on failed save, and
generates one `clientRequestId` per submission attempt-set. `ExpensePanel`
lists recent expenses with delete buttons whose accessible names identify
the exact transaction; `DeleteExpenseConfirm` requires explicit,
transaction-naming confirmation. Successful add/delete invalidates the
budget/transactions/insights queries so progress recalculates without a
reload, and announces via a `role="status"` live region.

**Bug found by the component tests (fixed).** The dialog's focus effect
originally depended on the `onClose` prop identity, so every keystroke
re-ran it and yanked focus back to the first field. See
`docs/agile/reviews/review-2-expenses.md` finding #1.

## Stage E — Plans + month navigation

**API.** `POST /budgets` and `PATCH /budgets/:month`. The client only ever
sends `{id, plannedMinor}` pairs — the stored categories are rebuilt from
the server-side constants, so names/icons/colors/order cannot be altered and
the fixed set can never shrink (decision #7, D-PLN-B5). Creation strictly
requires exactly the five default ids, each once; duplicate months are
decided by the DB unique constraint, so concurrent duplicate creates resolve
as one 201 + one 409 (verified with two parallel HTTP requests). Patches
merge income and/or a subset of plans and return the freshly recalculated
read model. Over-allocation is accepted with a negative `availableMinor`
(decision #2). Cross-user patching is a 404; creation is bound to the
session user by construction (no user field in the body).

**UI.** `BudgetFormPage` (routes `/budget/new?month=` and
`/budget/:month/edit`): income + five single-column category rows (icon +
labelled input, no dense grids at 320px), a live "Planned X · Available Y"
footer recomputed per keystroke from string-parsed cents, an over-allocation
warning (icon + text, saving still allowed), 409 recovery message linking to
the existing month, and an unsaved-changes guard — `beforeunload` plus a
router blocker with an explicit Keep editing / Discard changes dialog.
Create prefills the kit defaults; edit prefills stored values and PATCHes
all five plans. `MonthNav` (prev/next arrows + month-year label) drives
`/budget?month=` navigation; a month without a budget shows "No budget for
<Month> yet" with a Create action wired to the form. The header menu's "Edit
budget" item is now enabled whenever a budget is loaded.

**Test-harness note.** Component tests for the router blocker required a
data router (`createMemoryRouter`); vitest's jsdom environment injects
jsdom's `AbortController` while keeping Node's undici `Request`, whose brand
check rejects cross-realm signals and crashed every data-router navigation.
A test-setup-only `Request` shim drops the foreign signal (impossible in a
real browser — single realm); no product code changed.


## Stage F — Insights + month comparison (Sprint 5)

**API.** `GET /api/v1/insights/:month` (auth + strict month validation)
returns one coherent payload: month/previous-month labels, totals,
per-category comparison with donut shares, and two cumulative cash-flow
series sampled at days 1/6/11/16/21/26/last. Shares use the documented
largest-remainder rounding (decision #10) and always total exactly 100.
The service aggregates each month twice (per category, per day — both
`GROUP BY` queries covered by `transactions_user_period_idx`, verified via
EXPLAIN) and refuses to serve an incoherent response. January compares with
the previous year's December; a missing previous month is an explicit
`hasPrevious: false` (200, previous values null/empty), never a 500. Other
users' transactions can't enter the aggregation (user-scoped repo queries;
integration-tested with two users on identical months). A 1,000-transaction
perf guard logs a soft <500 ms budget and hard-fails above 2 s.

**Charts.** Hand-rolled SVG per the plan (no chart library): grouped bar,
donut, and cash-flow line. Kit semantics: current month solid blue-500,
previous month yellow-500 with a diagonal-line pattern (bars) or dashed
stroke (line) so series never differ by color alone. Every data mark is
keyboard-focusable with a tooltip (category/date — month: value USD) and
each chart carries a visible data-derived text summary plus a
visually-hidden real table. Charts render at measured container width so
labels stay legible at 320 px; category labels rotate in tight columns; the
donut scales 128–200 px with fixed-size center total. Savings' donut
segment uses blue-700 (kit token) because the kit gives Housing and Savings
the same blue — recorded for design review (`review-3-insights.md`).

**Screen.** Month tabs (`role=tablist`, arrow-key selection, selected
current = blue/white, selected previous = yellow/near-black), hero total
with the kit's "vs 9,180 last month" comparison (amount in yellow-700 for
AA contrast), no-comparison and no-spending states that never fabricate a
zero-change claim, loading skeletons, 404 → create-budget empty state,
error → retry. Selecting a tab refetches `/insights/<month>` so the title,
hero, all three charts, legends, and summaries update together. Grid: bar 8
/ donut 4 / line 12 on desktop per the responsive spec; donut+line two-up
on mobile only while both columns keep ≥150 px.

**Infrastructure bug found and fixed (`server/src/db/pool.js`).** The
service's coherence guard intermittently returned 500 with "category total
0 != cumulative total 842000" — one of two concurrent aggregation queries
ran against the wrong schema. Root cause: the Neon DATABASE_URL is the
pooled endpoint (pgbouncer, transaction pooling), where the batch-1
session-level `SET search_path` on the pool's `connect` event is silently
unreliable: autocommit queries from one client can run on different server
backends, and a backend that never saw the SET reads the default schema.
Fix: for non-`public` (test) schemas, `pool.query` wraps every statement in
its own transaction with `SET LOCAL search_path`, pinning one backend per
statement. Proven with an 80-iteration repro (failed by attempt 3 before)
and two consecutive fully green integration runs; `public`-schema behavior
(dev/production) is untouched. Fallout handled: explicit 30 s timeouts
added to `budget.test.js` (the extra round trips per query pushed two tests
past vitest's 5 s default), and the insights service parallelizes its
previous-month lookup with the current-month aggregation (perf guard
1.6–1.8 s per 1,000 tx on remote Neon, inside the 2 s hard cap; <500 ms
soft budget logged as anticipated by plan risk #2). End-to-end demo check
against a real server returned the exact kit numbers (842,000 / 918,000,
shares 47/18/10/11/14).

## Stage G — Responsive completion, accessibility, resilience (Sprint 6)

**Frontend recovery.** Session expiry (D-RESP-F5): a 401 on any private
call raises `session-expired`; AuthProvider drops the cached session and
every cached private query (no stale private data can re-render),
ProtectedRoute redirects to `/login?reason=session-expired`, and the login
screen explains why (`role="status"`); a successful sign-in clears the
flag. The Insights route is now code-split (`React.lazy` + a
skeleton-matched Suspense fallback — no layout shift). The 404 page uses
the shared state-panel styling with a link home. ErrorState adds an
explicit offline hint when `navigator.onLine` is false. Viewport audit fix:
summary metric values step down to 20px below 360px so "12,500" cannot
clip at 320px.

**Backend consistency.** New `errorContract.test.js` proves one error
envelope (code/message/requestId + matching `X-Request-Id`, no stack
traces, no driver text) across every failure class: unknown route 404,
malformed path 400 + fieldErrors, missing session 401, duplicate month
409, invalid body 400 with per-field messages, malformed transaction id
404, forced internal 500. DB-failure path (D-RESP-B4): dropping the schema
under a live server yields a safe 500 whose requestId appears in the
external error log, while `/health` keeps answering — the process never
crashes. New `shutdown.test.js` (D-RESP-B5, D-FND-B6): a real spawned
`node src/index.js` receives SIGTERM, prints "Shutdown complete.", exits
0, releases its port, and leaves flushed (not truncated) request logs.
While building the DB-failure test, removed the `public` fallback from the
schema-scoped pool's `SET LOCAL search_path`: with the fallback, a missing
test schema silently read real `public` data instead of failing loudly —
a test-isolation hazard.

**Accessibility.** Full computed contrast audit recorded in
`developer/evidence/contrast.md`. In-kit fixes applied: small error text
coral-600→coral-700 (4.04→6.24), warning banners on coral-50 (3.88→5.99),
danger buttons coral-700 (white label 4.28→6.62), Income metric label
blue-500→blue-700 (3.60→6.94), Available value green-500→green-600
(2.70→3.70 large), insights comparison amount sized 19px/700 so
yellow-700's 4.17 clears the large-text bar. `tokens.css` untouched
(byte-identical kit copy). Two kit-inherited deviations documented for
design review instead of silently changed: white-on-blue-500 primary
buttons/tab (3.60 vs 4.5; kit mandates the color and its checklist asks
for exactly this check) and the 14px yellow-700 "Planned" label (4.17; no
darker yellow exists in the palette). Keyboard/zoom/reduced-motion
checklist recorded in `developer/evidence/a11y-keyboard-checklist.md`
(automated coverage cited per row; real-browser walks deferred to the
developer self-test phase, as in batch 2).

## Stage H — Security, observability, coverage (Sprint 7)

**Security tests.** New `security.test.js` proves the Stage H checklist over
real HTTP: helmet headers (+ hidden `x-powered-by`), CORS allowlist (allowed
origin gets credentials, a foreign origin gets no CORS headers on simple and
preflight requests), oversized body → documented 413 envelope, unparseable
JSON → 400 (both newly mapped in `errorHandler.js`; `requestId` middleware
moved before the body parser so even parse failures carry an id), an
injection corpus rejected as validation errors or stored verbatim as inert
text (parameterized queries), a 7-endpoint ownership matrix (anonymous → 401,
foreign authenticated user → 404 with zero mutation), and `Secure` on the
session cookie under a real `NODE_ENV=production` server. CORS hardening:
foreign origins now get `callback(null, false)` (headers withheld) instead of
surfacing as an opaque 500.

**Observability.** `logRotation.test.js` drives the production pino/pino-roll
path with small bounds and proves rotation + retention bound file growth
(`createLoggers` gained optional test-only bound overrides; production stays
5 MB × 5). Log-content redaction proofs from stages A–G remain green.

**Coverage and smoke.** Coverage thresholds (70/70/70 lines/statements/
functions, 60 branches) have been enforced in both vitest configs since
Stage A and now gate comfortably: server 96.8%/92.2%/99.0%, client
84.7%/82.6%/79.3% (stmts/branch/funcs). Added focused tests for the
previously weakest critical modules: `api/client.js` (envelope parsing,
session-expired dispatch rules, fallback errors), `ExpensePanel` (list,
delete naming, empty, error states), `TextButton`. New
`server/scripts/smoke.mjs` (`npm run smoke`) runs register → create budget →
add expense → aggregate delta → insights coherence (Σ categories = total =
last cumulative; donut shares = 100) → delete → rollback → logout against a
really-running server: 15/15 checks, exit 0 (exit 1 verified when the server
is down).

**Release review.** Production bundle scanned for secret markers and debug
logging (clean). `npm audit --omit=dev`: 0 critical/high, 2 moderate
react-router 6.x advisories accepted with rationale; dev-only
`brace-expansion` highs accepted (never shipped) — full rationale in
`developer/evidence/security-checklist.md`. README now carries the completed
mandatory-vs-bonus traceability tables; `ALL_LICENSES.md` re-verified against
all three `package.json` files (no drift). This commit is the release
candidate for the delivery gate.

## Stage I — Documentation and reproducibility (Sprint 8)

Release candidate from Stage H is commit `19fb2b5`.

**Docs.** `docs/api.md` finalized: every endpoint with sanitized examples
from the integration suite, the single error envelope, status-code table,
money/date/ownership conventions, and the SERVE_CLIENT static-serving
contract. `docs/demo-script.md`: the rehearsed Register → Budget → Add
Expense → Insights → Comparison → Logout walk with fallback/recovery notes
and the seeded `demo@example.com` comparison beat. README rewritten as the
final delivery document: clone-to-running steps (verified by executing them
in a pristine temp clone), production-style `SERVE_CLIENT` run, guarded demo
seed, backup/reset note, mermaid architecture diagram, data model, env
table, testing/coverage summary with final numbers, logging/security
summary, design-source pointers, agile-process pointers, the completed
mandatory-vs-bonus traceability tables, and honest known limitations.

**Reproducibility proof.** New `serveClient.test.js` proves the SPA
fallback: `/`, `/login`, `/budget`, `/budget/:month/edit`, `/insights` all
serve index.html on refresh while `/api` routes keep their JSON contract
and real assets serve directly. Clean-room validation executed in a fresh
`git clone` of this branch with only the documented setup steps (see the
batch-4 build report for the full command/exit-code log): npm ci, lint,
unit + component tests, real-HTTP integration suite, coverage (thresholds
enforced), production build, idempotent migrate, guarded deterministic
seed, then a SERVE_CLIENT production-style server and `npm run smoke`
(15/15 checks). Real-browser demo walks and screenshots remain with the
developer self-test phase, as in every prior batch.

Delivery build complete: stages A–I implemented, all automated checks
green. Next: developer self-test phase, then QA and design review.
