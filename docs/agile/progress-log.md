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
commit was run and observed failing, then the expectation was corrected in
the following commit. Commit references are recorded below once made.

<!-- Commit references appended after the corresponding git commits: -->

## Stage B — Auth

<!-- Appended when Stage B is committed. -->
