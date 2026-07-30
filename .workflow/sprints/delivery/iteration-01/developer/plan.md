# Developer Plan

Delivery: `delivery` (entire roadmap), outer iteration 1, phase `developer_plan`.
This plan is written to be executed mechanically by the build model without
rediscovering architecture. Where the plan and the roadmap ever disagree, the
roadmap and `docs/workflow/source-of-truth.md` win.

## Delivery goal and scope

Build the complete budgeting app (React + Node.js/Express + Neon PostgreSQL) in
one delivery on branch `feature/budgeting-app`, satisfying every mandatory
roadmap requirement and the targeted bonuses (auth, ≥70% coverage, real HTTP
integration tests, lockfile). The roadmap's Sprint 0–8 sections are the scope
checklist and build order inside this single delivery.

In scope (roadmap §2.3):

- Register, login, persistent session, logout (HTTP-only cookie session).
- One private budget per user per calendar month; unique `(user_id, month)`.
- Five default categories: Housing, Groceries, Transport, Fun, Savings.
- Monthly income + planned allocations; create and edit; month navigation.
- Add, list, and delete expenses; instant recalculation of progress.
- Budget summary read model (income / planned / available / per-category
  actual + progress, overspending and unplanned-spending states).
- Insights: current vs previous month totals, grouped bar, donut, cumulative
  cash-flow charts, accessible text summaries and data tables.
- Mobile 320 px → desktop 1440 px responsive; loading/empty/validation/error/
  overspent/session-expired states; keyboard + 200% zoom + reduced motion.
- Structured request/error logging to external rotating files, request IDs,
  redaction; security headers, CORS allowlist, rate limiting, input limits.
- Unit + component + real-HTTP integration tests, ≥70% coverage, lint,
  production build; README, API docs, `ALL_LICENSES`, agile board + progress
  log, deterministic guarded demo seed.

Non-goals (roadmap §2.4): bank integrations, OCR, shared accounts, multiple
currencies, recurring transactions, notifications, password reset/email
verification, social login, investments, native apps, ML predictions, editing
an existing expense (post-MVP backlog #1), open-source contribution bonus.

### Product decisions adopted (roadmap §11, decided now, recorded here)

| # | Decision |
|---|---|
| 1 | Currency: USD, no displayed symbol, format `1,234` (kit `currency`); all formatting through one `formatMoney` utility; storage in integer cents |
| 2 | Over-allocation: allowed; Available may render negative with a visible warning message (recommended roadmap behavior) |
| 3 | Savings: stays a spend-like category (source-compatible); limitation recorded in README |
| 4 | Expenses: add/delete only, no edit (roadmap MVP) |
| 5 | Hosting: local reproducible demo only; Express can serve the built client (`SERVE_CLIENT=true`) so route refresh works |
| 6 | Dates: calendar-date policy — expense `occurred_on` is a `DATE` (client sends `YYYY-MM-DD` local date); month membership is a pure string/date comparison, no timezone math anywhere |
| 7 | Category model: the category set is fixed to the five defaults per budget (ids/names/icons/colors/order constant); only income and planned amounts are editable. Therefore "category with transactions" can never be orphaned. Stored as JSONB `categories` on `budget_periods` (Sprint-0 decision point) |
| 8 | Duplicate-submission protection: client sends a per-submission `clientRequestId` (UUID); DB unique index makes retries idempotent |
| 9 | Auth token: signed JWT (HS256, 24 h) in an HTTP-only `SameSite=Lax` cookie named `bb_session`; `Secure` in production; logout clears it. No tokens in localStorage |
| 10 | Progress % rounding: `Math.round(actual/planned*100)`; donut shares use the largest-remainder method so displayed shares total exactly 100 (documented rounding rule) |

### External-tool substitutions (recorded, not blockers)

| Roadmap item | Substitution | Reason |
|---|---|---|
| Figma app pages, Auto Layout components, variants, prototype flows (S0/S1/S8 design objectives) | The committed design kit `docs/design/figma-kit/` (content.json, tokens, docs, references) is the design source of truth; prototype flows demonstrated through the running app + screenshots in evidence dirs | No Figma access in this environment; kit already encodes tokens/content/specs |
| Kanban/Agile board SaaS | `docs/agile/board.md` markdown board (`Backlog → Ready → In progress → Review → QA → Done`), updated at every stage commit, plus `docs/agile/progress-log.md` | Repo-only environment; requirement is evidence of small tasks/user stories/progress |
| Three major review PRs (Sprints 1/3/5) | One final PR per CLAUDE.md; three in-repo major review records `docs/agile/reviews/review-1-auth.md`, `review-2-expenses.md`, `review-3-insights.md` capturing review findings and resolutions from the workflow's QA/design phases; plus one commit per build stage so history shows progress over time | CLAUDE.md one-PR rule overrides the multi-PR cadence |
| Sprint ceremonies/dates/owners | Progress-log entries per build stage | Single-delivery model |
| Public deployment | Local reproducible run documented in README | Decision #5 |

## Acceptance criteria

ID scheme: `D-<STAGE>-<ROLE><n>` where STAGE ∈ {FND, AUTH, BUD, EXP, PLN, INS,
RESP, SEC, DOC}, ROLE ∈ {D (design), F (frontend), B (backend), Q (QA/delivery)}
and `n` is the bullet's position in the roadmap's "accepted when" list for that
sprint/role. Every roadmap "accepted when" bullet is mapped below. Owner: DEV =
developer self-test verifies; QA = QA phase verifies independently (developer
builds the enabler); DES = design-review phase verifies; SUB = satisfied via a
recorded substitution above. The developer final report must include a status
for every DEV row and `not_applicable` (with reason = substitution/owner) for
SUB/QA/DES rows.

### Stage A — Foundation (Sprint 0)

| ID | Check (abbreviated) | Owner |
|---|---|---|
| D-FND-D1 | Foundations use exact palette (`#5B86D6`, `#5FA873`, `#E2BE62`, `#D97972`, bg `#FAF8F4`) — via tokens.css copied verbatim | DEV/DES |
| D-FND-D2 | Inter + DM Serif Display styles with kit sizes/line heights | DEV/DES |
| D-FND-D3 | Mobile 390×844 / desktop 1440×900 grids | SUB (kit) |
| D-FND-D4 | Auto Layout named variants, no detached copies | SUB (kit) |
| D-FND-D5 | Focus/disabled/loading/error states visible on form controls | DEV |
| D-FND-D6 | Currency behavior confirmed before implementation | DEV (decision #1) |
| D-FND-F1 | Clean install starts app with documented steps on macOS/Linux | DEV |
| D-FND-F2 | Placeholder routes render without console errors (Login/Budget/Insights) | DEV |
| D-FND-F3 | Tokens consumed via shared CSS variables; no copied color literals in screens | DEV |
| D-FND-F4 | Sample component unit test passes | DEV |
| D-FND-F5 | Production build completes | DEV |
| D-FND-F6 | No secrets/machine files tracked by git | DEV |
| D-FND-B1 | Server fails fast with safe message when required env vars missing | DEV |
| D-FND-B2 | `GET /api/v1/health` via real listening test server returns documented body | DEV |
| D-FND-B3 | Health request writes structured external log entry (ts, method, route, status, duration, requestId) | DEV |
| D-FND-B4 | Forced internal error returns safe standard error and writes error log | DEV |
| D-FND-B5 | Logs contain no env secrets or full request bodies | DEV |
| D-FND-B6 | Shutdown closes HTTP listener, DB pool, log transports cleanly | DEV |
| D-FND-Q1 | New contributor can follow README clone→run | QA |
| D-FND-Q2 | Clean git status (no system files/secrets/logs/build output) | DEV/QA |
| D-FND-Q3 | Board shows full roadmap, first stage cards in Ready | DEV (board.md) |
| D-FND-Q4 | One intentional failing test then fixed (harness is meaningful) | DEV (recorded in progress log with commit refs) |
| D-FND-Q5 | Progress log records architecture/data-model/currency/testing decisions | DEV |
| D-FND-Q6 | Mandatory vs bonus requirements visibly distinguished | DEV (README traceability table) |

### Stage B — Auth (Sprint 1)

| ID | Check | Owner |
|---|---|---|
| D-AUTH-D1 | Login frames match approved layout/tokens (mobile+desktop) | DES |
| D-AUTH-D2 | Visible labels outside fields | DEV/DES |
| D-AUTH-D3 | Show/Hide password accessible labels, no focus move | DEV |
| D-AUTH-D4 | Error/focus/loading/disabled states designed & implemented | DEV |
| D-AUTH-D5 | Interactive targets ≥44×44 px mobile | DEV/DES |
| D-AUTH-D6 | Login usable at 320 px and 200% zoom | DEV |
| D-AUTH-F1 | Valid registration → session + navigate to Budget | DEV |
| D-AUTH-F2 | Valid login → Budget | DEV |
| D-AUTH-F3 | Refresh on protected route preserves session; no private-data flash for unauthenticated | DEV |
| D-AUTH-F4 | Invalid email / weak password / duplicate email / wrong credentials → clear non-revealing messages | DEV |
| D-AUTH-F5 | Rapid repeated clicks submit once | DEV |
| D-AUTH-F6 | Logout clears client state, returns to Login | DEV |
| D-AUTH-F7 | Keyboard order and visible focus correct | DEV |
| D-AUTH-B1 | Password never plaintext, never returned | DEV |
| D-AUTH-B2 | Duplicate normalized email → 409, no second user | DEV |
| D-AUTH-B3 | Invalid credentials → identical safe message whether email exists or not | DEV |
| D-AUTH-B4 | Protected endpoint rejects missing/invalid/expired auth | DEV |
| D-AUTH-B5 | Logout invalidates browser session (cookie cleared) | DEV |
| D-AUTH-B6 | Register/login bodies reject unknown/malformed input | DEV |
| D-AUTH-B7 | Auth requests correlated by request ID; no password/token in logs | DEV |
| D-AUTH-Q1..Q6 | Register→me→logout→rejected flow; login success/failure; manual refresh/back/double-submit/keyboard/mobile; stolen-ID isolation; major review; board/README/licenses updated | QA (developer provides tests + review record `review-1-auth.md`) |

### Stage C — Budget read model (Sprint 2)

| ID | Check | Owner |
|---|---|---|
| D-BUD-D1 | Summary hierarchy + five source categories represented | DEV/DES |
| D-BUD-D2 | Planned vs actual visually distinguishable | DEV/DES |
| D-BUD-D3 | Overspending conveyed with text/icon, not color alone | DEV |
| D-BUD-D4 | Layout works at 320/390/1024/1440 without horizontal scroll | DEV |
| D-BUD-D5 | Shared responsive components, not duplicated per viewport | DEV |
| D-BUD-F1 | No hard-coded totals; changing API data changes all displayed values | DEV |
| D-BUD-F2 | Income 12,500 / planned 10,200 / available 2,300 render from source-compatible fixture | DEV |
| D-BUD-F3 | Category progress = actual/planned (not planned/income) | DEV |
| D-BUD-F4 | Missing budget shows Create Budget action | DEV |
| D-BUD-F5 | Network failure shows retry without erasing authenticated shell | DEV |
| D-BUD-F6 | Screen-reader progress text, e.g. "Housing: 2,520 spent of 4,000 planned, 63%" | DEV |
| D-BUD-B1 | `:month` (`YYYY-MM`) strictly validated | DEV |
| D-BUD-B2 | planned = Σ category plans; available = income − planned | DEV |
| D-BUD-B3 | Actuals use only the authenticated user's transactions in the month/budget | DEV |
| D-BUD-B4 | User A gets 404 (not data) for User B's budget | DEV |
| D-BUD-B5 | Unique (user_id, month) index prevents duplicates | DEV |
| D-BUD-B6 | Zero-plan category → no NaN/Infinity/500; state "unplanned spending" | DEV |
| D-BUD-B7 | Summary unit tests cover normal/empty/overspent/zero-plan | DEV |
| D-BUD-Q1..Q6 | Independent fixture totals; month-boundary inclusion; 2-user isolation over HTTP; state evidence; kit conformance; Sprint-1 regression green | QA |

### Stage D — Expenses (Sprint 3)

| ID | Check | Owner |
|---|---|---|
| D-EXP-D1 | Bottom sheet / full-height dialog on mobile, centered dialog on desktop | DEV/DES |
| D-EXP-D2 | Labels/helper/error text visible and associated with inputs | DEV |
| D-EXP-D3 | Save shows pending state and prevents duplicates | DEV |
| D-EXP-D4 | Delete requires explicit confirmation identifying the transaction | DEV |
| D-EXP-D5 | Focus enters dialog, trapped, returns to Add Expense on close | DEV |
| D-EXP-F1 | Valid expense: closes form, appears in history, updates category actual/progress + monthly total without full reload | DEV |
| D-EXP-F2 | Invalid amount / missing category / out-of-period date / long note → field errors | DEV |
| D-EXP-F3 | Cancel closes without mutation | DEV |
| D-EXP-F4 | Failed save preserves values, offers retry | DEV |
| D-EXP-F5 | Double click/tap creates one expense | DEV |
| D-EXP-F6 | Confirmed delete removes + recalculates; canceled delete no-op | DEV |
| D-EXP-B1 | Valid expense stored once, documented response shape | DEV |
| D-EXP-B2 | Unknown category / wrong-month date / non-positive or malformed amount / oversized note rejected without mutation | DEV |
| D-EXP-B3 | Cross-user add/delete impossible | DEV |
| D-EXP-B4 | Deleting nonexistent/unauthorized transaction → 404, no ownership leak | DEV |
| D-EXP-B5 | Add/delete logs useful, no notes or full financial payloads | DEV |
| D-EXP-B6 | Repeated identical submission cannot duplicate (clientRequestId unique index) | DEV |
| D-EXP-Q1..Q6 | HTTP create→verify→delete→rollback; precision (no float drift); cross-user; manual mobile dialog; regression; major review 2 | QA (developer provides `review-2-expenses.md`) |

### Stage E — Plans (Sprint 4)

| ID | Check | Owner |
|---|---|---|
| D-PLN-D1 | Income/planned/available/actual distinction understandable | DEV/DES |
| D-PLN-D2 | Live total planned + available preview in form | DEV |
| D-PLN-D3 | Over-allocation clearly warned; rule = allowed (decision #2) | DEV |
| D-PLN-D4 | Category-with-transactions change has safe explicit outcome (fixed set, decision #7) | DEV |
| D-PLN-D5 | Mobile editing usable at 320 px, no dense 3-column inputs | DEV |
| D-PLN-F1 | New user creates current-month budget without seed and sees Budget page | DEV |
| D-PLN-F2 | Editing income/allocation updates planned+available after save | DEV |
| D-PLN-F3 | Duplicate month creation → clear recovery path to existing month | DEV |
| D-PLN-F4 | Month navigation loads month or clear empty state | DEV |
| D-PLN-F5 | Unsaved changes not discarded without warning | DEV |
| D-PLN-F6 | Category with transactions cannot be silently removed (set fixed) | DEV |
| D-PLN-B1 | Create → exactly one user-owned budget for valid month | DEV |
| D-PLN-B2 | Concurrent duplicate creation → one success + one 409, no duplicates | DEV |
| D-PLN-B3 | Update recalculates summary from stored authoritative fields | DEV |
| D-PLN-B4 | Invalid/duplicate category ids, negative/non-integer amounts rejected | DEV |
| D-PLN-B5 | Categories referenced by transactions never orphaned (fixed set) | DEV |
| D-PLN-B6 | User A cannot create/update User B's budget | DEV |
| D-PLN-Q1..Q6 | Fresh-account journey; create/edit/conflict/over-allocation/unsaved/missing-month; plan-change vs actuals; concurrency; policy sign-off (decisions table); progress evidence | QA |

### Stage F — Insights (Sprint 5)

| ID | Check | Owner |
|---|---|---|
| D-INS-D1 | Current month solid blue; previous month yellow; yellow line dashed | DEV/DES |
| D-INS-D2 | Series distinguishable via labels/line style, not color alone | DEV |
| D-INS-D3 | Tooltips show category/date, month, value, unit | DEV |
| D-INS-D4 | Each chart has accessible text summary | DEV |
| D-INS-D5 | Charts legible at 320 px or switch to accessible compact alternative | DEV |
| D-INS-D6 | Donut + cash-flow stack when a column would be <150 px | DEV |
| D-INS-F1 | All values from one coherent API response | DEV |
| D-INS-F2 | Fixture renders current total 8,420; donut percentages total 100 (documented rounding) | DEV |
| D-INS-F3 | Changing month updates title/labels/total/3 charts/legend/summaries together | DEV |
| D-INS-F4 | Keyboard users reach chart data or equivalent data table | DEV |
| D-INS-F5 | No-data / no-comparison states avoid misleading zero-change claims | DEV |
| D-INS-F6 | Responsive; no flattened chart images | DEV |
| D-INS-B1 | Current total = Σ current category actuals = last current cumulative point | DEV |
| D-INS-B2 | Previous total = Σ previous category actuals = last previous cumulative point | DEV |
| D-INS-B3 | Percentages from actual spending, documented rounding (decision #10) | DEV |
| D-INS-B4 | January compares with December of previous year | DEV |
| D-INS-B5 | Missing previous month → explicit no-comparison state, not 500 | DEV |
| D-INS-B6 | Other users' transactions never enter aggregation | DEV |
| D-INS-B7 | Representative aggregation within local performance budget (<500 ms for 1,000 tx) | DEV |
| D-INS-Q1..Q6 | Cross-chart coherence automation; HTTP normal/Jan-Dec/missing-prev/isolation; blue/yellow semantics; a11y tree; major review 3; regression | QA (developer provides `review-3-insights.md`) |

### Stage G — Responsive/accessibility/resilience (Sprint 6)

| ID | Check | Owner |
|---|---|---|
| D-RESP-D1 | Six approved compositions share one component system | DEV/DES |
| D-RESP-D2 | No final UI relies on screenshots | DEV |
| D-RESP-D3 | Body text ≥4.5:1, large text ≥3:1 contrast | DEV/DES |
| D-RESP-D4 | Focus indicators visible, unclipped | DEV |
| D-RESP-D5 | Touch ≥44×44, desktop pointer ≥32×32 | DEV |
| D-RESP-D6 | Motion nonessential, 160–220 ms, respects reduced motion | DEV |
| D-RESP-F1 | No horizontal scroll or clipped controls at supported viewports | DEV |
| D-RESP-F2 | Login/Budget/Insights/dialogs fully keyboard operable | DEV |
| D-RESP-F3 | Month tabs support arrow-key behavior | DEV |
| D-RESP-F4 | 200% zoom preserves content and operation | DEV |
| D-RESP-F5 | Session expiry redirects safely with explanation, no stale private data | DEV |
| D-RESP-F6 | Reduced motion removes nonessential movement | DEV |
| D-RESP-F7 | Production build: no console errors or a11y-critical findings | DEV |
| D-RESP-B1 | All validation errors use one documented shape | DEV |
| D-RESP-B2 | Unknown route/malformed ID/auth failure/conflict/500 → correct status class + safe message | DEV |
| D-RESP-B3 | Transaction history has enforced bounds + deterministic ordering | DEV |
| D-RESP-B4 | DB failure → correlated error log + safe client error | DEV |
| D-RESP-B5 | Shutdown doesn't truncate logs or accept work indefinitely | DEV |
| D-RESP-Q1..Q6 | Viewport matrix 320/390/768/1024/1440; keyboard+zoom journeys; a11y scan no critical; offline/slow/401/403-404/validation/conflict/500 recovery; defects closed; kit deviations documented | QA |

### Stage H — Hardening (Sprint 7)

| ID | Check | Owner |
|---|---|---|
| D-SEC-D1..D4 | Final design acceptance; screens/states documented; copy/colors approved; no a11y-critical design defects; shared naming | DES (developer supplies state inventory in README/API docs) |
| D-SEC-F1 | Coverage ≥70% overall, no critical module untested | DEV |
| D-SEC-F2 | Login → create budget → add expense → insights smoke passes | DEV |
| D-SEC-F3 | Production bundle has no secrets/debug logs | DEV |
| D-SEC-F4 | `npm audit` no unresolved critical; accepted items have rationale | DEV |
| D-SEC-F5 | Lint + production build pass from clean install | DEV |
| D-SEC-B1 | Every protected endpoint proves ownership filtering in automated tests | DEV |
| D-SEC-B2 | Injection-shaped input treated as data (parameterized queries), never executed | DEV |
| D-SEC-B3 | Oversized bodies rejected under documented limit (32 kb) | DEV |
| D-SEC-B4 | ≥1 log entry per request; errors logged; no passwords/tokens/cookies/notes/full financial bodies | DEV |
| D-SEC-B5 | Log rotation/retention bounds file growth | DEV |
| D-SEC-B6 | Real HTTP suite runs against actual listening server + isolated schema | DEV |
| D-SEC-B7 | Coverage met without omitting core calculation/security paths | DEV |
| D-SEC-Q1..Q7 | Clean-install validation; all checks pass; traceability matrix; three review records; ALL_LICENSES matches deps; no open critical/high; RC freeze (tag commit) | QA (developer provides matrix in README + `ALL_LICENSES`) |

### Stage I — Docs/reproducibility (Sprint 8)

| ID | Check | Owner |
|---|---|---|
| D-DOC-D1..D4 | Demo path Register→Budget→Add Expense→Insights→Comparison→Logout; presentation examples use final UI; design source editable; references separate | SUB (kit) / DEV (demo script `docs/demo-script.md`) |
| D-DOC-F1 | Clean browser session completes rehearsed primary journey | DEV |
| D-DOC-F2 | Refreshing any supported route works (SPA fallback when serving build) | DEV |
| D-DOC-F3 | Configuration environment-driven, no hard-coded machine URLs | DEV |
| D-DOC-F4 | Demo needs no devtools or manual DB edits | DEV |
| D-DOC-B1 | New environment starts from documented steps, no undocumented secrets | DEV |
| D-DOC-B2 | Demo seed explicit, deterministic, blocked from production execution | DEV |
| D-DOC-B3 | Health/auth/budget/transactions/insights pass final smoke | DEV |
| D-DOC-B4 | Request logs in documented external location, git-excluded | DEV |
| D-DOC-B5 | API examples and error contract match implementation | DEV |
| D-DOC-Q1..Q7 | Clean-room macOS setup via README; final checks on release commit; working demo; board+git show progress; learning log; mandatory before bonus; honest limitations | QA (developer provides all docs) |

### Release gates (roadmap §9)

R-PROD-1..3, R-FE-1..4, R-BE-1..5, R-QE-1..5 map 1:1 to the §9 checklists and
are each satisfied by the union of stage checks above; the final developer
test-report must list them with references to the stage checks that prove them.

## Findings to resolve

None. This is the first iteration: no QA findings, no design findings, no user
feedback, no prior developer self-test. `context.json` has an empty `feedback`
array.

## Architecture reference (read before executing tasks)

### Monorepo layout — npm workspaces `client/` + `server/`

Chosen because: one repo/one PR; root `package.json` already exists and npm
workspaces are native to Node 20/npm 10 (no extra tooling); `client`/`server`
names match the roadmap's frontend/backend boundary language; a single
`npm install` at root produces one lockfile (bonus requirement).

```text
/ (repo root)
├── package.json            # workspaces + delegating scripts (edit existing)
├── package-lock.json       # generated, committed
├── eslint.config.mjs       # flat config for both workspaces
├── .prettierrc.json
├── ALL_LICENSES.md         # dependency license inventory
├── README.md               # rewrite: product + setup + traceability
├── .env / .env.example     # DATABASE_URL (+ JWT_SECRET added; never printed)
├── docs/agile/board.md, docs/agile/progress-log.md, docs/agile/reviews/*.md
├── docs/api.md             # REST contract (Stage I finalizes)
├── docs/demo-script.md
├── client/
│   ├── package.json  vite.config.js  vitest.config.js  index.html
│   └── src/
│       ├── main.jsx  App.jsx
│       ├── styles/tokens.css      # verbatim copy of figma-kit design-tokens.css
│       ├── styles/global.css      # reset, fonts, focus ring, reduced motion
│       ├── lib/money.js  lib/dates.js  lib/copy.js  lib/categories.js
│       ├── api/client.js          # fetch wrapper: credentials, error parsing
│       ├── api/hooks.js           # react-query hooks per endpoint
│       ├── app/router.jsx  app/ProtectedRoute.jsx  app/PublicOnlyRoute.jsx
│       ├── app/AuthProvider.jsx   # /auth/me bootstrap + login/logout actions
│       ├── components/ui/Button.jsx TextButton.jsx TextInput.jsx
│       │   PasswordInput.jsx IconButton.jsx Card.jsx ProgressBar.jsx
│       │   Dialog.jsx MonthTabs.jsx Menu.jsx Skeleton.jsx
│       │   ErrorState.jsx EmptyState.jsx AppHeader.jsx ErrorBoundary.jsx
│       ├── pages/LoginPage.jsx RegisterPage.jsx NotFoundPage.jsx
│       ├── features/budget/BudgetPage.jsx SummaryMetrics.jsx CategoryRow.jsx
│       │   MonthNav.jsx BudgetFormPage.jsx ExpensePanel.jsx AddExpenseDialog.jsx
│       │   DeleteExpenseConfirm.jsx
│       └── features/insights/InsightsPage.jsx charts/BarChart.jsx
│           charts/DonutChart.jsx charts/LineChart.jsx charts/ChartTooltip.jsx
│           charts/Legend.jsx charts/VisuallyHiddenTable.jsx
│   └── tests/                     # vitest + testing-library component tests
└── server/
    ├── package.json  vitest.config.js
    ├── scripts/smoke.mjs
    ├── src/
    │   ├── index.js               # bootstrap + graceful shutdown
    │   ├── app.js                 # createApp(config) — exported for tests
    │   ├── config.js              # dotenv from repo root; validate; fail fast
    │   ├── db/pool.js  db/migrate.js  db/migrations/001_init.sql
    │   ├── logging/logger.js      # pino + pino-roll files, redaction
    │   ├── logging/httpLogger.js  # pino-http, metadata only
    │   ├── middleware/requestId.js auth.js validate.js rateLimit.js
    │   │   errorHandler.js notFound.js
    │   ├── routes/index.js authRoutes.js budgetRoutes.js
    │   │   transactionRoutes.js insightsRoutes.js healthRoutes.js
    │   ├── controllers/authController.js budgetController.js
    │   │   transactionController.js insightsController.js
    │   ├── services/authService.js budgetService.js transactionService.js
    │   │   insightsService.js calc.js   # calc.js = pure functions
    │   ├── repositories/userRepo.js budgetRepo.js transactionRepo.js
    │   ├── validation/schemas.js  # zod schemas
    │   ├── domain/categories.js   # DEFAULT_CATEGORIES constant
    │   ├── errors.js              # AppError(code, status, message, fieldErrors)
    │   └── seed/demoSeed.js
    └── tests/
        ├── unit/*.test.js
        └── integration/helpers/testDb.js testServer.js + *.test.js
```

### Package choices (all direct deps; add to `ALL_LICENSES.md` in same commit)

Server: `express` ^4.21 (MIT), `pg` ^8.13 (MIT), `zod` ^3.24 (MIT),
`bcryptjs` ^3 (MIT — pure JS, no native build, deterministic clean install),
`jsonwebtoken` ^9 (MIT), `cookie-parser` ^1.4 (MIT), `helmet` ^8 (MIT),
`cors` ^2.8 (MIT), `express-rate-limit` ^7 (MIT), `pino` ^9 (MIT),
`pino-http` ^10 (MIT), `pino-roll` ^3 (MIT — size-based file rotation),
`dotenv` ^16 (BSD-2-Clause).

Client: `react` + `react-dom` ^18.3 (MIT), `react-router-dom` ^6.28 (MIT),
`@tanstack/react-query` ^5 (MIT — the roadmap's "consistent query/cache
layer"), `lucide-react` (ISC — mandated icon family),
`@fontsource/inter` + `@fontsource/dm-serif-display` ^5 (code MIT, fonts OFL
— self-hosted so clean install needs no network fonts).

Charts are hand-rolled SVG React components (no chart library): the roadmap
requires keyboard-focusable data points, dashed-line semantics, text summaries,
and exact token colors; a small bespoke SVG layer is more mechanically
verifiable than fighting a library's a11y gaps, and avoids license/audit surface.

Dev/test: `vite` ^6 + `@vitejs/plugin-react` ^4 (MIT), `vitest` ^3 +
`@vitest/coverage-v8` ^3 (MIT), `@testing-library/react` ^16,
`@testing-library/jest-dom` ^6, `@testing-library/user-event` ^14 (MIT),
`jsdom` ^26 (MIT), `eslint` ^9 + `@eslint/js` + `eslint-plugin-react` +
`eslint-plugin-react-hooks` + `globals` + `eslint-config-prettier` (MIT),
`prettier` ^3 (MIT), `concurrently` ^9 (MIT, root only).

No supertest: integration tests `listen(0)` and use Node 20 global `fetch`
against `http://127.0.0.1:<port>` — a real listening server per the bonus rule.

### Database schema DDL (`server/src/db/migrations/001_init.sql`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month         text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  currency_code text NOT NULL DEFAULT 'USD',
  income_minor  bigint NOT NULL CHECK (income_minor >= 0),
  categories    jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_periods_user_month_unique UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS budget_periods_user_idx ON budget_periods (user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_period_id  uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  category_id       text NOT NULL,
  type              text NOT NULL DEFAULT 'expense' CHECK (type = 'expense'),
  amount_minor      bigint NOT NULL CHECK (amount_minor > 0),
  occurred_on       date NOT NULL,
  note              text CHECK (note IS NULL OR char_length(note) <= 200),
  client_request_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_dedupe_idx
  ON transactions (budget_period_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_user_period_idx
  ON transactions (user_id, budget_period_id);
CREATE INDEX IF NOT EXISTS transactions_period_date_idx
  ON transactions (budget_period_id, occurred_on);
```

`categories` JSONB shape (validated by zod on every write):
`[{ "id": "housing", "name": "Housing", "icon": "House", "color": "blue",
"displayOrder": 1, "plannedMinor": 400000 }, ...]` — exactly the five default
ids in `domain/categories.js` (housing/blue/House, groceries/green/ShoppingCart,
transport/yellow/CarFront, fun/coral/PartyPopper, savings/blue/PiggyBank),
default planned prefill 4000/1500/800/900/3000 (= 10,200).

`gen_random_uuid()` is built into PostgreSQL 13+ (Neon default). `migrate.js`
runs every `.sql` file in order inside a transaction, honoring `DB_SCHEMA`
(`CREATE SCHEMA IF NOT EXISTS` + `SET search_path`) so tests get isolated
schemas on the same Neon database.

### Environment variables (server `config.js`, fail fast on missing/invalid)

| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | already in root `.env`; never logged/printed |
| `JWT_SECRET` | yes | — | Stage A appends to `.env` via `printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env` (no echo of value); `.env.example` documents placeholder |
| `PORT` | no | `4000` | |
| `NODE_ENV` | no | `development` | |
| `LOG_DIR` | no | `<repo>/logs` | gitignored |
| `CORS_ORIGIN` | no | `http://localhost:5173` | strict allowlist |
| `DB_SCHEMA` | no | `public` | tests set `test_<runid>` |
| `BCRYPT_ROUNDS` | no | `10` | |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_AUTH_MAX` | no | `300` / `10` per 15 min | tests raise general, dedicated test lowers auth |
| `ALLOW_DEMO_SEED` | no | unset | seed refuses unless `=true` AND `NODE_ENV !== 'production'` |
| `SERVE_CLIENT` | no | unset | when `true`, serve `client/dist` + SPA fallback |

Client: Vite dev proxy `/api` → `http://localhost:4000` (no CORS in dev); the
API base is `import.meta.env.VITE_API_BASE ?? ''` so the built app served by
Express uses same-origin.

### REST contract (freeze now; document in `docs/api.md`)

All under `/api/v1`. Success = resource JSON with 2xx. Error envelope
(everywhere, including 404/500):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "safe text",
             "fieldErrors": { "email": "Enter a valid email" },
             "requestId": "uuid" } }
```

Codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `NOT_FOUND` 404
(also used for other users' resources — never reveal existence),
`CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `RATE_LIMITED` 429, `INTERNAL` 500.
Every response carries `X-Request-Id`. No stack traces to clients, ever.

| Method + path | Body (zod) | Success |
|---|---|---|
| `POST /auth/register` | `{email, password(≥8, ≤72)}` strict | 201 `{user:{id,email}}` + cookie |
| `POST /auth/login` | `{email, password}` strict | 200 `{user}` + cookie |
| `POST /auth/logout` | — | 204, clears cookie |
| `GET /auth/me` | — | 200 `{user}` / 401 |
| `GET /budgets/:month` | — | 200 read model (below) / 404 |
| `POST /budgets` | `{month, incomeMinor, categories:[{id, plannedMinor}]×5}` | 201 read model / 409 duplicate |
| `PATCH /budgets/:month` | `{incomeMinor?, categories?:[{id, plannedMinor}]}` | 200 read model |
| `GET /budgets/:month/transactions?limit&offset` | limit ≤200 default 50 | 200 `{transactions[], total, limit, offset}` order `occurred_on DESC, created_at DESC, id DESC` |
| `POST /budgets/:month/transactions` | `{categoryId, amountMinor>0 int, occurredOn:'YYYY-MM-DD' in month, note?≤200, clientRequestId? uuid}` | 201 `{transaction}`; retry with same `clientRequestId` → 200 same transaction |
| `DELETE /budgets/:month/transactions/:id` | `:id` uuid | 204 / 404 |
| `GET /insights/:month` | — | 200 (below) / 404 if no budget for `:month` |
| `GET /health` | — | 200 `{status:"ok", uptimeSeconds}` |

Budget read model (all money integer cents; server computes everything):

```json
{ "budget": { "id":"…","month":"2026-07","currencyCode":"USD",
  "incomeMinor":1250000,"plannedMinor":1020000,"availableMinor":230000,
  "actualMinor":842000,
  "categories":[{ "id":"housing","name":"Housing","icon":"House","color":"blue",
    "displayOrder":1,"plannedMinor":400000,"actualMinor":395700,
    "progressPercent":99,"state":"normal" }] } }
```

`state`: `normal` | `overspent` (actual>planned) | `unplanned` (planned=0 and
actual>0; `progressPercent` null then — never divide by zero).

Insights response:

```json
{ "insights": { "month":"2026-07","monthLabel":"July",
  "previousMonth":"2026-06","previousMonthLabel":"June","hasPrevious":true,
  "currentTotalMinor":842000,"previousTotalMinor":918000,
  "categories":[{ "id":"housing","label":"Housing","color":"blue",
     "currentMinor":395700,"previousMinor":430000,"sharePercent":47 }],
  "cashFlow":{ "labels":["Jul 1","Jul 6","Jul 11","Jul 16","Jul 21","Jul 26","Jul 31"],
     "currentCumulativeMinor":[…7 ints…],"previousCumulativeMinor":[…] } } }
```

Cash-flow sample days: 1, 6, 11, 16, 21, 26, last-day-of-month (clamped);
cumulative sums of expenses with `occurred_on <= sample day`. `hasPrevious:
false` → `previousTotalMinor: null`, empty previous series; frontend shows the
explicit no-comparison state. `insightsService` asserts coherence (D-INS-B1/B2)
before responding and throws `INTERNAL` on mismatch.

### Cross-cutting rules for the build phase

- Money: integer cents everywhere server-side; client parses user input by
  string splitting (`"42.50"` → `4250`), never `parseFloat` arithmetic;
  `formatMoney(minor)` renders `1,234` (en-US grouping, cents shown only when
  nonzero). One utility each side (`lib/money.js`, used by charts too).
- Ownership: every repo query includes `user_id = $n`; controllers take the id
  only from `req.user`; unauthorized/missing → 404 via the same code path.
- Logging: `pino` to `LOG_DIR/requests.log` and `LOG_DIR/error.log` through
  `pino-roll` (size `5m`, keep 5). Request log = metadata only (ts, level,
  requestId, userId?, method, route, status, durationMs). Redact paths:
  `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.note`,
  `res.headers['set-cookie']`. Never log request/response bodies.
- Tokens/design: only `var(--…)` values from `tokens.css`; copy strings from
  `lib/copy.js` mirroring `figma-kit/data/content.json` exactly; icons only
  from the icon map; focus ring `2px solid var(--color-focus)` with offset;
  transitions 180 ms wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Every dependency change updates `ALL_LICENSES.md` in the same commit.
- Commit at the end of every task group (A–I) with a message naming the stage,
  and move the matching `board.md` cards + append a `progress-log.md` entry.

## Ordered implementation tasks

Execute strictly in order. Each task lists files and the observable result.
"Verify" lines are the rollback-safe checkpoints — do not proceed while one fails.

### Stage A — Foundation (roadmap Sprint 0)

**A1. Root workspace + tooling.** Edit `/package.json`: add
`"workspaces": ["client", "server"]` and scripts (keep existing `workflow:*`):

```json
"dev": "concurrently -n server,client -c blue,green \"npm:dev -w server\" \"npm:dev -w client\"",
"lint": "eslint .",
"format:check": "prettier --check .",
"test": "npm test -w server && npm test -w client",
"test:integration": "npm run test:integration -w server",
"coverage": "npm run coverage -w server && npm run coverage -w client",
"build": "npm run build -w client",
"migrate": "npm run migrate -w server",
"seed:demo": "npm run seed:demo -w server",
"smoke": "npm run smoke -w server"
```

Add root devDeps: `concurrently`, `eslint`, `@eslint/js`, `globals`,
`eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-config-prettier`,
`prettier`. Create `eslint.config.mjs` (flat: node globals for `server/**` and
`tools/**`, browser globals + react plugins for `client/**`, ignore `dist`,
`coverage`, `.workflow`, `docs`), `.prettierrc.json`. Create `ALL_LICENSES.md`
listing every direct dependency + license from the table above.
Verify: `npm install` at root succeeds; `npm run lint` exits 0; `git status`
shows no lockfiles inside workspaces (single root lockfile).

**A2. Server skeleton.** Create `server/package.json` (`type: module`, scripts:
`dev: node --watch src/index.js`, `start: node src/index.js`,
`migrate: node src/db/migrate.js`, `seed:demo: node src/seed/demoSeed.js`,
`test: vitest run tests/unit`, `test:integration: vitest run tests/integration --no-file-parallelism`,
`coverage: vitest run --coverage`, `smoke: node scripts/smoke.mjs`) and deps
from the package table. Files: `src/config.js` (dotenv with explicit `path` to
repo-root `.env`; validate with zod; on failure print variable NAMES only and
exit 1), `src/errors.js` (`AppError`), `src/middleware/requestId.js`
(`crypto.randomUUID()`, sets `req.id` + `X-Request-Id`),
`src/logging/logger.js` + `httpLogger.js`, `src/middleware/notFound.js`,
`src/middleware/errorHandler.js` (AppError → envelope; unknown → 500 INTERNAL +
error log with stack server-side only), `src/routes/healthRoutes.js`,
`src/app.js` (`createApp(config)`: helmet, cors allowlist w/ credentials,
`express.json({ limit: '32kb' })`, cookie-parser, requestId, httpLogger,
routes, notFound, errorHandler; when `NODE_ENV==='test'` add
`GET /api/v1/__test/error` that throws), `src/index.js` (migrate-check no,
just listen; SIGINT/SIGTERM → `server.close()`, `pool.end()`, flush logger).
Verify: `npm run dev -w server` starts; `curl localhost:4000/api/v1/health`
returns `{"status":"ok",…}`; `logs/requests.log` gains one JSON line; unset
`JWT_SECRET` (env override, not `.env` edit) makes startup fail fast (D-FND-B1).

**A3. Database layer.** `src/db/pool.js` (pg `Pool`, `max 5`,
`options: -c search_path=<DB_SCHEMA>` when not public; keep `sslmode=require`
from the URL — if the pg version needs it, add `ssl: { rejectUnauthorized: false }`
only when host is not localhost), `src/db/migrations/001_init.sql` (DDL above),
`src/db/migrate.js` (create schema if needed, run files lexically in a
transaction, record in `schema_migrations(name text primary key, applied_at)`).
Append `JWT_SECRET` to `.env` via the documented `openssl rand` command
(never printing it) and update `.env.example` with all vars using placeholders.
Verify: `npm run migrate -w server` exits 0 twice (idempotent); `psql`-free
check: a tiny `node -e` script counts the three tables via the pool.

**A4. Server test harness.** `server/vitest.config.js` (coverage v8, thresholds
lines/statements/functions 70, branches 60, exclude migrations/seed/scripts),
`tests/integration/helpers/testDb.js` (create schema `test_<Date.now()>_<pid>`,
run migrations into it, return teardown that drops schema),
`tests/integration/helpers/testServer.js` (`createApp(testConfig)` +
`listen(0)`, returns `baseUrl`, cookie-jar helper for fetch),
`tests/unit/calc.test.js` (placeholder for `services/calc.js` first function),
`tests/integration/health.test.js`: GET /health 200 + documented shape +
`X-Request-Id` present; forced `__test/error` returns the 500 envelope and
appends to error log (D-FND-B4); assert log line lacks `DATABASE_URL` value and
bodies (D-FND-B5). Record the intentional-bug exercise (D-FND-Q4): commit a
deliberately wrong expectation, watch it fail, fix it; note both commits in
`progress-log.md`.
Verify: `npm test -w server` and `npm run test:integration -w server` pass.

**A5. Client skeleton.** `client/package.json` (scripts `dev: vite`,
`build: vite build`, `preview: vite preview`, `test: vitest run`,
`coverage: vitest run --coverage`), `vite.config.js` (react plugin, dev proxy
`/api → http://localhost:4000`), `vitest.config.js` (jsdom, setup file with
jest-dom), `index.html` (lang=en, title "Budgeting App"), `src/styles/tokens.css`
= byte-identical copy of `docs/design/figma-kit/tokens/design-tokens.css`,
`src/styles/global.css` (reset; `@fontsource` imports for Inter 400/500/600/700
and DM Serif Display 400; body bg `var(--color-background)` text
`var(--color-text-primary)` 16px Inter; visible focus ring; reduced-motion
media rule), `src/lib/copy.js` (strings from content.json: "Welcome back",
"Email", "Password", "Sign in", "Create account", "Budget", "Add expense",
"Spending insights"), `src/lib/money.js` + `src/lib/dates.js`
(`currentMonth()`, `previousMonth('YYYY-MM')`, `monthLabel`), `src/lib/categories.js`
(mirror of server constant), `src/app/router.jsx` with placeholder pages
(`/login`, `/register`, `/`→`/budget`, `/insights`, `*`), `ErrorBoundary`,
`main.jsx`, `App.jsx` (QueryClientProvider + RouterProvider). One component
test: `tests/Button.test.jsx` for `components/ui/Button.jsx` (renders label,
disabled blocks click, loading shows spinner + `aria-busy`).
Verify: `npm run dev -w client` renders all three placeholder routes without
console errors (D-FND-F2); `npm test -w client` passes; `npm run build` passes.

**A6. Delivery docs.** Rewrite `README.md` (description, stack, prerequisites
Node 20+, setup: copy `.env.example`→`.env`, fill DATABASE_URL + generated
JWT_SECRET, `npm install`, `npm run migrate`, `npm run dev`; scripts table;
mandatory-vs-bonus traceability table skeleton). Create `docs/agile/board.md`
seeded with every stage's cards (user story + acceptance + evidence per card;
Stage A cards → In progress), `docs/agile/progress-log.md` (entry: architecture,
schema decision #7, currency decision, testing strategy), `docs/agile/reviews/`
placeholder README. Commit Stage A; move cards to Done.
Verify: D-FND-Q2 — `git status` clean of `logs/`, `dist/`, `.env`.

### Stage B — Auth (Sprint 1)

**B1. Backend auth.** `src/validation/schemas.js` (registerSchema, loginSchema
— `.strict()`, email trim+lowercase, password 8–72), `src/repositories/userRepo.js`
(`createUser`, `findByEmail`, `findById` — parameterized), `src/services/authService.js`
(`register` → bcrypt hash, insert, on unique-violation throw `CONFLICT
EMAIL_TAKEN`; `login` → generic `UNAUTHENTICATED INVALID_CREDENTIALS` for both
unknown email and bad password, always run one bcrypt compare to equalize
timing; `signSession`/`verifySession` with jsonwebtoken),
`src/middleware/auth.js` (`requireAuth`: read cookie, verify, load user id →
`req.user`; else 401), `src/middleware/rateLimit.js` (general + strict auth
limiter using config), `src/routes/authRoutes.js` + `authController.js`
(register 201, login 200, logout 204 clears cookie, me). Wire into `app.js`.
Unit tests: schema rejection of unknown keys, email normalization, service
conflict/invalid-credential paths (mock repo), auth middleware token cases.
Integration tests (`tests/integration/auth.test.js`): full journey
register → me → logout → me 401 (D-AUTH-B1..B7); duplicate email 409; wrong
password vs unknown email → byte-identical error body; malformed body 400;
rate-limit test with low `RATE_LIMIT_AUTH_MAX`; log file has no password value.

**B2. Frontend auth.** `components/ui/TextInput.jsx` (external label, leading
icon slot, error text with `aria-describedby`), `PasswordInput.jsx` (Lucide
`LockKeyhole`, `Eye`/`EyeOff` toggle button `aria-label="Show password"/"Hide
password"`, `aria-pressed`, toggle keeps focus on the toggle — input focus
untouched), `TextButton.jsx`, `AppHeader.jsx` (logo 32, page title, `Menu.jsx`
popover from `IconButton` `EllipsisVertical` with items Edit budget / Logout —
Edit budget disabled until Stage E). `app/AuthProvider.jsx`: on mount `GET
/auth/me` (react-query); exposes `{user, status, login, register, logout}`;
`ProtectedRoute` renders nothing (skeleton) while status pending — no private
flash (D-AUTH-F3); `PublicOnlyRoute` redirects authed users to `/budget`.
`pages/LoginPage.jsx` + `RegisterPage.jsx` per approved Login composition
(logo 80, DM Serif "Welcome back", email + password, primary "Sign in" 48px,
text button "Create account" linking `/register`; register page mirrors with
Create account submit). Client validation before submit; server `fieldErrors`
mapped to inputs; submit button disabled+loading while pending (D-AUTH-F5).
`api/client.js`: `fetch` with `credentials:'include'`, JSON, throws
`ApiError{code,status,message,fieldErrors,requestId}`; on 401 from private
calls dispatch `session-expired` event (used in Stage G).
Component tests: login validation messages, password toggle behavior, double
submit blocked, register field errors from mocked 409.
Verify (manual, both 390 and 1440 px): register→Budget placeholder,
logout→Login, refresh persistence; keyboard-only pass. Write
`docs/agile/reviews/review-1-auth.md`. Commit Stage B.

### Stage C — Budget read model + Budget screen (Sprint 2)

**C1. Calculation service.** `src/services/calc.js` — pure, unit-tested:
`summarizeBudget(budgetRow, actualsByCategory)` → read model (planned sum,
available, per-category actual/progress/state per decisions #10 and zero-plan
rule); `monthRange(month)` → first/last date strings; `previousMonth(month)`
(handles January→December); `largestRemainderShares(values)` → integers
summing to 100 (all-zero → all-zero shares).
Unit tests: normal (kit numbers: planned 10200 → available 2300; housing
2520/4000 → 63), empty (no tx), overspent (>100 preserved, state overspent),
zero-plan (progress null, state unplanned), January previous-month.

**C2. Budget read API.** `src/repositories/budgetRepo.js` (`findByUserAndMonth`,
`createBudget`, `updateBudget`), `transactionRepo.js` (`sumByCategory(userId,
budgetPeriodId)` via `SELECT category_id, SUM(amount_minor)… GROUP BY`),
`src/services/budgetService.js` (`getBudgetReadModel(userId, month)` → 404
`BUDGET_NOT_FOUND` when absent), `budgetRoutes.js`/`budgetController.js`
`GET /budgets/:month` behind `requireAuth`, month param zod-validated
(D-BUD-B1). Integration tests: seeded fixture returns exact kit totals
(D-BUD-F2 numbers at API level), invalid month 400, user isolation 404
(D-BUD-B4), zero-plan category no error, boundary dates: tx on first/last day
of month included, adjacent month excluded.

**C3. Demo seed.** `src/seed/demoSeed.js`: refuses unless `ALLOW_DEMO_SEED=true`
and `NODE_ENV!=='production'`; deterministic; creates/refreshes user
`demo@example.com` / `DemoPass123!`; budgets for the current and previous
calendar months (income 1,250,000; plans 400000/150000/80000/90000/300000);
fixed transaction lists whose per-category totals equal the kit insights data —
current month: housing 395700, groceries 151600, transport 84200, fun 92600,
savings 117900 (Σ 842000); previous: 430000/170000/90000/100000/128000
(Σ 918000) — spread across fixed days (1,3,5,8,11,14,17,20,23,26,28) so the
cumulative line is meaningful. Idempotent: deletes and re-inserts the demo
user's data only. Document in README. (Recorded deviation: with one coherent
dataset, Budget progress bars show ~99/101/105/103/39%, not the illustrative
63/34/26/28/56 of `content.json` — Section 2.2 totals 10,200/8,420 are
authoritative; see Risks.)

**C4. Budget screen.** `Card.jsx`, `ProgressBar.jsx` (track 8px,
`role="progressbar"` with `aria-valuenow` capped display at 100 but text shows
real %, semantic color, overspent adds coral `TriangleAlert` icon + "over plan"
text — not color alone), `SummaryMetrics.jsx` (three metrics row: Income /
Planned / Available; negative available → coral + warning text),
`CategoryRow.jsx` (tinted icon circle via `--color-<c>-100` bg + `500` icon,
label, amount, progress, SR text per D-BUD-F6), `features/budget/BudgetPage.jsx`
(react-query `useBudget(month)`; states: skeleton, no-budget → EmptyState with
"Create budget" button (routes to Stage E form; until then renders the E form
task placeholder — acceptable inside single delivery since stages land in one
PR), error → ErrorState with Retry (refetch), success; "Add expense" primary
button full-width mobile / content width desktop, disabled tooltip until Stage
D wires it — remove any dead state before Stage G). Month shown from
`currentMonth()`. Component tests with mocked API: all four states, fixture
renders 12,500/10,200/2,300 formatted, progress text.
Verify manual at 320/390/1024/1440: no horizontal scroll. Commit Stage C.

### Stage D — Expenses (Sprint 3)

**D1. Transactions API.** zod: `createTransactionSchema` (strict; `amountMinor`
positive int; `occurredOn` date string within `:month` — cross-checked in
service; note ≤200 trimmed; optional `clientRequestId` uuid), list query schema
(limit 1–200 default 50, offset ≥0). `transactionRepo.js`: `insert`,
`deleteByIdAndUser`, `listByBudget(userId, budgetPeriodId, limit, offset)` +
`countByBudget`; on dedupe unique violation return the existing row (idempotent
200). `transactionService.js`: resolve budget by `(userId, month)` first (404
if absent), validate category id against the budget's categories, wrong-month
date → `VALIDATION_ERROR` fieldError `occurredOn`. Routes GET/POST
`/budgets/:month/transactions`, DELETE `…/:id` (uuid-validated; unowned or
missing → 404 same body). Integration tests: create→budget aggregate delta→
delete→aggregate rollback (D-EXP-Q1 enabler); every rejection case of D-EXP-B2
mutates nothing (count unchanged); cross-user add/delete 404; duplicate
`clientRequestId` → one row; precision case: amounts 1099 + 2101 → 3200
exactly; list pagination + deterministic order; log lines exclude `note`.

**D2. Expense UI.** `components/ui/Dialog.jsx` (portal; `role="dialog"`
`aria-modal` labelled by title; focus moved in on open, trapped (Tab cycle),
Esc closes, focus returned to the opener; bottom-sheet styling <768px, centered
480px card ≥768px). `AddExpenseDialog.jsx`: amount `TextInput`
(`inputMode="decimal"`, string-parsed to cents, numeric mobile keyboard),
category select (five options with icons), date input (`type="date"`,
min/max = month bounds), note textarea (counter 200), Cancel + Save (pending
state; generates `clientRequestId` per submission attempt-set; disabled while
pending → single submit). On success: close, toast/status "Expense added"
(`role="status"`), `invalidateQueries(['budget', month], ['transactions',
month], ['insights'])`. On failure: dialog stays, values preserved, error
banner with Retry. `ExpensePanel.jsx` below categories: "Recent expenses"
list (date, category icon+name, amount, note excerpt, delete `IconButton`
labelled "Delete <category> <amount> on <date>"); `DeleteExpenseConfirm.jsx`
dialog naming the transaction; cancel = no mutation. Empty list state text.
Component tests: dialog focus trap/return, field validation, double-click one
call, failed save preserves values, confirm-delete flow.
Verify manual at 390 + 1440: add→progress moves, delete→restores; numeric
keyboard on mobile emulation. Write `review-2-expenses.md`. Commit Stage D.

### Stage E — Create/edit plans + month navigation (Sprint 4)

**E1. Budget write API.** zod `createBudgetSchema` (strict: month, incomeMinor
≥0 int, categories exactly the 5 default ids each with plannedMinor ≥0 int;
names/icons/colors/displayOrder are filled from `domain/categories.js`, client
cannot alter them), `patchBudgetSchema` (incomeMinor and/or categories subset —
each entry `{id, plannedMinor}`). `budgetService.createBudget`: insert; unique
violation → 409 `BUDGET_EXISTS` (safe under concurrency — DB constraint is the
arbiter, D-PLN-B2); `updateBudget`: load owned row (404), merge planned
amounts, persist, return fresh read model. Integration tests: create → read
model correct; concurrent duplicate creates (two parallel fetches) → one 201 +
one 409; patch recalculates; invalid category id / duplicate ids / negative /
non-integer rejected; cross-user create-for-other impossible by construction
(user id from session only) + patch other's month → 404; over-allocation
(planned > income) accepted and `availableMinor` negative.

**E2. Plan UI + month navigation.** `features/budget/BudgetFormPage.jsx`
(routes `/budget/new?month=YYYY-MM` and `/budget/:month/edit`): income field,
five category rows (icon, name, planned amount input — single column on
mobile), live footer "Planned X · Available Y" recomputed per keystroke
(string-parse), warning banner when planned > income ("You've planned more
than your income" — allowed, D-PLN-D3), Save/Cancel; unsaved-changes guard
(beforeunload + router blocker with confirm dialog, D-PLN-F5); server 409 →
message with link to the existing month (D-PLN-F3); validation/server errors
keep state (D-PLN-F1..F2). Prefill: create → kit defaults; edit → current
values. `MonthNav.jsx` on BudgetPage header: prev/next `IconButton`s
(`ArrowLeft`/rotated) + month label; navigating to a month without a budget →
EmptyState "No budget for <Month> yet" + Create action (D-PLN-F4). Menu item
"Edit budget" enabled. Component tests: live totals, over-allocation warning,
guard triggers, conflict recovery link, month navigation empty state.
Verify manual: fresh user (new registration) reaches personal budget with no
seed (D-PLN-F1) at 320/390/1440. Commit Stage E.

### Stage F — Insights (Sprint 5)

**F1. Insights API.** `insightsService.getInsights(userId, month)`: resolve
current budget (404 `BUDGET_NOT_FOUND` if absent); previous month via
`calc.previousMonth`; aggregate SQL per month: totals + per-category sums, and
per-day sums for cumulative series over sample days (one query per month using
`GROUP BY category_id` and one using `GROUP BY occurred_on`, computed into the
7-point series in JS); shares via `largestRemainderShares`; assert coherence
(sum of categories = total = last cumulative point for each month) else throw;
`hasPrevious=false` when no previous budget (still 200). Month labels from a
fixed English month-name table. Index check: `EXPLAIN` on the aggregation in a
dev script; existing `transactions_period_date_idx` covers it. Integration
tests: kit fixture returns 842000/918000 with shares [47,18,10,11,14] (=100);
January→December cross-year; missing previous → explicit `hasPrevious:false`;
isolation (other user's tx absent); perf guard: seed ~1,000 tx in test schema,
response < 500 ms locally (soft assertion logged, hard fail > 2 s).

**F2. Charts + Insights screen.** `charts/` shared conventions: pure SVG,
`viewBox` responsive, colors only `--color-blue-500` (current) /
`--color-yellow-500` (previous), each chart wrapped in `<figure>` with
`<figcaption>` text summary (e.g., "You spent 8,420 in July versus 9,180 in
June — 760 less."; summaries composed from data, D-INS-D4) and a
`VisuallyHiddenTable` (real `<table>` of series values) for keyboard/SR access
(D-INS-F4). `ChartTooltip.jsx`: single tooltip div positioned per focused/
hovered element showing "<Category/date> — <Month>: <value>" (D-INS-D3).
`BarChart.jsx`: grouped pairs per category; each bar focusable
(`tabindex=0`, `role="img"`, `aria-label`); previous-month bars also carry a
diagonal-line SVG pattern so series differ beyond color. `DonutChart.jsx`:
stroke-dasharray segments per category using category semantic colors,
center = current total; `Legend.jsx` right ≥768px / bottom below, items
"Housing 47%". `LineChart.jsx`: two paths — current solid blue, previous
dashed (`stroke-dasharray 6 4`) yellow; focusable circles at the 7 sample
points; labels from API. `MonthTabs.jsx`: two tabs [previousLabel,
currentLabel], `role="tablist"`, arrow-key navigation, selected current = blue
fill/white text, selected previous = yellow fill/near-black text (kit rule).
`InsightsPage.jsx`: header + menu, tabs, hero total (`formatMoney`) +
comparison line ("vs 9,180 last month" pattern; when `hasPrevious` false or
selected month has no data → explicit "No data to compare" state, never a fake
0-change claim, D-INS-F5), bar (8 cols) / donut (4) / line (12 below) per
responsive spec; donut+line stack when column <150px; min chart card height
280px; loading skeletons + error retry. Selecting the previous tab refetches
`/insights/<previousMonth>` so every element updates together (D-INS-F3).
Component tests: given a fixed insights fixture — summaries text, table
fallback contents, tabs arrow-key selection, no-comparison state, donut legend
percentages total 100.
Verify manual 320/390/768/1024/1440 with seeded demo data; keyboard walk of
all three charts. Write `review-3-insights.md`. Commit Stage F.

### Stage G — Responsive, accessibility, resilience (Sprint 6)

**G1. Frontend audit + recovery.** Sweep every page/dialog at
320/390/768/1024/1440: fix horizontal scroll, clipped focus rings, target
sizes (44/32 px rules) — adjust component CSS only. Add `NotFoundPage` (in-app
404 with link home); session-expiry handling: `api/client.js` `session-expired`
event → AuthProvider clears user, router redirects to
`/login?reason=session-expired`, LoginPage shows "Your session expired — please
sign in again" (no stale data remains because react-query cache is cleared,
D-RESP-F5); offline/network failure → existing ErrorState retry paths verified
+ `navigator.onLine` hint text; ensure all transitions inside reduced-motion
media queries; stable skeleton sizes to avoid layout shift; lazy-load
Insights route (`React.lazy` + suspense skeleton). Verify D-RESP-F7: build +
preview, console clean.

**G2. Backend consistency.** Audit all endpoints return the single error
envelope with correct codes/status (add integration snapshot test iterating
malformed id, unknown route, unauthenticated, conflict, validation, forced
500); confirm list bounds (limit clamp) + deterministic order test; DB-failure
path: integration test points a request at a closed pool/broken schema →
500 INTERNAL + correlated error-log entry, no crash (D-RESP-B4); graceful
shutdown test: start real server, send SIGTERM, assert port closes and process
exits 0 with final log line flushed (D-RESP-B5, also covers D-FND-B6).

**G3. Accessibility pass.** Headings hierarchy per page (one `h1`), labels,
`aria-live` for toasts/status, dialog semantics re-checked, contrast audit of
every token pairing used (document results in
`.workflow/.../developer/evidence/contrast.md` — text-secondary on background,
white on blue-500, near-black on yellow-500), 200% zoom manual pass, keyboard
journey checklist executed and recorded. Fix findings. Commit Stage G.

### Stage H — Security, observability, coverage (Sprint 7)

**H1. Security review + tests.** Checklist executed and recorded in evidence:
cookie flags (HttpOnly/SameSite/secure-in-prod — assert in integration test),
helmet headers present (test), CORS rejects a foreign Origin (test), rate
limiting effective (existing test), body limit 413 test (>32kb), injection
corpus test (`' OR 1=1--`, `"; DROP TABLE`, `$where`-style strings) sent as
email/note/category/month → 400 or safely stored as text, never an SQL error
(D-SEC-B2); ownership matrix test: every private endpoint × foreign-user
session → 401/404 only (D-SEC-B1); confirm `client/dist` bundle contains no
env secret (`grep` for obvious markers in a script — never the real values);
`npm audit --omit dev` review, rationale recorded for any accepted advisories.

**H2. Coverage + cleanup.** Run `npm run coverage` both workspaces; add unit/
component tests for uncovered branches (target: money/date utils, calc.js,
services, auth middleware, form validation, recovery states) until ≥70%
lines/statements/functions each workspace; remove dead code/console.log;
`scripts/smoke.mjs`: against a running server (env `SMOKE_BASE_URL`, default
`http://localhost:4000`), executes register(unique email)→create budget→add
expense→get budget (assert delta)→insights(assert coherence)→delete expense→
logout, exits non-zero on any failure (D-SEC-F2). Log-rotation proof: temp
LOG_DIR + low `pino-roll` size limit in a script, assert multiple bounded
files (D-SEC-B5). Update README traceability matrix with evidence links;
verify `ALL_LICENSES.md` against both package.json files. Commit Stage H
(release-candidate commit; note hash in progress log — the tag itself is the
orchestrator's/PR's concern).

### Stage I — Documentation and reproducibility (Sprint 8)

**I1. Serve-client mode + final docs.** `app.js`: when `SERVE_CLIENT=true`,
`express.static(client/dist)` + SPA fallback for non-`/api` GETs (D-DOC-F2).
`docs/api.md`: full endpoint reference with real (sanitized) request/response
examples captured from the integration run + error contract table. README
final: architecture diagram (mermaid), data model, env table, run/test/coverage/
seed/smoke/log locations, backup/reset note (re-run migrate + seed), demo
credentials, known limitations (savings semantics, no expense edit, illustrative
kit progress percentages — see Risks), mandatory-vs-bonus table completed.
`docs/demo-script.md`: rehearsed path Register→Budget→Add Expense→Insights→
Comparison→Logout with fallback notes. Final board/progress-log update (all
cards Done except accepted-limitation notes).

**I2. Clean-room validation.** From a pristine checkout simulation:
`rm -rf node_modules client/node_modules server/node_modules && npm ci &&
npm run lint && npm test && npm run test:integration && npm run coverage &&
npm run build`, then `npm run migrate`, `ALLOW_DEMO_SEED=true npm run seed:demo`,
start server with `SERVE_CLIENT=true` + built client, run `npm run smoke`, and
walk the demo script in a clean browser profile at 390 and 1440. Record all
exit codes and evidence. Commit Stage I. Then produce
`developer/test-report.json` per the artifact contract (every D-* check listed
with status/evidence; SUB/QA/DES rows `not_applicable` with reasons).

## Test plan

Working directory for all commands: repo root. Integration tests require the
real `DATABASE_URL` in `.env` (isolated `test_*` schemas are created/dropped
per run; never touch `public` data).

| Command | When | Expected |
|---|---|---|
| `npm install` (once), later `npm ci` | A1, I2 | exit 0, single root lockfile |
| `npm run lint` | every stage | exit 0 |
| `npm test -w server` | every server change | all unit tests pass |
| `npm run test:integration -w server` | every API change | all pass against real listening server + Neon test schema |
| `npm test -w client` | every UI change | all component tests pass |
| `npm run coverage` | H2, I2 | thresholds met: ≥70% lines/statements/functions (branches ≥60) in each workspace |
| `npm run build` | A5, G1, H, I | vite build exit 0, no warnings treated as errors |
| `npm run migrate` | A3+ | exit 0, idempotent second run |
| `ALLOW_DEMO_SEED=true npm run seed:demo` | C3+ | exit 0, deterministic totals (842000/918000) |
| `npm run smoke` (server running) | H2, I2 | journey passes, exit 0 |
| `npm run workflow:validate` | before handoff | exit 0 (state untouched) |

Key automated cases (must exist; failures block the stage):

- Unit: money parse/format round-trips (`"42.50"`↔4250, `"1,234"` display);
  `summarizeBudget` normal/empty/overspent/zero-plan; `previousMonth('2026-01')
  === '2025-12'`; largest-remainder shares sum to 100 (incl. all-zero);
  month-range boundaries; email normalization; password policy.
- Integration (real HTTP): health + log entry + request-id; forced 500 + error
  log; register/login/logout/me journey; duplicate email 409; identical
  invalid-credential bodies; cookie flags; rate limit 429; budget read fixture
  totals; month boundary inclusion/exclusion; two-user isolation on every
  private endpoint; create/delete expense with aggregate delta + rollback;
  idempotent `clientRequestId`; validation rejections mutate nothing; precision
  sum; pagination bounds/order; concurrent budget-create 201+409; patch
  recalculation; over-allocation negative available; insights fixture
  842000/918000 + shares 100; Jan/Dec; missing-previous; injection corpus;
  413 oversized body; CORS foreign-origin rejection; shutdown closes cleanly.
- Component: Button/TextInput/PasswordInput states; login/register validation
  and double-submit; Budget page four states + SR progress text; expense dialog
  focus trap/preserved values/single submit; delete confirm; plan form live
  totals/warning/unsaved guard; month tabs arrow keys; chart summaries, hidden
  tables, no-comparison state.

Manual/browser verification (evidence: screenshots under
`.workflow/sprints/delivery/iteration-01/developer/evidence/`, named
`<stage>-<screen>-<width>.png`):

- Widths 390 + 1440 for every stage's touched screens; full matrix
  320/390/768/1024/1440 at Stages G and I.
- Keyboard-only journeys (login, budget, expense dialog, insights) at Stage G/I;
  200% zoom; reduced-motion emulation; browser console clean.
- Visual comparison against `docs/design/approved/*` compositions and kit
  tokens at 390/1440 before handoff.

## Risks, assumptions, and blockers

Risks:

1. **Kit-internal data inconsistency (accepted, documented):**
   `content.json` budget `progressPercent` values (63/34/26/28/56) are
   inconsistent with the authoritative totals (planned 10,200, July actual
   8,420, insights category actuals). One coherent seeded dataset cannot show
   both. Decision: seed follows Section 2.2 + insights numbers (authoritative
   per source-of-truth §3); Budget progress bars therefore show ~99/101/105/
   103/39%. The 63% housing example remains the unit-test fixture for the
   calculation rule. Flagged for design review as a recorded product decision,
   not an undocumented deviation. If the design reviewer or user overrules,
   only `demoSeed.js` changes.
2. **Neon TLS/latency:** `pg` + `sslmode=require` normally suffices; if
   connection fails, add explicit `ssl` config (task A3 fallback). Integration
   suites run serially (`--no-file-parallelism`) to stay inside Neon's
   connection limits; pool max 5. Remote latency may make the insights perf
   budget noisy — perf assertion is soft-logged, hard-fails only >2 s.
3. **Coverage threshold risk on charts/SVG:** mitigate with fixture-driven
   component tests asserting rendered numbers/labels rather than pixels.
4. **Single-PR vs three-review requirement:** substituted with in-repo review
   records + per-stage commits (see substitutions); QA audits those records.
5. **JWT stateless logout:** cookie clearance ends the browser session
   (roadmap-accepted mechanism); token revocation lists are out of scope —
   24 h expiry bounds exposure. Recorded in security checklist.

Assumptions:

1. `DATABASE_URL` in root `.env` is valid and reachable; the same Neon database
   hosts dev data (`public`) and disposable `test_*` schemas.
2. Appending `JWT_SECRET` to the gitignored `.env` (without printing it) is
   permitted local configuration, not a product-code change beyond this plan.
3. npm registry access is available for `npm install`.
4. The five-default fixed category set (decision #7) satisfies "custom
   categories are post-MVP" and every category-integrity clause.
5. Demo month is computed dynamically (today: 2026-07 → labels July/June),
   matching the kit's July/June example naturally during this delivery.

Blockers: none. All external-tool roadmap items have recorded in-repo
substitutions; no source conflicts require a user decision beyond the recorded
decisions and risk #1, which is deliberately surfaced to the review phases
rather than blocking the build.
