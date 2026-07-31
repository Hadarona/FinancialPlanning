# Build Report — delivery-2, iteration 01 (CR-001)

BUILD phase execution of `developer/plan.md` (24 tasks, stages A–H) on
branch `feature/budgeting-app`. All checks below are scoped to
**developer-owned** suites; QA-owned suites (`server/tests/qa/**`,
`client/tests/qa/**`) were NOT edited and are expected red (list below).

## Commits

| Commit | Scope |
| --- | --- |
| `acd007f` | Stages A–D: migration 002, domain, repos/services, API contract, demo seed |
| `7133f65` | Stages E–F: client constants/hooks, popups, multiselect, charts, form-flow removal |
| (final)  | Stages G–H: developer tests, smoke journey, docs (this commit) |

## Per-task status

### Stage A — schema and domain

- **Task 1 — `002_single_budget.sql`: done.** Creates `budgets`
  (UNIQUE user_id), latest-month-wins backfill + 7-category extension,
  default-budget backfill for user rows without periods, per-user
  `client_request_id` dedupe, index re-scope to
  `(user_id, client_request_id)`, drops `budget_period_id` and
  `budget_periods` — one transaction (migrate.js wraps the run).
  Verified: fresh scratch schema (001+002 applied, second run applies
  nothing) AND the real dev DB transform (35 users → 35 budgets × 7
  categories, 1,134 transactions kept, `budget_periods` gone); second
  `npm run migrate` run: "No pending migrations" (exit 0).
- **Task 2 — `domain/categories.js`: done.** `subscriptions` (Repeat/coral/
  6/60000) + `utilities` (Plug/green/7/120000); `DEFAULT_INCOME_MINOR =
  1250000` exported and shared by registration/backfill/defensive-create/seed.

### Stage B — repositories and services

- **Task 3 — `budgetRepo`: done.** `findByUser` / `createBudget` /
  `updateBudget`, all keyed by `user_id`; 23505 surfaces to the service.
- **Task 4 — `transactionRepo`: done.** All monthly queries take
  `{ firstDay, lastDay }`; `listByRange`/`countByRange`; insert drops
  `budgetPeriodId`; 23505 recovery selects on `(user_id, client_request_id)`;
  delete keeps month scoping via the range.
- **Task 5 — `calc.js`: done.** `summarizeBudget` no longer emits `month`;
  new `monthReadModel(budgetRow, month, actuals)`; new `budgetPlanModel`
  (plans-only model for `GET /budget` — see Deviations D1).
- **Task 6 — `budgetService`: done.** `getBudget` (plans only),
  `createDefaultBudget` (23505 → 409 "You already have a budget."),
  `patchBudget` (merge over 7), `getMonthReadModel`.
- **Task 7 — `transactionService`: done.** `resolveBudget(userId)`; category
  check over 7; month scoping via `monthRange`.
- **Task 8 — `insightsService` + `authService` + `app.js`: done.**
  `getInsights(userId, months)` with newest-first normalization, parallel
  per-month aggregation, per-month coherence check, combined
  largest-remainder shares; `register` provisions the default budget
  (simple sequential version per plan, defensive-path test added);
  factory wiring ordered budgetService → authService.

### Stage C — API contract

- **Task 9 — schemas: done.** `createBudgetSchema` deleted; `emptyBodySchema`
  (`z.object({}).strict().optional()` — optional because Express leaves
  `req.body` undefined when no JSON body is sent); `patchBudgetSchema` max 7;
  `insightsQuerySchema` (required, 1–3, unique, strict).
- **Task 10 — routes: done.** `/budget` (GET/POST/PATCH), new
  `monthRoutes.js` (`GET /months/:month`), insights `GET /` with
  `validateQuery`, transactions mounted at `/months/:month/transactions`
  BEFORE `/months`. (`validateQuery` middleware already existed — no new
  middleware needed.)
- **Task 11 — controllers: done.** `budgetController`
  getBudget/createBudget/patchBudget/getMonth; `insightsController` reads
  `req.validatedQuery.months`; no logging changes.
- **Checkpoint C:** server booted; curl smoke of all new endpoints with a
  demo session; sanitized captures under
  `developer/evidence/api-captures/*.json` (used for docs/api.md examples).
  Verified 409 on duplicate POST /budget, 404 on removed `/budgets/:month`
  routes, 201+budget on fresh registration, expense in `subscriptions`.

### Stage D — demo seed

- **Task 12 — `demoSeed.js` + `demoSeedData.test.js`: done.** One `budgets`
  row; day-18 housing "Utilities" reassigned to `utilities`; day-4 groceries
  split into groceries + `subscriptions` 15,000 in both months. Monthly
  totals 842,000 / 918,000 and the per-day cumulative series preserved
  (locked by the data test in three month lengths). Seed run on dev DB:
  exit 0, summary printed (no connection info).

### Stage E — client API layer and constants

- **Task 13 — `lib/categories.js` / `lib/icons.js`: done.** 7-category
  mirror; `Repeat`, `Plug` imported (same Lucide outline family).
- **Task 14 — `api/hooks.js`: done.** `useMonthQuery`,
  `usePatchBudgetMutation`, `useCreateBudgetMutation` (no-body POST),
  `useInsightsQuery(months)` (enabled 1–3, key joins months), transaction
  paths → `/months/...`; `useBudgetQuery`/`useUpdateBudgetMutation` removed
  (plan default: skip plans-only query — popups read the month model).

### Stage F — client UI

- **Task 15 — `EditIncomeDialog` + `EditCategoryPlanDialog`: done.** Reuse
  `Dialog` (trap/Esc/labelled/focus-return proven), prefill via
  `minorToInputValue`, parse via `parseMoneyToMinor`, live preview lines,
  pending-disabled Save, server fieldErrors inline, success announced via
  the page status region. Shared `EditBudgetDialogs.css` (see Deviations D2).
- **Task 16 — `SummaryMetrics`: done.** Income value is a 44×44+ button with
  aria-label "Edit income, current value …", hover + :focus-visible;
  Planned/Available remain plain `<dd>` text.
- **Task 17 — `CategoryRow`: done.** Full-width row button, aria-label =
  progress sentence + ", edit planned amount"; ProgressBar gained a
  `decorative` mode so the button's accessible name is not duplicated by a
  nested progressbar (see Deviations D3); hover/:focus-visible added.
- **Task 18 — `BudgetPage`: done.** `useMonthQuery`, 7 skeleton rows, both
  dialogs wired with status announcements, "Edit budget" menu item removed,
  Insights menu → `/insights` (no month param), defensive NOT_FOUND empty
  state → `POST /budget` and refetch.
- **Task 19 — form flow removed: done.** `BudgetFormPage.jsx/.css` deleted;
  `/budget/new` + `/budget/:month/edit` routes removed (fall through to
  NotFound); dead `copy.plan` strings pruned (MonthNav's
  previous/nextMonthLabel kept); new `copy.budget` + `copy.insights`
  strings added; grep confirmed no dangling imports.
- **Task 20 — Insights multi-select + charts: done.**
  `MonthMultiSelect` (trigger + `role="listbox"` `aria-multiselectable`,
  roving `aria-activedescendant`, ArrowUp/Down/Home/End/Space/Enter/Esc/Tab,
  click-outside close, max-3 disable + "Select up to 3 months" hint, min-1
  refusal + "Select at least 1 month" hint, both visible and in an
  `aria-live="polite"` region, options ≥44px); InsightsPage rewritten
  (URL-synced `?months=`, default current month, per-month hero totals,
  zero-month note, defensive 404 empty state); BarChart grouped 1–3 bars
  (plain/diagonal/dotted patterns, computed bar widths ≥6px, rotated labels
  at narrow widths); LineChart 1–3 series (solid/dashed/dotted, shared
  7-position axis, day-position labels when >1 month); DonutChart combined
  shares; chartColors 3-slot series arrays + subscriptions coral-700 /
  utilities green-700; Legend pattern swatches; hidden tables one column per
  month; `MonthTabs.jsx/.css` deleted (no remaining importers).

### Stage G — developer-owned tests

- **Task 21 — server unit: done.** `calc.test.js` (7-category fixture, no
  month, `monthReadModel` + `budgetPlanModel` suites), `schemas.test.js`
  (emptyBody, patch max-7, insightsQuery matrix), `demoSeedData.test.js`
  (new totals + new-category presence + 7-id set), `authService.test.js`
  (budget provisioning called/propagates/skipped-on-conflict).
  `authMiddleware`/`logRotation` untouched.
- **Task 22 — server integration: done.** `budget.test.js` rewritten
  (/budget + /months/:month, identical plans across months, defensive
  404→POST recovery, unique-user DB check); `plans.test.js` rewritten
  (single-budget lifecycle: 409, concurrent create 201+409, patch semantics
  over 7, concurrent patches, validation matrix incl. old `month` key,
  ownership, over-allocation); `transactions.test.js` (paths → /months, no
  pre-created budgets, cross-month idempotency (CR1-12), new-category
  expenses, wrong-month delete 404); `insights.test.js` rewritten
  (?months= 1/2/3, normalization, 400 matrix, per-month coherence,
  zero-month zeros, cross-year, ownership, 3-month perf); `errorContract`
  (new inventory + removed-route 404s); `security.test.js` (matrix over new
  endpoints — foreign callers now see their OWN data, never 404-leak;
  injection corpus re-pointed); `auth.test.js` (register provisions budget,
  response shape unchanged); `serveClient` (+ /budget/new SPA fallback).
  `scripts/smoke.mjs` journey rewritten (17 checks).
- **Task 23 — client tests: done.** `BudgetPage.test.jsx` rewritten (7-row
  fixture, popup open/save flows, CR1-7 non-interactivity, menu, defensive
  recovery, month navigation with same plans); `BudgetFormPage.test.jsx`
  DELETED; new `EditIncomeDialog.test.jsx` (7), `EditCategoryPlanDialog.test.jsx`
  (6), `MonthMultiSelect.test.jsx` (9); `InsightsPage.test.jsx` rewritten
  (default month, multi-select drives query, 7 categories in tables, donut
  100%, zero month, defensive 404, retry, hidden-table structure guard);
  `AddExpenseDialog` (7-option select + subscriptions expense),
  `ExpensePanel`/`DeleteExpenseConfirm`/`apiClient` path updates;
  `chartMath.test.js` unchanged (no chart-math helpers changed).

### Stage H — documentation

- **Task 24 — done.** `docs/api.md`: CR-001 revision note, Budget section →
  `/budget` + plan model, new Months section, Transactions → `/months/...`,
  Insights → `?months=` with the new shape and guarantees, register
  provisioning note (examples from the Checkpoint C captures). `README.md`:
  description, demo-seed numbers, data model (budgets DDL + migration 002
  summary), architecture diagram label, smoke count, coverage numbers,
  known limitations (seven fixed categories, kit extension note).
  No dependency changes → `ALL_LICENSES.md` untouched.

## Commands and exit codes (developer-scoped)

| Command | Result |
| --- | --- |
| `npm run migrate` (dev DB, run 1) | exit 0 — applied `002_single_budget.sql` |
| `npm run migrate` (dev DB, run 2) | exit 0 — "No pending migrations" (idempotent) |
| scratch-schema migrate ×2 + drop | exit 0 — run 2 applied `[]` |
| `ALLOW_DEMO_SEED=true npm run seed:demo` | exit 0 — totals 842000 / 918000 |
| `npm run lint` (eslint, all changed areas) | exit 0 |
| `npm run format:check` (prettier, all changed areas) | exit 0 |
| `npx vitest run tests/unit` (server) | exit 0 — 6 files, 81 tests passed |
| `npx vitest run tests/integration --no-file-parallelism` (server) | exit 0 — 10 files, 74 tests passed (after one perf-bound recalibration, see Deviations D4) |
| `npx vitest run --exclude "tests/qa/**"` (client) | exit 0 — 17 files, 99 tests passed |
| `npx vitest run tests/unit tests/integration --coverage --no-file-parallelism` (server) | exit 0 — 16 files / 155 tests; 97% stmts / 92.26% branch / 99.08% funcs / 97% lines (thresholds 70/60/70/70 met; no dip vs delivery-1's 96.75/92.2/99.02) |
| `npx vitest run --exclude "tests/qa/**" --coverage` (client) | exit 0 — 85.42% stmts / 83.56% branch / 82.92% funcs / 85.42% lines (thresholds 70/60/70/70 met) |
| `npm run build` | exit 0 |
| `npm run smoke` (against running dev server) | exit 0 — 17/17 checks |
| Playwright browser pass (scratchpad `pw/cr001-selftest.mjs`) | 24/24 checks |

Note on `npm test` / `npm run coverage` (unscoped): NOT usable as a gate
this iteration — they include the QA-owned suites, which are expected red
until QA's phase (see below). The scoped equivalents above are the
developer gate.

## Browser evidence (`developer/evidence/`)

- `budget-390.png`, `budget-1440.png` — 7 category rows, income button.
- `edit-income-dialog-390.png`, `edit-income-dialog-1440.png`,
  `edit-category-dialog-390.png` — the CR1 popups.
- `multiselect-open-390.png`, `multiselect-open-1440.png` — the CR3
  dropdown (checkmarks, disabled options, hint area).
- `insights-1month-390.png`, `insights-2months-1440.png`,
  `insights-3months-390.png`, `insights-3months-320.png` — 1/2/3-month
  charts with patterns and per-month hero totals.
- `api-captures/*.json` — sanitized endpoint captures (Checkpoint C).

Checks performed in-browser (Playwright, 390×844 + 320×844 + 1440×900):
dialog a11y contract (aria-modal, labelled, initial focus, Tab trap, Esc +
focus return), income save recomputes Available (12,500→13,000 ⇒ 1,000),
category dialog title/prefill, Planned/Available inert, removed routes →
NotFound, insights default = current month, listbox keyboard ops +
activedescendant focus, max-3 disable + hint, min-1 refusal + hint, 21 bars
at 3×7, URL months param, **320px scrollWidth = 320 (no horizontal
scroll)** on budget and 3-month insights, no 'Edit budget' menu item.
Console: clean except the pre-existing `/auth/me` 401 resource line on the
login page (present in delivery-1; not a regression).

## Deviations from the plan

1. **D1 — plans-only model helper.** Plan Task 6 said `getBudget` returns
   plans only; implemented via a new `calc.budgetPlanModel` instead of
   reusing `summarizeBudget` with empty actuals, so `GET /budget` carries NO
   actual/progress fields at all (a summarize-with-zeros would have emitted
   misleading `actualMinor: 0`/progress). Matches CR1-2's envelope exactly.
2. **D2 — one shared CSS file for the two popups.** Plan named a css file
   per dialog; both dialogs share `EditBudgetDialogs.css` (identical
   anatomy). No visual/behavioral impact.
3. **D3 — ProgressBar `decorative` prop.** Not in the plan: wrapping the row
   in a button (Task 17) would otherwise nest a `role="progressbar"` with
   its own label inside a button whose accessible name already carries the
   same sentence (duplicate SR announcement). Default behavior unchanged;
   only CategoryRow passes `decorative`.
4. **D4 — insights perf-test hard bound 2s → 4s.** The delivery-1 bound
   covered ONE month; the new test aggregates THREE months (six parallel
   aggregations over remote Neon) and measured ~2.5s. Recalibrated the hard
   bound to 4s with the soft 500ms warning retained. This is a new test I
   authored this iteration, not a weakened pre-existing expectation.
5. **D5 — rotated bar-label headroom.** `ROTATED_LABEL_EXTRA` 24→40px:
   "Subscriptions" (13 chars) clipped ~15px below the svg at rotated-label
   widths; measured post-fix clearance 1px at 390 and 320 with no
   horizontal scroll.
6. **D6 — GET /months/:month envelope.** Plan didn't name the envelope key;
   kept the existing `{ budget }` convention (with a `month` field inside),
   minimizing client and contract churn. Documented in docs/api.md.

## QA-owned files expected RED (route to QA — not touched by developer)

Server (`server/tests/qa/`): `integration/qa-budget.http.test.js`,
`integration/qa-transactions.http.test.js`, `integration/qa-insights.http.test.js`,
`integration/qa-journeys.http.test.js`, `integration/qa-error-contract.http.test.js`,
`integration/qa-auth.http.test.js` (register now also provisions a budget),
`unit/qa-schemas.test.js`, `unit/qa-calc.test.js`, helpers
`helpers/qaFixtures.js` / `helpers/qaClient.js` / `helpers/qaServer.js`
(fixtures assume `POST /budgets` per month — endpoint removed).

Client (`client/tests/qa/`): `qa-budget-page.test.jsx`,
`qa-budget-form.test.jsx` (flow superseded — QA to delete/replace),
`qa-add-expense.test.jsx`, `qa-delete-expense.test.jsx`,
`qa-insights-page.test.jsx`, `qa-routing-session.test.jsx` (removed routes),
fixtures `fixtures/budgetFixtures.js` / `fixtures/insightsFixtures.js`.
Likely unaffected (QA to confirm): `qa-dates.test.js`, `qa-money.test.js`,
`qa-login-register.test.jsx`.

Reason: CR-001 intentionally changed the `/api/v1` contract
(`/budgets/:month` → `/budget` + `/months/:month`, insights `?months=`,
5→7 categories, register provisioning). These suites assert the superseded
contract; per the ownership rule they are QA's to update, and the developer
gate excludes them.

## Notes for the self-test phase

- Full acceptance matrix in `developer/plan.md` (CR1-1..12, CR2-1..4,
  CR3-1..8, REG-1..7); everything above is green at build time — self-test
  should re-verify independently and fill `developer/test-report.json`.
- Coverage runs MUST stay scoped (`--exclude "tests/qa/**"` client;
  `tests/unit tests/integration` server) until QA lands its updates.
- The dev server (port 4000) and Vite (5173) started during the build were
  killed at the end of the build phase.
- Manual case 10 (demo walk current+previous totals 8,420/9,180) verified
  via API captures and the 2-month insights screenshot.
