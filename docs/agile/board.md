# Agile Board

Single-delivery, repo-only substitute for a Kanban/Agile board SaaS (see
`developer/plan.md` → "External-tool substitutions"). Columns:
**Backlog → Ready → In progress → Review → QA → Done**. Each card carries a
short user story, its key acceptance IDs (see `developer/plan.md` for the
full mapping), and an evidence pointer. Update this file — moving cards
between columns — at every stage commit; see `progress-log.md` for the
accompanying narrative.

## Done

### Stage A — Foundation (Sprint 0)

- **Story:** As a developer, I need a working monorepo, server skeleton,
  database layer, test harness, and client skeleton so later features have a
  stable base.
- **Acceptance:** D-FND-D1..D6 (SUB/DEV), D-FND-F1..F6, D-FND-B1..B6,
  D-FND-Q1..Q6.
- **Evidence:** `server/`, `client/`, `eslint.config.mjs`, `ALL_LICENSES.md`,
  `README.md`, `.workflow/sprints/delivery/iteration-01/developer/build-report.md`.

### Stage B — Auth (Sprint 1)

- **Story:** As a user, I can register, log in, stay signed in across a
  refresh, and log out, with no way to see another user's session.
- **Acceptance:** D-AUTH-D1..D6 (DEV portion), D-AUTH-F1..F7, D-AUTH-B1..B7,
  D-AUTH-Q1..Q6 (developer-provided enablers + `review-1-auth.md`).
- **Evidence:** `server/src/services/authService.js`,
  `server/src/routes/authRoutes.js`, `client/src/app/AuthProvider.jsx`,
  `client/src/pages/LoginPage.jsx`, `client/src/pages/RegisterPage.jsx`,
  `server/tests/integration/auth.test.js`, `docs/agile/reviews/review-1-auth.md`.

### Stage C — Budget read model (Sprint 2)

- **Story:** As a user, I see my monthly budget summary (income, planned,
  available, per-category actual/progress) computed entirely server-side.
- **Acceptance:** D-BUD-D1..D5, D-BUD-F1..F6, D-BUD-B1..B7, D-BUD-Q1..Q6.
- **Evidence:** `server/src/services/{calc,budgetService}.js`,
  `server/src/repositories/{budgetRepo,transactionRepo}.js`,
  `server/src/seed/demoSeed.js`, `server/tests/unit/calc.test.js`,
  `server/tests/integration/budget.test.js`,
  `client/src/features/budget/{BudgetPage,SummaryMetrics,CategoryRow}.jsx`,
  `client/tests/BudgetPage.test.jsx`.

### Stage D — Expenses (Sprint 3)

- **Story:** As a user, I can add and delete expenses and see the budget
  update instantly.
- **Acceptance:** D-EXP-D1..D5, D-EXP-F1..F6, D-EXP-B1..B6, D-EXP-Q1..Q6
  (+ `review-2-expenses.md`).
- **Evidence:** `server/src/services/transactionService.js`,
  `server/src/repositories/transactionRepo.js`,
  `server/src/routes/transactionRoutes.js`,
  `server/tests/integration/transactions.test.js`,
  `client/src/components/ui/Dialog.jsx`,
  `client/src/features/budget/{AddExpenseDialog,ExpensePanel,DeleteExpenseConfirm}.jsx`,
  `client/tests/{AddExpenseDialog,DeleteExpenseConfirm}.test.jsx`,
  `docs/agile/reviews/review-2-expenses.md`.

### Stage E — Plans + month navigation (Sprint 4)

- **Story:** As a user, I can create/edit a month's income and category
  plans and navigate between months.
- **Acceptance:** D-PLN-D1..D5, D-PLN-F1..F6, D-PLN-B1..B6, D-PLN-Q1..Q6.
- **Evidence:** `server/src/services/budgetService.js` (create/update),
  `server/src/validation/schemas.js` (budget schemas),
  `server/tests/integration/plans.test.js`,
  `client/src/features/budget/{BudgetFormPage,MonthNav}.jsx`,
  `client/tests/BudgetFormPage.test.jsx`,
  `client/tests/BudgetPage.test.jsx` (month-navigation empty state).

### Stage F — Insights (Sprint 5)

- **Story:** As a user, I can compare this month's spending to last month
  via bar/donut/cash-flow charts with accessible text summaries.
- **Acceptance:** D-INS-D1..D6, D-INS-F1..F6, D-INS-B1..B7, D-INS-Q1..Q6
  (+ `review-3-insights.md`).
- **Evidence:** `server/src/services/{insightsService,calc}.js`,
  `server/src/routes/insightsRoutes.js`,
  `server/tests/integration/insights.test.js`,
  `client/src/features/insights/InsightsPage.jsx`,
  `client/src/features/insights/charts/`,
  `client/src/components/ui/MonthTabs.jsx`,
  `client/tests/InsightsPage.test.jsx`, `client/tests/chartMath.test.js`,
  `docs/agile/reviews/review-3-insights.md`.

### Stage G — Responsive/accessibility/resilience (Sprint 6)

- **Story:** As any user (including keyboard/zoom/reduced-motion users), the
  app works cleanly from 320px to 1440px and recovers from errors/session
  expiry without leaking stale data.
- **Acceptance:** D-RESP-D1..D6, D-RESP-F1..F7, D-RESP-B1..B5, D-RESP-Q1..Q6.
- **Evidence:** `client/src/app/{AuthProvider,ProtectedRoute}.jsx` (session
  expiry), `client/src/app/router.jsx` (lazy Insights, styled 404),
  `client/tests/SessionExpiry.test.jsx`,
  `server/tests/integration/{errorContract,shutdown}.test.js`,
  `server/src/db/pool.js` (no-fallback schema scoping),
  `.workflow/sprints/delivery/iteration-01/developer/evidence/contrast.md`,
  `.workflow/sprints/delivery/iteration-01/developer/evidence/a11y-keyboard-checklist.md`.

## Backlog (not yet started — later batches)

### Stage H — Hardening (Sprint 7)

- **Story:** As the team, we need ≥70% coverage, a clean security checklist,
  and observability guarantees before release.
- **Acceptance:** D-SEC-F1..F5, D-SEC-B1..B7, D-SEC-Q1..Q7.

### Stage I — Docs/reproducibility (Sprint 8)

- **Story:** As a new contributor/grader, I can clone, install, migrate,
  seed, run, and smoke-test the app from documented steps alone.
- **Acceptance:** D-DOC-F1..F4, D-DOC-B1..B5, D-DOC-Q1..Q7.
