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

