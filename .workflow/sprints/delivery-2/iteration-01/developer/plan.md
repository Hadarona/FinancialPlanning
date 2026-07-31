# Developer Plan

Delivery-2, iteration 01 — implementation plan for
`docs/product/change-request-001.md` (CR-001). Authored in the developer PLAN
phase; no product code has been changed yet.

## Delivery goal and scope

Apply change request 001 to the delivered, working budgeting app
(branch `feature/budgeting-app` history; delivery-1 evidence under
`.workflow/sprints/delivery/iteration-01/`). CR-001 is an explicit user
decision (source-of-truth §1) and overrides the roadmap's per-month budget
model and the design kit's five-category content wherever they conflict.

**In scope (all three change items):**

1. **CR1-BUDGET — single recurring budget.** Replace the per-month
   `budget_periods` model with exactly ONE budget per user (income +
   per-category planned amounts) applied identically to every month. Expenses
   stay recorded per month; a month's progress = that month's actual spending
   vs the single budget's plans. Budget editing becomes in-place click-to-edit
   popups (income popup; per-category planned-amount popup). "Planned" (total)
   and "Available" stay computed-only, never editable. The separate
   create/edit budget form flow (`BudgetFormPage`, `/budget/new`,
   `/budget/:month/edit`) is superseded and removed. Requires a DB migration
   (`002_single_budget.sql`), a demo-seed rework, and resolving
   `transactions.budget_period_id` (dropped — see Task 1 rationale).
2. **CR2-CATEGORIES — seven categories.** Add `subscriptions`
   ("Subscriptions") and `utilities` ("Utilities") to the fixed set (7 total),
   with coherent Lucide icons and kit-ramp colors (sanctioned kit extension;
   the kit files themselves are read-only sources and are NOT edited — the
   extension is recorded here, in README.md and docs/api.md).
3. **CR3-INSIGHTS — 1–3 month multi-select comparison.** Insights defaults to
   the CURRENT calendar month; a multi-select month dropdown chooses 1–3
   months to compare (enforced in UI AND API); all charts/summaries adapt to
   1, 2 or 3 selected months, replacing the fixed current+previous model.

**Explicit non-goals:**

- No expense editing (still add/delete only — unchanged roadmap non-goal).
- No custom/renamable categories beyond the fixed seven.
- No change to auth mechanics, logging/redaction, rate limits, error
  envelope, or security posture.
- No `/api/v2` — the contract changes stay inside `/api/v1` (pre-release,
  single first-party client; CR-001 supersedes the old shape; documented in
  docs/api.md). The response envelope conventions (`{ budget }`,
  `{ insights }`, `{ transactions, total, limit, offset }`, single error
  envelope, `X-Request-Id`) are preserved.
- Delivery-1 design findings D-DES-001..015 are NOT in this plan's scope (see
  Findings below).
- QA-owned tests (`server/tests/qa/**`, `client/tests/qa/**`) are NOT edited
  by the developer — enumerated below for the orchestrator to route to QA.

**Current behavior and evidence (inspected 2026-07-31):**

- DB: `server/src/db/migrations/001_init.sql` — `budget_periods` with
  `UNIQUE (user_id, month)`, five-category `categories` JSONB;
  `transactions.budget_period_id` FK with idempotency index
  `(budget_period_id, client_request_id)`.
- API (`docs/api.md`): `GET/POST/PATCH /budgets[/:month]`,
  `/budgets/:month/transactions`, `GET /insights/:month` returning fixed
  current+previous comparison (`hasPrevious`, `previousTotalMinor`,
  `previousCumulativeMinor`).
- Server: `domain/categories.js` (5 categories), `budgetRepo`/`budgetService`
  keyed by `(userId, month)`, `insightsService.getInsights(userId, month)`
  hard-codes `previousMonth()`, `transactionService` resolves a per-month
  budget first, `seed/demoSeed.js` seeds two `budget_periods` rows.
- Client: `BudgetPage` + `BudgetFormPage` (form flow), `SummaryMetrics`
  (static values), `CategoryRow` (non-interactive), `InsightsPage` with
  two-tab `MonthTabs` (current/previous), charts assume ≤2 series,
  `lib/categories.js`/`lib/icons.js` mirror the 5-category set.
- Delivery-1 final reports: developer `pass` (openIssues []), QA `pass`
  (no test/product issues), design `issues` (D-DES-001..015, all low/medium).

## Acceptance criteria

Every check below must be `passed` (or `not_applicable` with reason) in
`developer/test-report.json`.

### CR1 — single recurring budget

- **CR1-1** Migration `002_single_budget.sql` applies idempotently via
  `npm run migrate`: creates `budgets` (one row per user,
  `UNIQUE (user_id)`), backfills every existing user (latest-month
  `budget_periods` row wins; users with no period get the documented default
  budget), extends categories to 7, dedupes and re-scopes the idempotency
  index to `(user_id, client_request_id)`, drops
  `transactions.budget_period_id` and `budget_periods` — all in one
  transaction.
- **CR1-2** `GET /api/v1/budget` returns the single budget envelope
  `{ budget: { id, currencyCode, incomeMinor, plannedMinor, availableMinor,
  categories[7] } }` (no `month` field); `PATCH /api/v1/budget` partially
  updates income and/or planned amounts; `POST /api/v1/budget` creates the
  default budget (409 CONFLICT if one exists). All require auth; missing
  budget answers the standard 404 envelope.
- **CR1-3** `GET /api/v1/months/:month` returns the month read model: the
  single budget's plans + THAT month's actuals
  (`actualMinor`, `progressPercent`, `state` per category; top-level
  `actualMinor`). Two different months return identical plans with different
  actuals.
- **CR1-4** Expenses remain per-month:
  `GET/POST /api/v1/months/:month/transactions` and
  `DELETE /api/v1/months/:month/transactions/:id` work exactly as before
  (occurredOn within `:month`, positive integer minor units, note ≤200,
  deterministic ordering, one 404 for missing/unowned/malformed ids), scoped
  by `occurred_on` date range instead of `budget_period_id`.
- **CR1-5** Clicking the Income value on the Budget screen opens a popup
  editor; saving PATCHes `incomeMinor` and Available recomputes.
- **CR1-6** Clicking a category row opens a popup editor for that category's
  planned amount; saving PATCHes that category and its progress recomputes.
- **CR1-7** "Planned" (total) and "Available" render as computed, non-editable
  values: no click/keyboard interaction opens an editor on them.
- **CR1-8** The form flow is gone: routes `/budget/new` and
  `/budget/:month/edit` no longer exist (404 page), `BudgetFormPage` is
  deleted, and the "Edit budget" header menu item is removed.
- **CR1-9** Registering a new account auto-creates the default budget in the
  same transaction; the new user lands on a populated Budget screen (no empty
  state on the happy path).
- **CR1-10** Both popups meet the dialog a11y contract: `role="dialog"`,
  `aria-modal`, labelled by title, initial focus inside, Tab focus trap, Esc
  closes, focus returns to the invoking element, labelled input, submit
  errors announced, double-submit protected.
- **CR1-11** Month navigation on the Budget screen shows the SAME plans for
  every month with per-month actuals; a month with zero expenses shows zero
  actuals (no 404/empty state per month). Defensive path: if the budget row
  is missing (data anomaly), the screen shows an empty state whose action
  POSTs `/budget` and recovers.
- **CR1-12** Idempotent expense retry still returns the existing transaction
  (now scoped per `(user, clientRequestId)`).

### CR2 — Subscriptions and Utilities

- **CR2-1** Server and client category constants contain exactly 7 entries:
  the existing five plus `subscriptions` ("Subscriptions", Lucide `Repeat`,
  color `coral`, displayOrder 6, default plannedMinor 60000) and `utilities`
  ("Utilities", Lucide `Plug`, color `green`, displayOrder 7, default
  plannedMinor 120000). id/name/icon/color/order remain server constants
  never accepted from the client.
- **CR2-2** The two new categories render everywhere categories render:
  Budget rows (tinted icon circle + progress), Add-expense category select,
  Insights bar/donut/legend/hidden table — with chart fills distinct from
  their hue-mates (subscriptions `--color-coral-700` vs fun `coral-500`;
  utilities `--color-green-700` vs groceries `green-500`; savings keeps
  `blue-700` vs housing `blue-500`) so no two donut segments share a fill.
- **CR2-3** Validation covers 7 ids: `POST /budget` requires exactly the 7
  ids once each; `PATCH /budget` accepts any 1–7 unique subset; expenses in
  the new categories are accepted; an unknown id is still rejected.
- **CR2-4** Reworked demo seed creates ONE `budgets` row (income 1,250,000;
  the 7 default plans totalling 1,200,000) and current+previous month
  expenses including subscriptions and utilities, preserving monthly totals
  842,000 / 918,000 and the exact per-day cumulative cash-flow series.

### CR3 — insights multi-month comparison

- **CR3-1** Opening `/insights` with no selection shows exactly the current
  calendar month (client-side `currentMonth()`), one series per chart.
- **CR3-2** The month dropdown is a multi-select (last 12 calendar months):
  1–3 selections; deselecting the last selected month is refused with a
  visible+announced hint; with 3 selected, unselected options are disabled
  with a visible+announced hint.
- **CR3-3** `GET /api/v1/insights?months=YYYY-MM[,YYYY-MM[,YYYY-MM]]`
  validates: parameter required, 1–3 comma-separated `YYYY-MM` values,
  unique; 0, 4+, duplicates, or malformed values answer `400
  VALIDATION_ERROR`; response months are normalized newest-first.
- **CR3-4** Charts/summaries adapt to 1, 2 or 3 months: hero shows each
  selected month's total; bar chart groups 1–3 bars per category; line chart
  draws 1–3 cumulative series over the shared 7 sample positions; donut shows
  the combined share across the selected months (largest-remainder, sums to
  100). Series are distinguished by kit color (blue-500 / yellow-500 /
  green-500) PLUS a non-color cue (solid/dashed/dotted lines; plain/diagonal/
  dotted bar patterns) — never color alone.
- **CR3-5** Per-month coherence holds for every selected month:
  Σ per-category totals = month total = last cumulative point (server 500s on
  its own incoherence, as today).
- **CR3-6** Year boundary: in January the default is `YYYY-01` and the
  dropdown's 12 options roll into the previous year via pure string month
  math; selecting a cross-year triple (e.g. Dec+Jan) works.
- **CR3-7** A selected month with a budget but no expenses returns zeros
  (zero totals, all-zero shares, flat zero cumulative line) — not an error.
- **CR3-8** With 3 months selected the Insights screen stays legible and
  operable at 390×844 and 320×844 (no clipped/overlapping bars or legends;
  horizontal page scroll never appears); the dropdown is fully
  keyboard-operable (listbox pattern) and the hidden data table covers all
  selected months.

### Regression (REG)

- **REG-1** Auth journeys (register/login/logout/me, cookie flags, timing-safe
  login, rate limits) unchanged apart from CR1-9.
- **REG-2** All money remains integer minor units end-to-end; planned vs
  actual stay distinct fields everywhere.
- **REG-3** Ownership: another user's budget, months, transactions, and
  insights answer 404 with no existence leak (repository-level `user_id`
  filters on every new/changed query).
- **REG-4** Logging redaction unchanged: metadata-only logs, no notes or
  financial bodies; `DATABASE_URL`/`JWT_SECRET` never printed or logged.
- **REG-5** `npm run lint`, `npm run format:check`, `npm test`,
  `npm run test:integration`, `npm run coverage` (≥70/70/70/60 thresholds in
  both workspaces), and `npm run build` all pass.
- **REG-6** The single error envelope + status-code contract holds on every
  changed endpoint (including 404 for unknown routes like the removed ones).
- **REG-7** SPA fallback still serves the client for `/budget`, `/insights`
  (route list changed — `/budget/new` now renders the NotFound page).

## Findings to resolve

- No open developer or QA issues: delivery-1 developer report `pass`
  (`openIssues: []`), QA report `pass` (no test or product issues).
  `context.json.feedback` is empty for this iteration.
- Design report `.workflow/sprints/delivery/iteration-01/design/review-report.json`
  lists D-DES-001..015 (low/medium). They are **not** part of CR-001 and the
  orchestrator assigned only the three change items, so they are excluded
  from this plan rather than silently absorbed — flagged for the orchestrator
  to confirm as accepted baseline or to schedule separately. Two are touched
  incidentally, without being claimed as resolved:
  - D-DES-006 (month-tab order): `MonthTabs` on Insights is REPLACED by the
    multi-select (CR3 supersedes the tab model). New months render
    newest-first.
  - D-DES-013 (category-row hover): rows become clickable buttons (CR1-6) and
    therefore gain hover/focus states as part of the interactive treatment.

## Ordered implementation tasks

Execute in order; each stage ends at a rollback-safe checkpoint (listed
commands must pass before continuing). Never print or log `DATABASE_URL`.

### Stage A — schema and domain (Tasks 1–2)

**Task 1 — `server/src/db/migrations/002_single_budget.sql` (new file).**
Applied by the existing `server/src/db/migrate.js` (whole run already wrapped
in ONE transaction; file just contains statements). Contents, in order:

1. Create the new table:

   ```sql
   CREATE TABLE IF NOT EXISTS budgets (
     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id       uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     currency_code text NOT NULL DEFAULT 'USD',
     income_minor  bigint NOT NULL CHECK (income_minor >= 0),
     categories    jsonb NOT NULL,
     created_at    timestamptz NOT NULL DEFAULT now(),
     updated_at    timestamptz NOT NULL DEFAULT now()
   );
   ```

2. Backfill from `budget_periods` — **latest month wins**: for each user,
   insert their most recent month's row, with the two new category objects
   appended to the stored five:

   ```sql
   INSERT INTO budgets (user_id, currency_code, income_minor, categories)
   SELECT DISTINCT ON (user_id) user_id, currency_code, income_minor,
          categories || '[
            {"id":"subscriptions","name":"Subscriptions","icon":"Repeat","color":"coral","displayOrder":6,"plannedMinor":60000},
            {"id":"utilities","name":"Utilities","icon":"Plug","color":"green","displayOrder":7,"plannedMinor":120000}
          ]'::jsonb
   FROM budget_periods
   ORDER BY user_id, month DESC;
   ```

   *Rationale (transform, not drop):* CR-001 says there is ONE budget applied
   to every month; where a user has several per-month plans, the newest month
   is the latest statement of intent. Older per-month variations are
   deliberately discarded (recorded as Risk 2). This preserves any real user
   data instead of wiping it.

3. Backfill users who never created a budget (registered, no periods) with
   the documented default budget (income 1,250,000; the 7 default plans from
   Task 2), via `INSERT … SELECT id FROM users WHERE id NOT IN (SELECT
   user_id FROM budgets)`. This plus CR1-9 makes the budget row an invariant
   for every account.
4. Transactions re-scope — `budget_period_id` is **dropped** (fate decided):
   month membership is fully derivable from `occurred_on` (which the service
   has always validated to lie inside the period's month), so a stored month
   link would be redundant, denormalized state. No `month` column is added;
   all monthly queries filter by `occurred_on BETWEEN first AND last` of the
   month.
   - Dedupe `client_request_id` per user before re-indexing (cross-period
     duplicates are theoretically possible; keep the oldest):

     ```sql
     UPDATE transactions t SET client_request_id = NULL
     WHERE client_request_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM transactions e
       WHERE e.user_id = t.user_id
         AND e.client_request_id = t.client_request_id
         AND (e.created_at, e.id) < (t.created_at, t.id));
     ```

   - `DROP INDEX IF EXISTS transactions_dedupe_idx, transactions_user_period_idx, transactions_period_date_idx;`
   - `ALTER TABLE transactions DROP COLUMN budget_period_id;`
   - `CREATE UNIQUE INDEX transactions_user_dedupe_idx ON transactions
     (user_id, client_request_id) WHERE client_request_id IS NOT NULL;`
   - `CREATE INDEX transactions_user_date_idx ON transactions (user_id, occurred_on);`
5. `DROP TABLE budget_periods;` (last, after backfill, same transaction).

**Task 2 — `server/src/domain/categories.js`.** Append the two new constants
(exact values in CR2-1); update the header comment (7 fixed categories,
default prefill totals 12,000 => 1,200,000 minor). Add
`export const DEFAULT_INCOME_MINOR = 1250000;` (single source for
registration/backfill/defensive-create defaults; seed imports it).

*Checkpoint A:* `npm run migrate` against a scratch schema (integration test
helpers already do this per run); `node --check` on changed files.

### Stage B — repositories and services (Tasks 3–8)

**Task 3 — `server/src/repositories/budgetRepo.js`.** Rewrite for the
`budgets` table, all queries filtered by `user_id`:

- `findByUser(userId)` → mapped row `{ id, userId, currencyCode,
  incomeMinor, categories }` (no month).
- `createBudget({ userId, currencyCode, incomeMinor, categories })` — plain
  INSERT; 23505 (unique user) surfaces for the service to translate to 409.
- `updateBudget({ userId, incomeMinor, categories })` — UPDATE by `user_id`,
  returns null when no row.

**Task 4 — `server/src/repositories/transactionRepo.js`.** Replace every
`budget_period_id` parameter with a date range `{ userId, firstDay, lastDay }`
(`WHERE user_id = $1 AND occurred_on >= $2 AND occurred_on <= $3`):
`sumByCategory`, `sumByDay`, `listByRange` (was `listByBudget`),
`countByRange`. `insert({ userId, categoryId, amountMinor, occurredOn, note,
clientRequestId })` drops `budgetPeriodId`; the 23505 recovery SELECT keys on
`(user_id, client_request_id)`. `deleteByIdAndUser({ userId, transactionId,
firstDay, lastDay })` keeps the month scoping via the range so
`DELETE /months/:month/transactions/:id` still 404s for an id outside the
month. Ordering/mapping unchanged.

**Task 5 — `server/src/services/calc.js`.** `summarizeBudget(budgetRow,
actualsByCategory)` no longer emits `month` (budget has none); everything
else (progress states, planned/available math, largest-remainder) unchanged.
Add `monthReadModel(budgetRow, month, actualsByCategory)` = summarize + the
requested `month` field, used by the months endpoint. `previousMonth`,
`monthRange`, `cashFlowSampleDates`, `cumulativeAtDates`, `shortDateLabel`,
`monthName` stay as-is (seed and insights still use them).

**Task 6 — `server/src/services/budgetService.js`.** Rewrite:

- `getBudget(userId)` → `{ budget }` (plans only, NO actuals; computed
  `plannedMinor`/`availableMinor` included). 404 `"No budget yet."` if
  missing (defensive; unreachable after migration + CR1-9).
- `createDefaultBudget(userId)` → inserts `DEFAULT_CATEGORIES` +
  `DEFAULT_INCOME_MINOR`; translates 23505 → 409 CONFLICT
  `"You already have a budget."`. Called by the POST controller AND by
  registration (Task 8).
- `patchBudget(userId, patch)` → merge exactly like today's `updateBudget`
  (subset of `{id, plannedMinor}` merged into the fixed 7; income optional);
  404 when missing.
- `getMonthReadModel(userId, month)` → budget row + `transactionRepo
  .sumByCategory(userId, monthRange(month))` → `calc.monthReadModel`.

**Task 7 — `server/src/services/transactionService.js`.**
`resolveBudget(userId)` now fetches the single budget (404 if missing —
covers "expenses but no budget" defensively); category check against
`budget.categories` unchanged (now 7); month-membership check unchanged;
repo calls pass `monthRange(month)` bounds instead of `budget.id`.

**Task 8 — `server/src/services/insightsService.js` +
`server/src/services/authService.js` + `server/src/app.js` wiring.**

- `insightsService.getInsights(userId, months)` where `months` is the
  validated 1–3 array: sort descending (newest first); resolve the single
  budget (404 if missing); `aggregateMonth` per month in parallel
  (`Promise.all`), each coherence-checked exactly as today. Response shape
  (envelope `{ insights }` preserved):

  ```json
  {
    "insights": {
      "months": [
        { "month": "2026-07", "label": "July", "yearLabel": "July 2026",
          "totalMinor": 842000,
          "cashFlow": { "labels": ["Jul 1", "…7 labels"],
                        "cumulativeMinor": [0, "…7 points"] } }
      ],
      "categories": [
        { "id": "housing", "label": "Housing", "color": "blue",
          "totalsMinor": [323600],
          "combinedMinor": 323600, "sharePercent": 38 }
      ],
      "combinedTotalMinor": 842000
    }
  }
  ```

  `categories[].totalsMinor` aligns index-for-index with `months`;
  `sharePercent` = largest-remainder shares of `combinedMinor` across the 7
  categories (sums to exactly 100; all-zero → all zero). The old
  `hasPrevious/previous*` fields disappear with the superseded model
  (CR-001 §3: "the fixed current + previous comparison model is superseded").
- `authService.createAuthService` gains a `budgetService` dependency;
  `register` calls `budgetService.createDefaultBudget(user.id)` after user
  creation. Order the factory wiring in `app.js` accordingly (budgetService
  before authService). A 23505 here is impossible (fresh user), but let any
  error propagate — registration must not half-succeed silently. (If the two
  inserts must be atomic, wrap in a pool transaction; acceptable simpler
  alternative given `createUser`+`createBudget` sequencing: on budget-insert
  failure the register request 500s and the user retries — the email is
  taken; to avoid that dead end, catch 23505 from `createUser` only, and on
  budget failure delete nothing but rely on the defensive POST path. Builder:
  implement the simple sequential version and add the defensive-path test.)

*Checkpoint B:* `npm test -w server` (unit suites updated in Stage G may
still be red here — run only `calc`/`schemas` selectively:
`npx vitest run tests/unit/calc.test.js` etc. after Task 12 updates them; the
hard gate for this checkpoint is `node --check`/lint on `server/src`).

### Stage C — API contract (Tasks 9–11)

**Task 9 — `server/src/validation/schemas.js`.**

- `createBudgetSchema`: remove `month`; `categories` length exactly **7**
  (message: "Provide a plan for each of the seven categories."); ids from the
  7-element `DEFAULT_CATEGORY_IDS`. Body optional? No — POST /budget takes
  **no body** (defaults are server constants); delete `createBudgetSchema`
  entirely and don't validate a body on POST (strictly reject any body:
  keep a `z.object({}).strict()` `emptyBodySchema` so unknown keys 400).
- `patchBudgetSchema`: unchanged semantics, max **7**, message updates.
- New `insightsQuerySchema`:

  ```js
  z.object({
    months: z.string()
      .transform((v) => v.split(","))
      .pipe(z.array(monthSchema)
        .min(1, "Select at least one month.")
        .max(3, "Select at most three months.")
        .superRefine(requireUniqueMonths)),
  }).strict()
  ```

- `monthParamsSchema`, `createTransactionSchema`,
  `listTransactionsQuerySchema` unchanged.

**Task 10 — routes.** `server/src/routes/budgetRoutes.js` → mount at
`/budget`: `GET /`, `POST /` (emptyBodySchema), `PATCH /`
(patchBudgetSchema). New `server/src/routes/monthRoutes.js`:
`GET /:month` (monthParamsSchema) → `budgetController.getMonth`.
`server/src/routes/insightsRoutes.js`: `GET /` with a `validateQuery`
middleware (add alongside `validate`/`validateParams` in
`server/src/middleware/validate.js`, writing the parsed value to
`req.validatedQuery` — Express 5 `req.query` is a getter). Transactions
router mounts move in `server/src/routes/index.js`:

```
/api/v1/budget                    → budgetRoutes
/api/v1/months/:month/transactions → transactionRoutes (mergeParams, BEFORE /months)
/api/v1/months                    → monthRoutes
/api/v1/insights                  → insightsRoutes
```

**Task 11 — controllers.** `budgetController`: `getBudget` (no params),
`createBudget` (201), `patchBudget` (200), `getMonth` (200,
`req.params.month`). `insightsController.getInsights` reads
`req.validatedQuery.months`. `transactionController` unchanged apart from
service signatures. No logging changes (paths/methods/status only, already
metadata-safe).

*Checkpoint C:* server boots (`npm run dev -w server` against dev DB after
`npm run migrate`); `curl` smoke of GET /budget, GET /months/<current>,
GET /insights?months=<current> with a session cookie — record sanitized
captures under `developer/evidence/` for docs/api.md examples. Never echo
`DATABASE_URL`.

### Stage D — demo seed (Task 12)

**Task 12 — `server/src/seed/demoSeed.js` + `server/tests/unit/demoSeedData.test.js`.**

- Seed ONE `budgets` row (income `DEFAULT_INCOME_MINOR`, categories =
  `DEFAULT_CATEGORIES` → planned total 1,200,000, available 50,000).
- Rework both expense lists to include the new categories while preserving
  every per-day sum (so monthly totals and the sampled cumulative series are
  byte-identical to delivery-1 evidence):
  - Current month: change day-18 `housing` 72,100 "Utilities" →
    `utilities` 72,100 "Electricity and water"; split day-4 `groceries`
    38,000 into `groceries` 23,000 "Supermarket" + `subscriptions` 15,000
    "Streaming services". New category totals: housing 323,600, groceries
    136,600, transport 84,200, fun 92,600, savings 117,900, subscriptions
    15,000, utilities 72,100 — sum 842,000 ✓.
  - Previous month: day-18 `housing` 80,000 "Utilities" → `utilities`
    80,000; split day-4 `groceries` 40,000 into 25,000 + `subscriptions`
    15,000. Totals: 350,000 / 155,000 / 90,000 / 100,000 / 128,000 / 15,000 /
    80,000 — sum 918,000 ✓.
- Insert transactions without `budget_period_id`; keep the delete-and-recreate
  idempotency (DELETE demo user cascades budgets+transactions), the
  `ALLOW_DEMO_SEED`/production guards, and the summary output (never prints
  connection info).
- `demoSeedData.test.js` (developer-owned) updates: totals per category, both
  monthly sums, per-day cumulative equality at sample dates, all days ≤ 28,
  every categoryId ∈ 7-id set, subscriptions+utilities present in both
  months (CR2-4).

*Checkpoint D:* `ALLOW_DEMO_SEED=true npm run seed:demo` on the dev DB, then
login as demo user and eyeball `/budget`.

### Stage E — client API layer and constants (Tasks 13–14)

**Task 13 — `client/src/lib/categories.js`, `client/src/lib/icons.js`.**
Mirror the 7-category constants exactly (Task 2). `icons.js`: import and map
`Repeat`, `Plug` from `lucide-react` (outline family, same as existing).

**Task 14 — `client/src/api/hooks.js`.**

- `useBudgetQuery()` → key `["budget"]`, GET `/budget` (plans for popup
  prefill on Insights-free screens; may be unused if BudgetPage only needs
  the month model — include only if a consumer exists; the popups read from
  the month model, so ADD ONLY IF NEEDED — default: skip).
- `useMonthQuery(month)` → key `["month", month]`, GET `/months/${month}`.
- `usePatchBudgetMutation()` → PATCH `/budget`; onSuccess invalidate
  `["month"]` prefix and `["insights"]` prefix (plans affect every month).
- `useCreateBudgetMutation()` → POST `/budget` (defensive empty-state), same
  invalidations.
- `useInsightsQuery(months)` → months = sorted-desc array; key
  `["insights", months.join(",")]`; GET `/insights?months=${months.join(",")}`;
  enabled when 1–3 months.
- Transactions hooks: paths become `/months/${month}/transactions[...]`;
  `invalidateExpenseData` invalidates `["month", month]`, `["transactions",
  month]`, `["insights"]`.
- Remove `useUpdateBudgetMutation(month)`/old `useCreateBudgetMutation`
  (superseded flow).

### Stage F — client UI (Tasks 15–20)

**Task 15 — new `client/src/features/budget/EditIncomeDialog.jsx` (+ css) and
`EditCategoryPlanDialog.jsx` (+ css).** Both reuse `components/ui/Dialog.jsx`
(focus trap, Esc, labelled title, focus return already proven). Anatomy:
title ("Edit income" / "Edit {name} plan"), one labelled money `TextInput`
prefilled via `minorToInputValue`, live preview line of the recomputed
Planned/Available (income dialog) or category plan (category dialog), Cancel
+ Save buttons. Behavior: parse via `parseMoneyToMinor` (string-split, never
parseFloat); client-side invalid → inline field error; submit via
`usePatchBudgetMutation` with `{ incomeMinor }` or
`{ categories: [{ id, plannedMinor }] }`; disable Save while pending
(double-submit); server `fieldErrors` mapped inline; on success close +
announce via the page status region ("Income updated" / "{name} plan
updated" — new `copy.budget` strings). Money rules: integers only, no
symbols, `1,234` formatting (existing helpers).

**Task 16 — `client/src/features/budget/SummaryMetrics.jsx` (+ css).** The
Income value becomes a `<button type="button">` (min 44×44 target, visible
focus ring, hover state, `aria-label` "Edit income, current value 12,500")
invoking `onEditIncome`. Planned and Available stay `<dd>` text — no
interactive wrapper whatsoever (CR1-7). Over-allocation warning unchanged.

**Task 17 — `client/src/features/budget/CategoryRow.jsx` (+ css).** Wrap the
row content in a full-width `<button type="button">` (`aria-label` from
`categoryProgressText(category)` + ", edit planned amount"), `onEdit(category)`
callback; keep the icon circle/progress visuals; add hover + `:focus-visible`
styles; keep warning flags. No nested interactive elements.

**Task 18 — `client/src/features/budget/BudgetPage.jsx` (+ css).**

- Swap `useBudgetQuery(month)` → `useMonthQuery(month)`; skeleton rows 5→7.
- State: `editIncomeOpen`, `editCategory` (category object or null); wire
  `SummaryMetrics onEditIncome`, `CategoryRow onEdit`; render the two new
  dialogs; announce successes via the existing `role="status"` region.
- Remove the "Edit budget" menu item; Insights menu item navigates to
  `/insights` (no month param — CR3 default is the current month).
- Error branch: `NOT_FOUND` → defensive EmptyState "Set up your budget"
  calling `useCreateBudgetMutation` then refetch (CR1-11); other errors →
  existing ErrorState.
- `MonthNav` unchanged (expenses stay per month).

**Task 19 — remove the form flow.** Delete
`client/src/features/budget/BudgetFormPage.jsx` + `.css`; remove
`/budget/new` and `/budget/:month/edit` routes from
`client/src/app/router.jsx`; remove `copy.plan` create/edit-form strings that
become dead (keep `previousMonthLabel`/`nextMonthLabel` used by MonthNav);
add new `copy.budget` strings (popup titles, saved statuses, defensive empty
state) and `copy.insights` strings (dropdown label, min/max hints). Grep for
dangling imports (`BudgetFormPage`, `useCreateBudgetMutation` old signature,
`/budget/new`) — including `EmptyState` action on the old Insights page.

**Task 20 — Insights multi-select + charts.**

- New `client/src/components/ui/MonthMultiSelect.jsx` (+ css): trigger
  `<button aria-haspopup="listbox" aria-expanded>` labelled with the
  selection ("July 2026", "July 2026 + 2 more"); popup `<ul role="listbox"
  aria-multiselectable="true">` of the last 12 months (`currentMonth()` back
  via `previousMonth()` — string math, year-boundary safe), each
  `<li role="option" aria-selected>` with a visible checkmark. Keyboard:
  ArrowUp/Down (roving `aria-activedescendant`), Home/End, Space/Enter
  toggles, Esc closes returning focus to the trigger, Tab closes; click
  outside closes. Constraints: at 3 selections other options get
  `aria-disabled="true"` + hint "Select up to 3 months"; toggling the last
  remaining selection is refused + hint "Select at least 1 month"; hints
  rendered visibly in the popup and announced via `aria-live="polite"`.
  Options ≥44px tall. Reuse Menu.css patterns/tokens.
- `client/src/features/insights/InsightsPage.jsx`: selection state = array of
  months, default `[currentMonth()]`; keep URL sync via
  `?months=2026-07,2026-06` (validated; invalid → default). Hero: one total
  per selected month (newest first, each labelled with `yearLabel`); the old
  "vs last month"/`hasPrevious` branch is deleted (superseded). Empty/error
  states: 404 → defensive "Set up your budget" EmptyState (same action as
  Task 18); zero-spending months per CR3-7 render normally with zeros.
- `charts/BarChart.jsx`: accept `months[]` + `categories[].totalsMinor[]`;
  render 1–3 bars per category group; series fills
  `SERIES_COLORS = [blue-500, yellow-500, green-500]` with patterns
  plain/diagonal/dotted (extend the existing SVG pattern defs); group
  spacing so 7 groups × 3 bars fit 390px (min bar width 6px, gap 2px —
  compute from measured width; if below minimum, x-axis category labels
  rotate/abbreviate as today's smallest layout does).
- `charts/LineChart.jsx`: 1–3 series (solid/dashed/dotted + color), shared
  7-position x axis using each month's own labels from `months[i].cashFlow
  .labels` (positions align by sample index; axis shows day-of-month
  positions "1, 6, 11, 16, 21, 26, end" when >1 month to avoid mixed-month
  date labels).
- `charts/DonutChart.jsx`: input = `categories[].combinedMinor` +
  `sharePercent`; subtitle lists the selected months.
- `charts/chartColors.js`: `SERIES_COLORS` becomes an ordered 3-slot array;
  `categoryChartColor` gains `subscriptions → --color-coral-700`,
  `utilities → --color-green-700` (savings blue-700 rule kept).
- `charts/Legend.jsx` / `VisuallyHiddenTable.jsx`: legend rows for 1–3
  series with pattern swatches; hidden table gains one value column per
  selected month (headers = `yearLabel`s).
- `MonthTabs.jsx`: no longer used by Insights; delete it and its css/test IF
  nothing else imports it (grep first) — expected: removable.

*Checkpoint F:* `npm run dev`, manual pass of CR1-5..8, CR2-2, CR3-1/2/4 at
1440 and 390; browser console clean.

### Stage G — developer-owned tests (Tasks 21–23)

Full enumeration and per-file justification in the Test plan below.

**Task 21 — server unit tests** (`server/tests/unit/`): update `calc.test.js`,
`schemas.test.js`, `demoSeedData.test.js`, `authService.test.js`; keep
`authMiddleware/logRotation` untouched.

**Task 22 — server integration tests** (`server/tests/integration/`): update
`budget.test.js`, `plans.test.js`, `transactions.test.js`,
`insights.test.js`, `errorContract.test.js`, `security.test.js`,
`auth.test.js` (+`helpers/` budget-creation fixtures). Real-HTTP pattern
(`app.listen(0)` + fetch, isolated `test_*` schemas) unchanged.

**Task 23 — client component tests** (`client/tests/`): update
`BudgetPage.test.jsx`, `InsightsPage.test.jsx`, `AddExpenseDialog.test.jsx`,
`ExpensePanel.test.jsx`, `DeleteExpenseConfirm.test.jsx`,
`apiClient.test.js` (only if paths asserted), `chartMath.test.js` (extend for
grouped-bar math if helpers change); DELETE `BudgetFormPage.test.jsx`; ADD
`EditIncomeDialog.test.jsx`, `EditCategoryPlanDialog.test.jsx`,
`MonthMultiSelect.test.jsx`. Coverage must stay ≥ thresholds after the
form-page deletion (new dialog/multiselect tests offset it).

### Stage H — documentation (Task 24)

**Task 24 — `docs/api.md` + `README.md`.**

- `docs/api.md`: rewrite Budgets section → `/budget` (GET/POST/PATCH) +
  `/months/:month`; Transactions section paths → `/months/:month/…`;
  Insights section → `months` query parameter, new response shape, 1–3 rule,
  per-month coherence guarantee, combined donut shares; note the CR-001
  contract revision at the top (still `/api/v1`). Sanitized examples from
  Checkpoint C captures.
- `README.md`: description (one budget per user, seven fixed categories,
  1–3 month insights), Data model section (budgets/transactions DDL summary,
  migration 002), demo-seed numbers, Known limitations (fixed category set
  now seven; "expenses cannot be edited" unchanged; remove the per-month
  budget phrasing), architecture diagram DB label
  (`users · budgets · transactions`).
- No dependency changes → `ALL_LICENSES.md` untouched.

*Checkpoint H (final):* full gate — `npm run lint`, `npm run format:check`,
`npm test`, `npm run test:integration`, `npm run coverage`, `npm run build`,
`ALLOW_DEMO_SEED=true npm run seed:demo`, `npm run smoke` (update
`server/scripts/smoke.mjs` journey for the new endpoints as part of Task 22
if it references `/budgets` — verify during build). Record everything in
`developer/test-report.json`.

## Test plan

### Commands

```bash
npm run lint && npm run format:check
npm test                      # server unit + client component
npm run test:integration      # real-HTTP, isolated test_* schemas
npm run coverage              # thresholds 70/70/70/60 both workspaces
npm run build
ALLOW_DEMO_SEED=true npm run seed:demo
npm run smoke                 # against a running server
```

### Developer-owned test files — full impact analysis

Server unit (`server/tests/unit/`):

| File | Change | Justification (CR-001 citation) |
| --- | --- | --- |
| `calc.test.js` | Update `summarizeBudget` fixtures (no `month` on budget; 7-category totals where full sets asserted); add `monthReadModel` cases; keep progress/rounding/date helpers as-is | §1 "No more per-month budget rows"; §2 seven categories |
| `schemas.test.js` | Patch schema max 7; empty-body POST schema; NEW `insightsQuerySchema` cases (0/1/3/4 months, dupes, bad format); month/transaction schemas unchanged | §2; §3 "minimum 1, maximum 3 … enforce in UI and API" |
| `demoSeedData.test.js` | New dataset invariants (7 categories incl. subscriptions/utilities, totals 842,000/918,000 preserved, per-day cumulative equality, days ≤28) | §1 single budget; §2 new categories in seed |
| `authService.test.js` | Register now provisions the default budget (assert `budgetService.createDefaultBudget` called / budget exists) | §1 — one budget per user must always exist |
| `authMiddleware.test.js`, `logRotation.test.js` | none | — |

Server integration (`server/tests/integration/`):

| File | Change | Justification |
| --- | --- | --- |
| `budget.test.js` | Rewrite: GET/PATCH/POST `/budget`, GET `/months/:month` (same plans across months, per-month actuals, progress states, 404 envelope defensive path) | §1 "one budget … the same budget every month; monthly progress = that month's actual spending vs the single budget's plans" |
| `plans.test.js` | Per-month create/duplicate-month-409/month-concurrency tests are superseded; replace with single-budget lifecycle: POST twice → 409; concurrent PATCHes → both 200, DB consistent; patch merge semantics over 7 categories | §1 — the `(userId, month)` model is replaced, so month-duplication semantics no longer exist |
| `transactions.test.js` | Paths → `/months/:month/transactions`; no pre-created month budget (registration provides it); idempotent retry now per `(user, clientRequestId)`; month-membership validation, ordering, pagination, delete-404 matrix kept verbatim | §1 "the expense adding is per month" — behavior preserved, storage re-scoped |
| `insights.test.js` | Rewrite for `?months=`: 1/2/3-month responses, normalization newest-first, 400 matrix (0/4/dupes/bad), per-month coherence, zero-expense month zeros, cross-year selection | §3 multi-select 1–3, supersedes current+previous |
| `errorContract.test.js` | Endpoint inventory update (new paths; removed `/budgets/:month`); envelope assertions unchanged | §1/§3 route changes only |
| `security.test.js` | Ownership matrix rows updated to `/budget`, `/months/:month*`, `/insights?months=`; injection corpus re-pointed; headers/CORS/limits unchanged | invariant "ownership on every private read/mutation" over new endpoints |
| `auth.test.js` | Add: register response unchanged AND subsequent GET `/budget` 200 with defaults | §1 via CR1-9 |
| `health/serveClient/shutdown.test.js` | none (serveClient: spot-check that `/budget/new` deep link now renders SPA NotFound) | — |

Client (`client/tests/`):

| File | Change | Justification |
| --- | --- | --- |
| `BudgetPage.test.jsx` | Month read-model fixture (7 categories); income click → popup; row click → popup; Planned/Available not interactive; menu has no "Edit budget"; defensive empty state | §1 click-to-edit popups; §1 "except planned and available — those are calculated" |
| `BudgetFormPage.test.jsx` | **DELETE** | §1 "The previous separate edit-budget form flow is superseded" |
| NEW `EditIncomeDialog.test.jsx`, `EditCategoryPlanDialog.test.jsx` | focus trap/Esc/labeling/parse/save/error/double-submit | §1 popup editors + a11y invariant |
| NEW `MonthMultiSelect.test.jsx` | listbox keyboard ops, max-3 disable + hint, min-1 refusal + hint, year-boundary options | §3 multi-select, 1–3 enforced in UI |
| `InsightsPage.test.jsx` | Default = current month single series; selection drives query key; 1/2/3-month renders; hidden-table columns; removed prev-month copy | §3 "default … current month"; adapt to 1–3 months |
| `chartMath.test.js` | Extend only if grouped-bar/series helpers added | §3 chart adaptation |
| `AddExpenseDialog.test.jsx`, `ExpensePanel.test.jsx`, `DeleteExpenseConfirm.test.jsx` | Fixture categories 5→7; new-category expense selectable; API path assertions updated | §2 categories available for expenses |
| `apiClient.test.js` | Only if endpoint paths asserted (verify during build) | route changes |
| `Menu/Button/TextButton/PasswordInput/Login/Register/SessionExpiry.test.jsx` | none | — |
| `Menu.test.jsx` / `MonthTabs` test if present inside others | remove MonthTabs usages if component deleted | §3 supersedes tabs |

### QA-owned test files — route to QA (developer must NOT edit)

Server (`server/tests/qa/`): `integration/qa-budget.http.test.js`,
`integration/qa-transactions.http.test.js`,
`integration/qa-insights.http.test.js`, `integration/qa-journeys.http.test.js`,
`integration/qa-error-contract.http.test.js`,
`integration/qa-auth.http.test.js` (register now provisions a budget),
`unit/qa-schemas.test.js`, `unit/qa-calc.test.js`, plus helpers
`helpers/qaFixtures.js`, `helpers/qaClient.js`, `helpers/qaServer.js` (budget
setup fixtures assume `POST /budgets` per month).

Client (`client/tests/qa/`): `qa-budget-page.test.jsx`,
`qa-budget-form.test.jsx` (flow superseded — QA to delete/replace),
`qa-add-expense.test.jsx`, `qa-delete-expense.test.jsx`,
`qa-insights-page.test.jsx`, `qa-routing-session.test.jsx` (removed routes),
plus fixtures `fixtures/budgetFixtures.js`, `fixtures/insightsFixtures.js`.
Likely unaffected: `qa-dates.test.js`, `qa-money.test.js`,
`qa-login-register.test.jsx` (QA to confirm).

### Manual/browser cases and viewports

Reference viewports: 320×844, 390×844, 768×1024, 1024×800, 1440×900.

1. Register fresh user → Budget shows 7 default rows, income 12,500,
   Planned 12,000, Available 500 (CR1-9, CR2-1).
2. Click Income → popup; keyboard-only: Tab cycle stays inside, Esc closes,
   focus returns to the Income button; save 13,000 → Available 1,000
   (CR1-5, CR1-10).
3. Click Utilities row → popup; save 900 → row amount + progress update
   (CR1-6, CR2-2).
4. Attempt to interact with Planned/Available values (click, Tab) — inert
   (CR1-7).
5. Navigate months back/forward across a year boundary — same plans, actuals
   per month, zero months render zeros (CR1-11).
6. Add expenses in Subscriptions and Utilities for two different months;
   verify per-month actuals and history (CR1-4, CR2-2).
7. `/budget/new` and `/budget/2026-07/edit` → NotFound page (CR1-8).
8. Insights: default current month, one series everywhere (CR3-1); select 3
   months → grouped bars, 3 lines, combined donut; try a 4th (disabled +
   hint) and deselect to 0 (refused + hint) — mouse and keyboard (CR3-2/4).
9. Insights at 390 and 320 with 3 months: no overlap/clipping, no horizontal
   page scroll; reduced-motion unaffected; console clean (CR3-8).
10. Demo seed walk: seed, login as demo, Budget + Insights (current+previous
    selected) match the preserved totals 8,420 / 9,180 (CR2-4).

Financial reconciliation: for each screen assert Σ category actuals =
month total = last cumulative point, and Planned/Available = income −
planned (REG-2, CR3-5).

## Risks, assumptions, and blockers

**Risks**

1. **Breaking API change inside `/api/v1`.** All QA http suites will fail
   until QA's phase updates them — expected and routed via the orchestrator;
   the developer gate (Checkpoint H) runs developer-owned suites only.
2. **Irreversible data transform.** "Latest month wins" discards older
   per-month plan variations at migration time (transactions are all kept).
   Acceptable: only demo/test data exists; Neon PITR is the backstop.
   Recorded as the justified decision for CR1's "migrate/transform" choice.
3. **Migration lock window.** `002` rewrites `transactions` indexes and drops
   a column inside one transaction — trivial at current data volume; would
   need staging for a large production table (not the case here).
4. **21-bar chart at 390px.** 7 groups × 3 series is dense; mitigated by
   computed bar widths, patterns, and the hidden data table; verified
   manually at 320/390 (CR3-8). Fallback if illegible: cap bar-chart to
   per-category horizontal scroll INSIDE the card (page never scrolls
   horizontally).
5. **Coverage dip** from deleting well-covered `BudgetFormPage` — offset by
   new dialog/multiselect tests; `npm run coverage` is the gate.
6. **Register+budget non-atomicity** (two inserts): a mid-failure leaves a
   user without a budget; covered by the defensive 404 → "Set up your
   budget" path (CR1-11) and test.

**Assumptions (flagged, not silently chosen)**

1. Backfill income/plans for users who never created any budget = the
   documented defaults (income 1,250,000; plans 4,000/1,500/800/900/3,000/
   600/1,200). Affects no real accounts today (demo/test data only).
2. New-category defaults: Subscriptions 600.00, Utilities 1,200.00 (planned
   total becomes 12,000 vs income 12,500) — coherent extension of the kit's
   example numbers; CR-001 sanctions extending the kit.
3. Icon/color picks: Subscriptions → Lucide `Repeat`/coral ramp; Utilities →
   Lucide `Plug`/green ramp; chart fills use the 700 steps to stay distinct
   from hue-mates (mirrors the delivery-1 savings/blue-700 precedent).
4. Donut semantics for multi-month: share of combined spending across the
   selected months (single-month selection degenerates to today's donut).
5. Insights URL state `?months=a,b,c` kept for shareability; plain
   `/insights` = current month (CR3-1).
6. Staying on `/api/v1` (non-goal note above) rather than versioning to v2.
7. D-DES-001..015 are treated as outside this CR's scope pending orchestrator
   confirmation (see Findings).

**Blockers** — none. Sources are consistent; `DATABASE_URL`/`JWT_SECRET`
are present in `.env` for local runs (values never printed, logged, or
committed).
