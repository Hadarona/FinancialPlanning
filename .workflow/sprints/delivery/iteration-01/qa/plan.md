# QA Plan

Delivery iteration 1 — independent functional coverage plan. Author: qa-engineer
(plan phase). Scope: functionality only; visuals/aesthetics belong to design
review. Sources verified against the real implementation (`server/src`,
`client/src`), not developer summaries.

**Independence rule.** All QA test code lives in NEW files under
`server/tests/qa/` and `client/tests/qa/`. QA tests import product code
(`server/src/**`, `client/src/**`) but never import or modify developer test
files (`server/tests/unit`, `server/tests/integration`, `client/tests/*.{js,jsx}`
at the top level). QA builds its own harness helpers and fixtures. No product
code, developer test, or configuration file is edited; no new config files are
needed (both `vitest.config.js` files already pick these paths up via path
arguments / default includes).

## Behavior contract

Authoritative behavior the tests assert, resolved per
`docs/workflow/source-of-truth.md` (roadmap §2.2/§3.4 > `docs/api.md` >
implementation):

1. **Money**: integer minor units (cents) everywhere; fields suffixed `Minor`.
   Client parses input by string splitting (`client/src/lib/money.js`), no
   float arithmetic. Display: en-US grouping, no currency symbol
   (`12,500`; cents only when nonzero: `4,200.50`).
2. **Budget read model** (`GET /api/v1/budgets/:month`): top-level
   `plannedMinor` = Σ category `plannedMinor`; `availableMinor` =
   `incomeMinor − plannedMinor` (may be negative — over-allocation allowed,
   recorded decision #2); `actualMinor` = Σ category actuals;
   `progressPercent` = `Math.round(actual/planned×100)`, preserved above 100;
   `plannedMinor === 0` → `progressPercent: null` with `state` `"unplanned"`
   when `actual > 0`, else `"normal"`; `actual > planned > 0` → `"overspent"`.
   Kit reference numbers: income 1,250,000 / planned 1,020,000 / available
   230,000 minor; July actual total 842,000 minor.
3. **Categories**: exactly the five fixed ids `housing, groceries, transport,
   fun, savings`; names/icons/colors/order are server constants; clients send
   only `{id, plannedMinor}`.
4. **Dates**: plain strings, `YYYY-MM` / `YYYY-MM-DD`, no timezone math.
   Month membership is string comparison against `monthRange` (leap-aware).
   January's previous month is December of the previous year.
5. **Expenses**: `amountMinor` positive integer; `occurredOn` inside `:month`;
   `note` ≤ 200 chars trimmed; optional `clientRequestId` (UUID) makes retries
   idempotent — repeat returns the existing row with **200** (first create is
   **201**); partial unique index `(budget_period_id, client_request_id)`.
   List ordering: `occurred_on DESC, created_at DESC, id DESC`; `limit` 1–200
   default 50, `offset` ≥ 0 default 0.
6. **Insights** (`GET /api/v1/insights/:month`): coherence guarantee —
   `currentTotalMinor` = Σ `categories[].currentMinor` = last
   `cashFlow.currentCumulativeMinor` point (same for previous); `sharePercent`
   integers via largest-remainder, summing to exactly 100 (all-zero → all 0);
   cash-flow samples at days 1, 6, 11, 16, 21, 26, last day; missing previous
   month → `hasPrevious: false`, `previousTotalMinor: null`, per-category
   `previousMinor: null`, empty previous series (never a 500).
7. **Auth**: JWT (HS256, 24 h) in HTTP-only `SameSite=Lax` cookie
   `bb_session`; register 201 / login 200 return `{user:{id,email}}` only;
   email trimmed+lowercased, unique; password 8–72 chars, bcrypt-hashed, never
   returned/logged; invalid credentials → identical 401 body whether the email
   exists or not; logout 204 clears the cookie; auth rate limit 10/15 min
   (env-overridable), general 300/15 min.
8. **Error contract**: single envelope
   `{error:{code,message,fieldErrors?,requestId}}`; codes
   VALIDATION_ERROR 400, UNAUTHENTICATED 401, NOT_FOUND 404, CONFLICT 409,
   PAYLOAD_TOO_LARGE 413 (32 kb JSON limit), RATE_LIMITED 429, INTERNAL 500.
   Every response carries `X-Request-Id`. No stack traces/SQL/paths to
   clients.
9. **Ownership/privacy**: every private query filters by session user at the
   repository layer; another user's resources answer **404** (never 403, no
   existence hint). Malformed transaction ids share the same 404 path.
10. **Concurrency/integrity**: `UNIQUE (user_id, month)` arbitrates duplicate
    budget creation (one 201 + one 409 under concurrency); DB CHECKs:
    `income_minor >= 0`, `amount_minor > 0`, note ≤ 200, month regex, email
    lowercase.
11. **Client behavior**: ProtectedRoute renders nothing while session
    bootstrap pends (no private flash), redirects anonymous → `/login`
    (`?reason=session-expired` after expiry, with copy "Your session expired —
    please sign in again."); PublicOnlyRoute redirects authenticated users off
    Login/Register; a 401 on any non-bootstrap call dispatches
    `session-expired`, which drops all cached private queries; logout clears
    the entire query cache. Expense mutations invalidate budget +
    transactions + insights queries. AddExpenseDialog keeps one
    `clientRequestId` across a failure→retry and regenerates it after
    success; Cancel/Escape never mutates; failed save preserves all values.
    BudgetFormPage: live planned/available preview, over-allocation warning,
    409 recovery link, unsaved-changes router blocker, fixed five category
    rows. Screen-reader progress sentence:
    `"Housing: 2,520 spent of 4,000 planned, 63%"`
    (`categoryProgressText` in `client/src/features/budget/CategoryRow.jsx`).
12. **Logging**: ≥1 structured entry per request in external rotating files
    (request + error logs), correlated by requestId; never contains
    passwords, tokens/cookies, note text, or full financial bodies.

## Acceptance-to-test traceability

Criterion ids are the developer plan's registry
(`developer/plan.md` §Acceptance criteria), which maps 1:1 to the roadmap's
checkbox criteria. Verification methods: `test` (QA test ids below),
`cmd` (scripted evidence command in "Commands and expected results"),
`inspect` (artifact inspection recorded in the QA run report),
`design` (out of QA scope — design review owns), `dev-env` (covered by
developer evidence; QA re-checks only via `cmd`).

### Stage A — Foundation

| Criterion | Method | QA coverage |
|---|---|---|
| D-FND-D1..D4 | design | Visual foundations — design review |
| D-FND-D5 | test | QA-CC-05, QA-CC-08, QA-CC-25, QA-CC-30 (focus/disabled/loading/error behavior, not looks) |
| D-FND-D6 | test | QA-CU-02 (no symbol, `12,500` format) |
| D-FND-F1 | cmd | CMD-1 (documented root commands run green) |
| D-FND-F2 | test | QA-CC-10..12, QA-CC-15 (routes render/redirect without crash) |
| D-FND-F3/F5/F6 | cmd/inspect | CMD-1 (lint/build), git status inspection |
| D-FND-F4 | dev-env | Developer-owned sample test; QA suite supersedes |
| D-FND-B1 | cmd | CMD-6 (fail-fast without env, names only — no values printed) |
| D-FND-B2 | test | QA-SI-80 (health via real listening server) |
| D-FND-B3 | test | QA-SI-87 (structured external log entry fields) |
| D-FND-B4 | test | QA-SI-83 (forced error → safe envelope + error log) |
| D-FND-B5 | test | QA-SI-87 (no secrets/bodies in logs) |
| D-FND-B6 | test | implicit in every QA-SI afterAll (`close()` returns cleanly); asserted in QA-SI-88 |
| D-FND-Q1..Q6 | inspect | README/board/progress-log/.gitignore inspection in run report |

### Stage B — Auth

| Criterion | Method | QA coverage |
|---|---|---|
| D-AUTH-D1, D-AUTH-D5, D-AUTH-D6 | design | Layout/target sizes/zoom |
| D-AUTH-D2 | test | QA-CC-03 (labels associated with inputs — functional query by label) |
| D-AUTH-D3 | test | QA-CC-05 (Show/Hide accessible name, focus does not move) |
| D-AUTH-D4 | test | QA-CC-02, QA-CC-08 (error/loading/disabled states) |
| D-AUTH-F1 | test | QA-CC-06; QA-RJ-01 (API side) |
| D-AUTH-F2 | test | QA-CC-01 |
| D-AUTH-F3 | test | QA-CC-10, QA-CC-12 (no private flash; restoration) |
| D-AUTH-F4 | test | QA-CC-02, QA-CC-03, QA-CC-07 |
| D-AUTH-F5 | test | QA-CC-04 (double submit → one POST) |
| D-AUTH-F6 | test | QA-CC-14 |
| D-AUTH-F7 | test | QA-CC-05, QA-CC-30/37 (keyboard/focus behavior); full visual focus check → design |
| D-AUTH-B1 | test | QA-SI-01 (no password material in any auth response) |
| D-AUTH-B2 | test | QA-SI-03 (case-variant duplicate → 409, single user) |
| D-AUTH-B3 | test | QA-SI-05 (identical 401 bodies) |
| D-AUTH-B4 | test | QA-SI-06 (missing/tampered/expired token) |
| D-AUTH-B5 | test | QA-SI-07 |
| D-AUTH-B6 | test | QA-SI-04, QA-SU-20..23 |
| D-AUTH-B7 | test | QA-SI-09, QA-SI-10 |
| D-AUTH-Q1..Q6 | test/inspect | QA-RJ-01, QA-SI-05..07, QA-SI-11; review-record inspection |

### Stage C — Budget read model

| Criterion | Method | QA coverage |
|---|---|---|
| D-BUD-D1..D5 | design | Visual hierarchy/breakpoints (D3's "not color alone" functional half → QA-CC-23) |
| D-BUD-F1 | test | QA-CC-21 (fixture swap changes every number) |
| D-BUD-F2 | test | QA-CC-20 (12,500 / 10,200 / 2,300) |
| D-BUD-F3 | test | QA-CC-22 (actual/planned, not planned/income); QA-SU-03 |
| D-BUD-F4 | test | QA-CC-26 |
| D-BUD-F5 | test | QA-CC-27 (retry keeps authenticated shell) |
| D-BUD-F6 | test | QA-CC-24 (exact sentence) |
| D-BUD-B1 | test | QA-SI-21, QA-SU-24 |
| D-BUD-B2 | test | QA-SI-20, QA-SU-01 |
| D-BUD-B3 | test | QA-SI-28, QA-SI-29 |
| D-BUD-B4 | test | QA-SI-29 |
| D-BUD-B5 | test | QA-SI-22 (incl. concurrent creates) |
| D-BUD-B6 | test | QA-SI-26, QA-SU-05/06 |
| D-BUD-B7 | test | QA-SU-01..09 (independent QA unit set) |
| D-BUD-Q1..Q6 | test | QA-SI-20 (independent fixture math), QA-SI-28 (boundaries), QA-SI-29 (2-user HTTP isolation), QA-CC-23/25/26/27 (states); regression = full suite green |

### Stage D — Expenses

| Criterion | Method | QA coverage |
|---|---|---|
| D-EXP-D1 | design | Sheet vs dialog presentation |
| D-EXP-D2 | test | QA-CC-32 (errors associated, role=alert) |
| D-EXP-D3 | test | QA-CC-35 (pending prevents duplicates) |
| D-EXP-D4 | test | QA-CC-40/41 (confirm identifies transaction) |
| D-EXP-D5 | test | QA-CC-30, QA-CC-37 (focus enter/trap/return) |
| D-EXP-F1 | test | QA-CC-31 |
| D-EXP-F2 | test | QA-CC-32 |
| D-EXP-F3 | test | QA-CC-30 |
| D-EXP-F4 | test | QA-CC-33 |
| D-EXP-F5 | test | QA-CC-35 |
| D-EXP-F6 | test | QA-CC-40..42 |
| D-EXP-B1 | test | QA-SI-40 (shape + stored once) |
| D-EXP-B2 | test | QA-SI-43, QA-SI-44, QA-SU-29..31 |
| D-EXP-B3 | test | QA-SI-49 |
| D-EXP-B4 | test | QA-SI-48 (missing/unowned/malformed share one 404) |
| D-EXP-B5 | test | QA-SI-51 (notes/amounts absent from logs) |
| D-EXP-B6 | test | QA-SI-45, QA-SI-46 (sequential + concurrent idempotency) |
| D-EXP-Q1..Q6 | test/inspect | QA-SI-40..42 (create→verify→delete→rollback, precision), QA-SI-49; QA-CC-30..37 substitute the manual mobile dialog pass at the functional level; review-record inspection |

### Stage E — Plans

| Criterion | Method | QA coverage |
|---|---|---|
| D-PLN-D1, D-PLN-D5 | design | Comprehension/layout |
| D-PLN-D2 | test | QA-CC-50 (live preview per keystroke) |
| D-PLN-D3 | test | QA-CC-51 (over-allocation warned, allowed) |
| D-PLN-D4 | test | QA-CC-57 + QA-SI-23 (fixed set, merge semantics) |
| D-PLN-F1 | test | QA-CC-52; QA-RJ-02 |
| D-PLN-F2 | test | QA-CC-55; QA-SI-23 |
| D-PLN-F3 | test | QA-CC-53 |
| D-PLN-F4 | test | QA-CC-28; QA-RJ-06 |
| D-PLN-F5 | test | QA-CC-56 |
| D-PLN-F6 | test | QA-CC-57 |
| D-PLN-B1 | test | QA-SI-20 |
| D-PLN-B2 | test | QA-SI-22 |
| D-PLN-B3 | test | QA-SI-23, QA-SI-31 |
| D-PLN-B4 | test | QA-SI-24, QA-SU-25..28 |
| D-PLN-B5 | test | QA-SI-23 (five categories always present after any patch) |
| D-PLN-B6 | test | QA-SI-29 |
| D-PLN-Q1..Q6 | test/inspect | QA-RJ-02/03, QA-SI-22/24/31, QA-CC-53/56; decisions table inspection |

### Stage F — Insights

| Criterion | Method | QA coverage |
|---|---|---|
| D-INS-D1, D-INS-D5, D-INS-D6 | design | Colors/responsive stacking |
| D-INS-D2 | design | (series distinguishability — visual) |
| D-INS-D3 | test | QA-CC-67 partially (tooltip/table data content); visual tooltip → design |
| D-INS-D4 | test | QA-CC-60 (accessible summaries exist with correct numbers) |
| D-INS-F1 | test | QA-CC-61 |
| D-INS-F2 | test | QA-CC-60 (8,420; shares sum 100) |
| D-INS-F3 | test | QA-CC-62 |
| D-INS-F4 | test | QA-CC-63, QA-CC-67 |
| D-INS-F5 | test | QA-CC-64, QA-CC-65 |
| D-INS-F6 | design/test | SVG (non-image) presence asserted in QA-CC-60; responsiveness → design |
| D-INS-B1/B2 | test | QA-SI-60 |
| D-INS-B3 | test | QA-SI-62, QA-SU-10 |
| D-INS-B4 | test | QA-SI-64, QA-SU-11 |
| D-INS-B5 | test | QA-SI-65 |
| D-INS-B6 | test | QA-SI-67 |
| D-INS-B7 | dev-env | Performance budget — developer evidence stands; not re-benchmarked |
| D-INS-Q1..Q6 | test/inspect | QA-SI-60..69, QA-RJ-07; a11y-tree numbers via QA-CC-60/67; review-record inspection |

### Stage G — Responsive/accessibility/resilience (functional slice)

| Criterion | Method | QA coverage |
|---|---|---|
| D-RESP-D1..D6, D-RESP-F1, D-RESP-F4, D-RESP-F6 | design | Viewport/zoom/motion matrix — design review |
| D-RESP-F2 | test | QA-CC-05/30/37/63 (keyboard operation of forms, dialog, tabs, menu: QA-CC-14) |
| D-RESP-F3 | test | QA-CC-63 |
| D-RESP-F5 | test | QA-CC-13 |
| D-RESP-F7 | cmd | CMD-1 (build), design review owns console/a11y scan |
| D-RESP-B1 | test | QA-SI-88 (envelope sweep) |
| D-RESP-B2 | test | QA-SI-80..83, QA-SI-48 |
| D-RESP-B3 | test | QA-SI-47 |
| D-RESP-B4 | dev-env | DB-interruption fault injection — accept developer evidence (`shutdown.test.js` inspected); re-testing requires product-level fault hooks QA must not add |
| D-RESP-B5 | test | QA-SI afterAll clean close + QA-SI-88 |
| D-RESP-Q1..Q6 | test/design | Functional halves above; viewport/zoom/offline visuals → design |

### Stage H — Hardening

| Criterion | Method | QA coverage |
|---|---|---|
| D-SEC-D1..D4 | design | Final design acceptance |
| D-SEC-F1 | cmd | CMD-5 (coverage run; thresholds enforced by config) |
| D-SEC-F2 | cmd | CMD-7 (`npm run smoke` primary journey against running server) |
| D-SEC-F3/F4/F5 | cmd/inspect | CMD-1; bundle grep + audit rationale inspection |
| D-SEC-B1 | test | QA-SI-11, QA-SI-29, QA-SI-49, QA-SI-67 (ownership matrix) |
| D-SEC-B2 | test | QA-SI-86 (injection corpus) |
| D-SEC-B3 | test | QA-SI-82 |
| D-SEC-B4 | test | QA-SI-87 |
| D-SEC-B5 | dev-env | Rotation proof (`logRotation.test.js`) inspected, not duplicated |
| D-SEC-B6 | test | Entire QA-SI layer (real listening server + isolated schema) |
| D-SEC-B7 | cmd/inspect | CMD-5 + this plan's critical-path traceability |
| D-SEC-Q1..Q7 | cmd/inspect | CMD-1..7; traceability/licenses/reviews inspection in run report |

### Stage I — Docs/reproducibility

| Criterion | Method | QA coverage |
|---|---|---|
| D-DOC-D1..D4 | design/inspect | Demo assets |
| D-DOC-F1..F4, D-DOC-B1..B5 | cmd/inspect | CMD-1, CMD-6, CMD-7, CMD-8 (guarded seed refusal), api.md-vs-implementation spot checks folded into QA-SI assertions (every QA-SI asserts documented shapes) |
| D-DOC-Q1..Q7 | inspect | Docs/board/history inspection in run report |

### Roadmap §7.2 regression journeys

| Journey | QA coverage |
|---|---|
| 1 register/restore/logout | QA-RJ-01, QA-CC-12 |
| 2 create first budget | QA-RJ-02, QA-CC-52 |
| 3 edit income/allocations | QA-RJ-03, QA-CC-55 |
| 4 add expense → progress | QA-RJ-04, QA-CC-31 |
| 5 delete expense → recalc | QA-RJ-05, QA-CC-40 |
| 6 switch month empty/existing | QA-RJ-06, QA-CC-28 |
| 7 insights reconciliation | QA-RJ-07, QA-SI-60/61 |
| 8 cross-user privacy | QA-RJ-08, QA-SI-11/29/49/67 |
| 9 validation/network failure/retry | QA-RJ-09, QA-CC-27/33 |
| 10 keyboard-only journeys | QA-CC-05/13/14/30/37/63 (component level); full-browser keyboard pass → design review |

## Risk and coverage matrix

Path types × areas (cell = representative QA test ids):

| Area | Success | Validation | Boundary | Empty | Error/Retry | Authz/Privacy | Concurrency |
|---|---|---|---|---|---|---|---|
| Auth | SI-01/02, CC-01/06 | SI-04, CC-02/03 | SU-21 (8/72 pwd), SI-08 (rate) | — | SI-05, CC-07 | SI-06/07/11 | CC-04 (double submit) |
| Budget read | SI-20, CC-20 | SI-21, SU-24 | SI-28 (month edges), SU-12 (leap) | SI-21/66, CC-26 | CC-27 | SI-29 | — |
| Budget write | SI-20/23, CC-52/55 | SI-24, SU-25..28 | SI-25/30 (0 income, over-alloc) | CC-26 | CC-53/54 | SI-29 | SI-22 (dup create race) |
| Expenses | SI-40, CC-31 | SI-43, CC-32 | SI-44 (day 1/last), SI-42 (precision), SI-47 (limit 1/200) | SI-47 | CC-33/34, SI-45 | SI-48/49 | SI-46 (idempotent race) |
| Insights | SI-60..63, CC-60 | SI-68 | SI-64 (Jan/Dec), SI-69 (leap 29) | SI-65/66, CC-64/65 | CC-66 | SI-67 | — |
| Platform/HTTP | SI-80 | SI-81 | SI-82 (32 kb) | — | SI-83/85, SI-88 | SI-11, SI-86 | — |
| Client shell | CC-10..12 | — | CC-28 (bad ?month) | CC-15 | CC-13/14/27 | CC-10/13 | — |

Financial invariants targeted explicitly: planned=Σplans, available=income−planned
(SU-01/02, SI-20), actual/planned progress semantics (SU-03..06, CC-22),
no float drift (SU-09, CU-01..03, SI-42), shares sum to 100 (SU-10, SI-62,
CC-60), cross-endpoint total reconciliation (SI-61), add/delete aggregate
rollback (SI-40/41).

Key defect classes this plan is designed to catch: planned/actual confusion,
float rounding drift, month-boundary and Jan/Dec/leap errors, ownership leaks
(existence disclosure, cross-user reads/writes), duplicate writes under retry
or race, incoherent chart aggregates, stale/leaked private client cache after
expiry/logout, silent mutation on rejected input, secret/PII leakage into logs
or responses, and error-envelope drift.

## Fixtures and environment

### Environment

- Prereq: repo-root `.env` provides `DATABASE_URL` and `JWT_SECRET`
  (verified present). **Never print, log, echo, or assert on their values.**
- Server integration tests load config exactly like the product does
  (`server/src/config.js` reads the root `.env`); each QA suite creates its
  own isolated Postgres schema named `test_qa_<timestamp>_<pid>_<rand8>`
  (satisfies `SAFE_SCHEMA_NAME`, never `public`), migrates it via
  `server/src/db/migrate.js`, and drops it in `afterAll` — same isolation
  model as the product supports (SET LOCAL-pinned pool), but through
  QA-owned helper code.
- Client tests run in the existing jsdom environment
  (`client/vitest.config.js` + `client/tests/setup.js` apply automatically —
  harness config, not developer test logic).

### QA-owned helpers (new files)

- `server/tests/qa/helpers/qaServer.js` — `startQaServer(overrides)`:
  builds a local env object (never mutates `process.env`) with
  `NODE_ENV: "test"` (unless overridden), `DB_SCHEMA: test_qa_…`,
  `LOG_DIR: <os.tmpdir()>/qa-logs-<uuid>`, optional
  `RATE_LIMIT_MAX`/`RATE_LIMIT_AUTH_MAX`; `loadConfig(env)` → `migrate` →
  `createApp(config)` → `app.listen(0)`. Returns `{ baseUrl, config,
  readLogEntries(fileName), close() }` where `close()` closes the listener,
  runs `app.locals.cleanup()`, drops the schema, removes the log dir.
  `readLogEntries` merges the pino-roll rotation family
  (`requests.log`, `requests.log.1`, …) into parsed JSON lines.
- `server/tests/qa/helpers/qaClient.js` — `createSession(baseUrl)`: minimal
  cookie-jar `fetch` wrapper (`request(path, {method, body, headers})`,
  JSON by default, captures `Set-Cookie`), plus conveniences
  `registerUser(session, {email?, password?})` (unique email
  `qa-<rand8>@example.com`, password `QaPassword1!`) and
  `mustJson(response, expectedStatus)`.
- `server/tests/qa/helpers/qaFixtures.js` — builders:
  `kitBudgetPayload(month)` → income 1250000, plans
  housing 400000 / groceries 150000 / transport 80000 / fun 90000 /
  savings 300000 (kit numbers); `expensePayload(overrides)`;
  `seedMonth(session, month, expenses[])` (create budget + POST expenses);
  independent expected-value calculators (recompute planned/available/
  progress/shares in the test, straight from roadmap §2.2 formulas — never
  by importing `calc.js` into integration assertions).
- `client/tests/qa/helpers/qaRender.jsx` — `renderApp({ routes, initialPath,
  ...})` building a `createMemoryRouter` tree with `QueryClientProvider`
  (retry off) + `AuthProvider` + the real route-guard components; also
  `renderWidget(ui)` for dialog/page-in-isolation cases.
- `client/tests/qa/helpers/qaFetch.js` — `installFetchMock(script)`:
  `vi.stubGlobal("fetch", …)` driven by an ordered/route-keyed script of
  `{ method, path (string|RegExp), status, json, delayMs? }`. Records every
  call as `{method, path, body}` for assertions. **Unmatched requests throw**
  so a test can never green-pass while silently hitting nothing.
- `client/tests/qa/fixtures/budgetFixtures.js` — `kitBudget()` (income
  1250000 / planned 1020000 / available 230000; Housing actual 252000 planned
  400000 → 63% "normal" for the sentence check), `variantBudget()` (every
  number different, for the fixture-swap test), `overspentBudget()`
  (progress > 100, state overspent), `unplannedBudget()` (planned 0, actual
  > 0), plus matching transactions-list payloads.
- `client/tests/qa/fixtures/insightsFixtures.js` — `kitInsights()`
  (currentTotalMinor 842000, coherent categories/cumulative, shares summing
  100), `noPreviousInsights()`, `zeroSpendingInsights()`, `variantInsights()`.
- `client/tests/qa/fixtures/authFixtures.js` — `user()` payloads and error
  envelope builders matching `docs/api.md` exactly.

### Data rules

- Every server test registers fresh users (unique random emails) inside its
  own schema — no reliance on demo seed, no cross-test state, safe to re-run.
- All expected money values are integers computed in-test from the roadmap
  formulas; no expected value is copied from an API response.
- Server suites run with `--no-file-parallelism` (one schema/pool set at a
  time against the remote Neon DB — mirrors the documented integration flag).

## Ordered test implementation

Build order below (fastest feedback first; later files reuse helpers proven by
earlier ones). During the build phase, prove each new file can fail for the
intended reason (temporarily invert one representative assertion per file,
observe the failure, restore) before the final run.

### 1. `server/tests/qa/unit/qa-calc.test.js`

Layer: server unit (pure calculations, no I/O). Imports
`server/src/services/calc.js`.
Command: `npm exec -w server -- vitest run tests/qa/unit`.
Setup: none. Fixtures: inline literal budget rows/actual maps.

| ID | Steps (setup → action) | Assertions | Defect detected |
|---|---|---|---|
| QA-SU-01 | `summarizeBudget` with kit row (income 1250000, plans 400000/150000/80000/90000/300000), empty actuals | `plannedMinor` 1020000, `availableMinor` 230000, `actualMinor` 0 | Planned/available formula wrong (§2.2) |
| QA-SU-02 | income 100000, plans summing 1020000 | `availableMinor === -920000` (negative preserved) | Over-allocation clamped/silently blocked |
| QA-SU-03 | category planned 4000_00, actual 2520_00, income 12500_00 | `progressPercent === 63` — and ≠ `round(planned/income×100)` (=32) | Progress computed from planned/income |
| QA-SU-04 | actual 4200_00 vs planned 4000_00 | `progressPercent === 105`, `state === "overspent"` (not capped at 100) | Overspend capped/hidden |
| QA-SU-05 | planned 0, actual 5000 | `progressPercent === null`, `state === "unplanned"`, no NaN/Infinity anywhere in output (JSON round-trip) | Division by zero / NaN leak |
| QA-SU-06 | planned 0, actual 0 | `progressPercent === null`, `state === "normal"` | Zero-plan false-flagged |
| QA-SU-07 | categories supplied in reversed displayOrder | output sorted ascending by `displayOrder` | Unstable category ordering |
| QA-SU-08 | actuals map with extra/missing category keys | missing → 0; top-level `actualMinor` = Σ category actuals only | Aggregate drift vs per-category values |
| QA-SU-09 | 1000 expenses of 3 minor + 3 of 3333 minor summed through `summarizeBudget` actuals | exact integer totals (12999 etc.), `Number.isInteger` on every money field | Float drift in aggregation |
| QA-SU-10 | `largestRemainderShares` on [395700,182100,120000,80000,64200], [1,1,1], [0,0,0], [7]  | each result sums to exactly 100 (or all-0 for zero input); [7]→[100]; deterministic tie order (lower index wins) | Shares don't total 100 / nondeterministic rounding |
| QA-SU-11 | `previousMonth("2026-01")`, `("2026-07")`; invalid `"2026-13"` | `"2025-12"`, `"2026-06"`; invalid throws | Jan→Dec rollover bug |
| QA-SU-12 | `daysInMonth`/`monthRange` for 2026-02, 2028-02, 2000-02, 2100-02, 2026-04, 2026-07 | 28/29/29/28/30/31; ranges `-01`..`-<last>` | Leap-year/century boundary error |
| QA-SU-13 | `cashFlowSampleDates("2028-02")`, `("2026-07")` | 7 dates; last = `2028-02-29` / `2026-07-31`; days 1,6,11,16,21,26 present | Wrong sample grid |
| QA-SU-14 | `cumulativeAtDates` with unsorted keys, gaps, empty map | monotonic non-decreasing; final = Σ inputs; empty → all zeros | Cumulative series diverges from total |
| QA-SU-15 | `shortDateLabel("2026-07-16")`, `monthName("2026-07")`; invalid inputs | `"Jul 16"`, `"July"`; invalid throws | Label/date drift vs contract |

### 2. `server/tests/qa/unit/qa-schemas.test.js`

Layer: server unit (validation). Imports `server/src/validation/schemas.js`.
Command: same as file 1. Setup: none; fixtures inline.

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-SU-20 | `registerSchema` on `"  User@EXAMPLE.com  "` | parses to `user@example.com` | Email not normalized → duplicate accounts |
| QA-SU-21 | passwords of length 7/8/72/73 | fail/pass/pass/fail | Off-by-one password bounds |
| QA-SU-22 | register/login body with extra key `admin:true` | rejected (strict) | Mass-assignment risk |
| QA-SU-23 | invalid emails (`"a@"`, `"a b@c.d"`), empty login password | rejected with messages | Weak input validation |
| QA-SU-24 | `monthSchema` on `2026-07` / `2026-00` / `2026-13` / `2026-7` / `202607` / `2026-07-01` | pass / fail ×5 | Month param laxity (D-BUD-B1) |
| QA-SU-25 | `createBudgetSchema`: 4 categories, 6, duplicate id, unknown id `"phones"` | all rejected | Category-set integrity bypass |
| QA-SU-26 | plannedMinor −1 / 100.5 / `"100"`; valid 0 | rejected ×3; 0 accepted | Negative/fractional cents accepted |
| QA-SU-27 | incomeMinor −1 / 0.5; 0 valid | rejected; 0 accepted | Negative income accepted |
| QA-SU-28 | `patchBudgetSchema`: `{}` rejected; income-only ok; 1-category subset ok; 6 categories/dup ids rejected | as stated | Patch laxity/emptiness |
| QA-SU-29 | `createTransactionSchema` amountMinor 0 / −1 / 1.5 / `"5"`; 1 valid | rejected ×4; 1 accepted | Non-positive/non-integer amounts |
| QA-SU-30 | occurredOn `2026-7-1`, `07/01/2026`; valid `2026-07-01` | rejected; accepted (month membership is service-level — asserted in QA-SI-44) | Date format laxity |
| QA-SU-31 | note of 200 / 201 chars; `""` → transformed to `undefined` | pass / fail / undefined | Note bound off-by-one |
| QA-SU-32 | clientRequestId `"not-a-uuid"`; valid UUID; absent | fail / pass / pass | Idempotency-key laxity |
| QA-SU-33 | `listTransactionsQuerySchema`: limit 0/201 fail, 1/200 pass, default 50; offset −1 fail, default 0; unknown query key fails | as stated | Unbounded/nondeterministic listing |

### 3. `client/tests/qa/qa-money.test.js` and 4. `client/tests/qa/qa-dates.test.js`

Layer: client pure-lib unit (jsdom irrelevant). Imports
`client/src/lib/money.js`, `client/src/lib/dates.js`.
Command: `npm exec -w client -- vitest run tests/qa`.

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CU-01 | `parseMoneyToMinor`: `"42.50"`, `"42"`, `"0.1"`, `"0.01"`, `"007"`, `"-3.10"`, `"0"` | 4250, 4200, 10, 1, 700, −310, 0 | String→cents parsing drift |
| QA-CU-02 | `formatMoney`: 1250000, 420050, 420000, 0, −230000, 842000 | `"12,500"`, `"4,200.50"`, `"4,200"`, `"0"`, `"-2,300"`, `"8,420"` (no symbol) | Display formatting drift (kit numbers) |
| QA-CU-03 | malformed parse inputs: `""`, `" "`, `"1,000"`, `"1e3"`, `"42.505"`, `".5"`, `"abc"`, non-string | all `null` | Malformed money silently accepted |
| QA-CU-04 | round-trip `minorToInputValue`↔`parseMoneyToMinor` over [0,1,10,99,100,101,4250,1250000,99999999] | identity | Lossy edit round-trip |
| QA-CU-05 | `previousMonth("2026-01")`, `nextMonth("2025-12")` | `"2025-12"`, `"2026-01"` | Client month rollover |
| QA-CU-06 | `monthRange("2028-02")`, `("2026-07")`; `monthLabel`, `monthYearLabel`, `shortDateLabel` samples | leap-aware ranges; `"July"`, `"July 2026"`, `"Jul 15"` | Client/server date-rule divergence |

### 5. `server/tests/qa/integration/qa-auth.http.test.js`

Layer: real HTTP integration (actual listening Express + isolated schema).
Command: `npm exec -w server -- vitest run tests/qa/integration --no-file-parallelism`.
Setup: `beforeAll startQaServer()` (one extra server with
`RATE_LIMIT_AUTH_MAX: 3` started inside QA-SI-08 only), `afterAll close()`.
Fixtures: `qaClient` sessions, unique emails.

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-SI-01 | POST `/auth/register` valid | 201; body exactly `{user:{id,email}}`; `Set-Cookie bb_session` with `HttpOnly` + `SameSite=Lax`; raw response text contains no `password`/hash substring | Credential leakage / cookie misconfig |
| QA-SI-02 | register `"  QA.User+X@Example.COM "` → login with lowercase form; GET `/auth/me` | login 200; me returns lowercase email | Normalization gap → login lockout |
| QA-SI-03 | register same email twice (second in different case) | second → 409 CONFLICT envelope; login with second password fails 401 (no second user) | Duplicate accounts |
| QA-SI-04 | register with bad email / 7-char password / extra key | 400 VALIDATION_ERROR with `fieldErrors`; subsequent login for that email 401 (nothing created) | Rejected input mutates state |
| QA-SI-05 | login wrong password (existing) vs unknown email | both 401; identical `code` + `message` (compare bodies minus `requestId`) | Account-enumeration leak (D-AUTH-B3) |
| QA-SI-06 | GET `/auth/me` with: no cookie; corrupted cookie value; JWT signed with `config.jwtSecret` but `expiresIn:"-1s"` (crafted via `jsonwebtoken`) | 401 UNAUTHENTICATED ×3 | Expired/forged token accepted |
| QA-SI-07 | register → me 200 → POST `/auth/logout` → me | logout 204 and Set-Cookie clears `bb_session`; me → 401 | Session survives logout |
| QA-SI-08 | dedicated server `RATE_LIMIT_AUTH_MAX:3`; 4 rapid logins | 4th → 429 RATE_LIMITED envelope | Brute-force throttle missing |
| QA-SI-09 | any auth success + failure | `X-Request-Id` header present; error body `requestId` equals header | Correlation broken |
| QA-SI-10 | after QA-SI-01..07, `readLogEntries("requests.log")` | ≥1 entry per request made; raw log text never contains the password string or `bb_session` token value | Secrets in logs (D-AUTH-B7) |
| QA-SI-11 | unauthenticated sweep: GET/POST/PATCH `/budgets*`, GET/POST/DELETE transactions, GET `/insights/:m` | every one → 401 UNAUTHENTICATED envelope | Unauthenticated data access |

### 6. `server/tests/qa/integration/qa-budget.http.test.js`

Setup: one server; per-test fresh registered session(s).

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-SI-20 | POST `/budgets` with `kitBudgetPayload("2026-07")`; GET it | 201; independent recomputation: planned 1020000, available 230000, actual 0; exactly five categories in server order with server names/icons/colors; every money field integer | Read-model math/constants wrong |
| QA-SI-21 | GET `/budgets/2026-05` (none); GET `/budgets/2026-13`, `/budgets/202607` | 404 NOT_FOUND; 400 VALIDATION_ERROR ×2 | Month validation/existence conflation |
| QA-SI-22 | POST same month twice sequentially; then `Promise.all` two creates of a new month | sequential second → 409; race → exactly one 201 + one 409; GET confirms one budget | Duplicate months under race (D-PLN-B2) |
| QA-SI-23 | PATCH income only; PATCH one category only | each 200 with full recalculation; untouched plans preserved; five categories always present | Patch merge drops/corrupts plans |
| QA-SI-24 | PATCH `{}` / negative income / duplicate category ids / unknown month | 400/400/400/404; GET shows budget unchanged after each | Rejected patch mutates |
| QA-SI-25 | create with income 100000, plans totaling 1020000 | 201; `availableMinor === -920000` | Over-allocation blocked/mismath (decision #2) |
| QA-SI-26 | budget with `fun` planned 0; POST fun expense; GET budget | 200; fun: `progressPercent null`, `state "unplanned"`, actual correct; no 500 | Zero-plan divide-by-zero |
| QA-SI-27 | expense larger than a category's plan | `progressPercent > 100` exact rounded value; `state "overspent"` | Overspend hidden |
| QA-SI-28 | budgets for 2026-06/07/08; expenses on 06-30, 07-01, 07-31, 08-01 (each into its own month) | July actual = 07-01 + 07-31 only; June/Aug actuals correct — no bleed | Month-boundary bleed |
| QA-SI-29 | user A creates 2026-07; user B GET + PATCH `/budgets/2026-07` | both → 404 (body identical to a truly-missing month); A's budget unchanged | Cross-user read/write (D-BUD-B4, D-PLN-B6) |
| QA-SI-30 | create with income 0 and one plan 0 | 201; available negative-or-zero math exact | Zero-value rejection (income may be 0) |
| QA-SI-31 | seed expense actual 2520_00 on plan 4000_00 (63%); PATCH plan to 2000_00 | progress becomes 126, `actualMinor` unchanged | Plan edit corrupts actuals (Stage E QA) |

### 7. `server/tests/qa/integration/qa-transactions.http.test.js`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-SI-40 | snapshot budget → POST expense (groceries 4250, note) → GET budget + list | 201 documented shape (`id`,`categoryId`,`amountMinor`,`occurredOn`,`note`,`createdAt`); category actual +4250, monthly actual +4250, progress = independent recomputation; list total 1 | Aggregates don't track writes |
| QA-SI-41 | DELETE that expense → GET budget | 204; budget byte-equal to pre-add snapshot (deep equality) | Rollback drift after delete |
| QA-SI-42 | POST 10×10 minor, 3×3333 minor, 1×99999999 minor | totals exactly 100 + 9999 + 99999999; all integers at every level | Floating-point money drift |
| QA-SI-43 | invalid POSTs: amount 0 / −5 / 10.5 / `"10"`; category `"phones"`; note 201 chars; unknown body key | each → 400 with the right `fieldErrors` key; list `total` unchanged after each | Rejected input stored |
| QA-SI-44 | occurredOn `2026-07-01` and `2026-07-31` accepted; `2026-06-30`, `2026-08-01`, `2026-07-32` rejected | 201/201; 400 with `fieldErrors.occurredOn` ×3 | Period-membership off-by-one |
| QA-SI-45 | POST with clientRequestId K → repeat identical POST | 201 then 200; same transaction `id`; list total 1 | Retry duplicates money (D-EXP-B6) |
| QA-SI-46 | `Promise.all` 2 identical POSTs (same K) | one 201 + one 200 (or equivalent), same id; exactly 1 row | Race duplicates |
| QA-SI-47 | seed 5 expenses across dates → GET with `limit=2&offset=0/2/4` | windows partition the set; order `occurredOn DESC, createdAt DESC, id DESC`; `total` 5 constant; `limit=201` → 400; defaults 50/0 | Unbounded/unstable history (D-RESP-B3) |
| QA-SI-48 | DELETE random valid UUID; DELETE `"abc"` | 404 both; identical envelope (code+message) — and not 400/500 for the malformed id | Existence leak / uuid cast 500 |
| QA-SI-49 | user B: POST to A's month → 404; B creates own month, DELETEs A's transaction id via B's month → 404; A's row still listed | privacy-safe rejections; no mutation | Cross-user expense tamper (D-EXP-B3/B4) |
| QA-SI-50 | POST expense for a month with no budget | 404 NOT_FOUND | Orphan transactions |
| QA-SI-51 | expense with note `"QA-NOTE-<rand>"` → read logs | note string absent from request/error logs; amount body absent; request logged with route+status | Financial/PII log leak (D-EXP-B5) |

### 8. `server/tests/qa/integration/qa-insights.http.test.js`

Setup: seed helper builds deterministic months (fixed expense lists across all
five categories and spread dates incl. day 1 and last day).

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-SI-60 | seed 2026-06 + 2026-07 with known expenses → GET `/insights/2026-07` | `currentTotalMinor` = independently summed = Σ`categories[].currentMinor` = last cumulative point; same three-way equality for previous; cumulative arrays monotonic, 7 points | Incoherent chart series (D-INS-B1/B2) |
| QA-SI-61 | same data → GET `/budgets/2026-07` | `insights.currentTotalMinor === budget.actualMinor`; per-category `currentMinor === actualMinor` | Budget vs insights disagree (journey 7) |
| QA-SI-62 | shares of seeded actuals | equal `largestRemainderShares` recomputed in-test; Σ = 100 | Rounding rule drift (D-INS-B3) |
| QA-SI-63 | labels/fields | `labels` = `["Jul 1","Jul 6","Jul 11","Jul 16","Jul 21","Jul 26","Jul 31"]`; `monthLabel "July"`, `previousMonthLabel "June"`, `hasPrevious true` | Label/sample-grid drift |
| QA-SI-64 | seed 2025-12 + 2026-01 → GET `/insights/2026-01` | `previousMonth "2025-12"`, previous totals = seeded December sums | Year-rollover comparison bug (D-INS-B4) |
| QA-SI-65 | budget only for 2026-07 → GET insights | 200; `hasPrevious false`, `previousTotalMinor null`, every `previousMinor null`, `previousCumulativeMinor []` | Missing prev → 500 or fake zeros (D-INS-B5) |
| QA-SI-66 | budget with zero expenses | total 0, all shares 0, cumulative all zeros | Zero-month NaN/asymmetry |
| QA-SI-67 | user B seeds same months with own expenses → A GETs insights | A's numbers identical to pre-B values (deep equal) | Cross-user aggregation leak (D-INS-B6) |
| QA-SI-68 | GET `/insights/2026-04` (no budget); `/insights/2026-13` | 404; 400 | Validation/existence conflation |
| QA-SI-69 | leap: seed 2028-02 with expense on `2028-02-29` | included in totals; last label `"Feb 29"`; last cumulative = total | Leap-day expense dropped |

### 9. `server/tests/qa/integration/qa-error-contract.http.test.js`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-SI-80 | GET `/api/v1/health`; GET `/api/v1/nope` | health 200 `{status:"ok", uptimeSeconds}`; unknown route 404 envelope; both carry `X-Request-Id` | Health/404 contract drift |
| QA-SI-81 | POST register with body `"{ not json"` | 400 VALIDATION_ERROR, safe message (no parser internals) | Parser error leaks/500 |
| QA-SI-82 | POST > 32 kb JSON body | 413 PAYLOAD_TOO_LARGE envelope | Unbounded payloads (D-SEC-B3) |
| QA-SI-83 | GET `/api/v1/__test/error` (test env) | 500 INTERNAL; body has no stack/file paths/"Error:"; error log contains an entry whose requestId matches the response header | Stack-trace leak; uncorrelated errors |
| QA-SI-84 | any response headers; OPTIONS/GET with `Origin: https://evil.example` | `x-content-type-options: nosniff` present, `x-powered-by` absent; no `access-control-allow-origin` for the foreign origin | Header/CORS regression |
| QA-SI-85 | dedicated server `RATE_LIMIT_MAX:5`; 6 rapid GETs | 6th → 429 envelope | General limiter off |
| QA-SI-86 | injection corpus — email `qa'or1=1--@example.com` (register), note `'; DROP TABLE transactions; --`, month param `2026-07'--`, transaction id `1 OR 1=1` | inputs rejected (400/404) or stored as inert text and returned verbatim; afterwards a fresh register+budget+expense still works (tables intact) | SQL injection (D-SEC-B2) |
| QA-SI-87 | run a scripted mixed sequence (N requests incl. an error) → read both log files | exactly ≥1 request-log entry per request with `method,route/url,status,duration/responseTime,requestId,timestamp`; error entry present; raw log text contains none of: password, cookie/JWT value, note text, `amountMinor` payloads | Logging incompleteness/leak (D-SEC-B4, D-FND-B3/B5) |
| QA-SI-88 | collect one specimen of 400/401/404/409/413/429/500 from this suite; then `close()` server | every body matches `{error:{code,message,requestId}}` shape (plus optional `fieldErrors`); close resolves without hanging (guard timeout) | Envelope drift (D-RESP-B1); dirty shutdown (D-FND-B6) |

### 10. `server/tests/qa/integration/qa-journeys.http.test.js`

Roadmap §7.2 journeys 1–9 as sequential real-HTTP scenarios (fresh user per
journey, one shared server). Each journey asserts the documented intermediate
state at every step; failures name the step.

| ID | Journey | Key assertions | Defect detected |
|---|---|---|---|
| QA-RJ-01 | register → me → logout → me | 201/200/204/401 with contract bodies | Broken auth lifecycle |
| QA-RJ-02 | fresh user: GET month 404 → create kit budget → GET 200 | no seed dependency; correct read model | New-user onboarding broken |
| QA-RJ-03 | edit income then one plan | planned/available recalc both times | Plan editing regression |
| QA-RJ-04 | add expense → budget shows updated category progress + total | independent recomputation matches | Write→read pipeline broken |
| QA-RJ-05 | delete that expense → budget equals pre-add snapshot | deep equality | Recalculation residue |
| QA-RJ-06 | GET existing month, then empty adjacent month | 200 then 404 (clear empty-state contract) | Month switching broken |
| QA-RJ-07 | seed two months → insights reconciliation (totals = Σ categories = cumulative ends, shares = 100) | full coherence | Insight regression |
| QA-RJ-08 | second user attempts every private read/write against first user's data | 401/404 matrix; zero mutation | Privacy regression |
| QA-RJ-09 | invalid expense (400, nothing stored) → simulated retry of a failed create by re-POSTing same clientRequestId | eventual exactly-one row; budget consistent | Validation/retry regression |

### 11–16. Client component suites (`client/tests/qa/*.test.jsx`)

Layer: React component/behavior (jsdom + Testing Library + QA fetch mock; no
real network). Command: `npm exec -w client -- vitest run tests/qa`.
General setup per file: `installFetchMock(script)`; `renderApp` at the route
under test; interactions via `@testing-library/user-event`.

`qa-login-register.test.jsx`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-01 | script me→401, login→200 user; type valid creds, submit | exactly one POST `/api/v1/auth/login` with typed payload; app navigates to budget route (budget fetch fired / budget UI marker) | Login flow broken |
| QA-CC-02 | login → 401 envelope | error message rendered; still on login; inputs retain values | Failure state unusable |
| QA-CC-03 | submit with empty/invalid email | field error via its label association; **zero** network calls | Client validation bypassed |
| QA-CC-04 | slow login (`delayMs`), double-click submit | exactly one recorded POST | Double submission (D-AUTH-F5) |
| QA-CC-05 | click Show/Hide password | input `type` toggles password↔text; accessible name Show/Hide; `document.activeElement` unchanged | Toggle steals focus (D-AUTH-D3) |
| QA-CC-06 | register happy path | one POST `/auth/register`; navigates to budget | Registration broken |
| QA-CC-07 | register → 409 CONFLICT | email field error (conflict mapped to field); values preserved | Duplicate-email dead end |
| QA-CC-08 | pending login | submit disabled/loading state while in flight | Concurrent submits/no feedback |

`qa-routing-session.test.jsx`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-10 | me→401; open `/budget` | redirected to login; **no** `/budgets/` fetch ever recorded; no budget content rendered at any point | Private-data flash / unauth fetch |
| QA-CC-11 | me→200; open `/login` | redirected to `/budget` | Auth pages shown to signed-in user |
| QA-CC-12 | me→200 + budget→200 kit; open `/budget` directly | budget data renders (session restored on "refresh") | Session restoration broken (D-AUTH-F3) |
| QA-CC-13 | me→200, budget→401 envelope | redirect to `/login?reason=session-expired`; message "Your session expired — please sign in again."; re-navigating back does not render stale budget numbers | Stale private data after expiry (D-RESP-F5) |
| QA-CC-14 | authenticated budget page → open header menu with keyboard → Log out | POST `/auth/logout`; navigate to login; subsequent budget navigation refetches (cache cleared — no cached numbers rendered) | Logout leaves residue (D-AUTH-F6) |
| QA-CC-15 | open `/no-such-route` | NotFound page with a way back | Dead-end 404 |

`qa-budget-page.test.jsx`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-20 | kit fixture | texts `12,500`, `10,200`, `2,300`; five category rows with planned amounts | Kit totals wrong (D-BUD-F2) |
| QA-CC-21 | re-render with `variantBudget()` | every summary and category number changed accordingly (assert old values absent) | Hard-coded totals (D-BUD-F1) |
| QA-CC-22 | Housing actual 252000 / planned 400000 / income 1250000 | shows `63%` (and no `32%` anywhere) | planned/income progress (D-BUD-F3) |
| QA-CC-23 | `overspentBudget()` + `unplannedBudget()` | overspent row: warning text label + >100 value; unplanned row: its label; both discoverable as text (not color-only) | Overspend hidden (functional half of D-BUD-D3) |
| QA-CC-24 | kit fixture | an element whose accessible text is exactly `Housing: 2,520 spent of 4,000 planned, 63%` | SR sentence drift (D-BUD-F6) |
| QA-CC-25 | delayed budget response | loading skeleton with `aria-busy="true"` first, data after | Missing loading state |
| QA-CC-26 | budget → 404 envelope | EmptyState "No budget for July yet" + Create action navigates to `/budget/new?month=…` | Dead empty state (D-BUD-F4) |
| QA-CC-27 | budget → 500 then success on refetch | ErrorState with Retry; clicking Retry issues second GET and renders data; header/month nav stayed mounted throughout | Retry erases shell (D-BUD-F5) |
| QA-CC-28 | click prev/next month; also open with `?month=garbage` | navigation to `/budget?month=<prev/next>` computed correctly; garbage falls back to current month without crash | Month navigation broken (D-PLN-F4) |

`qa-add-expense.test.jsx` (rendered inside budget page with kit fixture)

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-30 | open dialog; press Escape / click Cancel | focus lands inside dialog on open; zero POSTs; dialog closed | Cancel mutates / focus lost (D-EXP-F3/D5) |
| QA-CC-31 | fill `42.50`/groceries/valid date/note; Save; scripted POST 201 + refreshed budget GET | POST body `{categoryId:"groceries", amountMinor:4250, occurredOn, note, clientRequestId:<uuid>}`; dialog closes; polite status message; budget refetched and new actual rendered (no reload) | Broken add flow (D-EXP-F1) |
| QA-CC-32 | four invalid variants (amount `abc`/`0`, no category, out-of-month date, 201-char note) | field-specific `role="alert"` messages; zero POSTs | Client validation gaps (D-EXP-F2) |
| QA-CC-33 | POST → 500 | dialog stays open, all values preserved, form error alert, button label switches to Retry | Lost input on failure (D-EXP-F4) |
| QA-CC-34 | after QA-CC-33 press Retry (now 201) | second POST body has **identical** `clientRequestId` to the first | Retry duplicates (client half of D-EXP-B6) |
| QA-CC-35 | slow POST; double-click Save | exactly one POST | Double-click duplicate (D-EXP-F5) |
| QA-CC-36 | inspect date input | `min`/`max` equal the month's first/last day | Wrong pickable range |
| QA-CC-37 | close dialog (cancel and success paths) | focus returns to the Add expense trigger | Focus dropped (D-EXP-D5) |

`qa-delete-expense.test.jsx`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-40 | request delete from expense panel; confirm; scripted 204 + refreshed lists | confirm dialog names the category and amount; DELETE `/budgets/:m/transactions/:id` sent once; row removed; status announced | Wrong/no deletion (D-EXP-F6) |
| QA-CC-41 | cancel the confirmation | zero DELETE calls; row still present | Cancel deletes |
| QA-CC-42 | DELETE → 500 | error surfaced; row remains | Silent failed delete |

`qa-budget-form.test.jsx`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-50 | create mode; type income/plan values | planned total + available preview update per keystroke to independently computed values | Dead preview (D-PLN-D2) |
| QA-CC-51 | set plans total > income | negative available shown + warning text; Save still enabled | Over-allocation blocked/silent (decision #2) |
| QA-CC-52 | valid create; POST 201 | body: `month`, integer `incomeMinor`, exactly five `{id,plannedMinor}`; navigates to budget page | Malformed create payload (D-PLN-F1) |
| QA-CC-53 | POST → 409 CONFLICT | recovery UI links to the existing month's budget | Conflict dead end (D-PLN-F3) |
| QA-CC-54 | invalid amount text (`abc`, `-5`) in income/plan | field errors, zero POSTs | Bad money accepted client-side |
| QA-CC-55 | edit mode with kit budget scripted | form prefilled from budget; save issues PATCH; updated numbers rendered | Edit flow broken (D-PLN-F2) |
| QA-CC-56 | dirty form → navigate away | blocker dialog appears; Stay preserves values; after successful save navigation proceeds unprompted | Silent data loss (D-PLN-F5) |
| QA-CC-57 | inspect form | exactly five fixed category rows; no add/remove-category control | Category set mutable (D-PLN-F6) |

`qa-insights-page.test.jsx`

| ID | Steps | Assertions | Defect detected |
|---|---|---|---|
| QA-CC-60 | `kitInsights()` | hero `8,420`; SVG charts present (no `<img>`); each chart exposes an accessible summary/data table whose numbers match the fixture; donut share texts sum to 100 | Chart/data mismatch (D-INS-F2/D4) |
| QA-CC-61 | re-render with `variantInsights()` | hero, legend, summaries, and table values all change together (old values absent) | Hard-coded chart data (D-INS-F1) |
| QA-CC-62 | click previous-month tab (scripted second GET) | GET `/insights/<prev>` fired; heading/labels/total swap consistently | Partial month switch (D-INS-F3) |
| QA-CC-63 | focus tabs; use Arrow keys + Enter/Space | arrow-key moves selection per documented tab behavior; panel updates | Tabs mouse-only (D-RESP-F3) |
| QA-CC-64 | `noPreviousInsights()` | explicit no-comparison message; no "vs 0"/zero-change claim rendered | Misleading comparison (D-INS-F5) |
| QA-CC-65 | `zeroSpendingInsights()` | no-spending message with month name | Empty month unexplained |
| QA-CC-66 | 404 → empty state with create action; 500 → Retry refetches to success | as stated | Dead error states |
| QA-CC-67 | keyboard-only traversal to chart data | hidden data table (VisuallyHiddenTable) reachable and contains labels+values for all series | Charts inaccessible (D-INS-F4) |

## Commands and expected results

All commands run from `/private/tmp/FinancialPlanning`. Never echo `.env`
contents; evidence files must redact connection strings/tokens.

| # | Command | Expected result |
|---|---|---|
| CMD-1 | `npm run lint && npm run format:check && npm run build` | exit 0 (QA files conform to repo lint/prettier; production build unaffected) |
| CMD-2 | `npm exec -w server -- vitest run tests/qa/unit` | all QA-SU tests pass, exit 0 |
| CMD-3 | `npm exec -w server -- vitest run tests/qa/integration --no-file-parallelism` | all QA-SI/QA-RJ tests pass against real listening servers + isolated `test_qa_*` schemas, exit 0 (requires `DATABASE_URL` reachable) |
| CMD-4 | `npm exec -w client -- vitest run tests/qa` | all QA-CU/QA-CC tests pass, exit 0 |
| CMD-5 | `npm test && npm run test:integration && npm run coverage` | developer suites remain green (regression evidence); coverage thresholds still met. Note: `npm test -w client` and `npm run coverage` sweep `client/tests/qa/**` too (vitest default include) — expected, record it |
| CMD-6 | `env -u DATABASE_URL -u JWT_SECRET NODE_ENV=development node server/src/index.js` | exits 1 quickly printing only variable **names** (D-FND-B1); capture stderr to evidence |
| CMD-7 | start `npm run dev` (or `SERVE_CLIENT=true npm run start -w server` after build) in background → `npm run smoke` → stop | smoke's 15-check journey passes (D-SEC-F2, D-DOC-B3) |
| CMD-8 | `npm run seed:demo` (without `ALLOW_DEMO_SEED`) | refuses to run (guard proof, D-DOC-B2); do NOT run the seed against `public` with the flag set |

Planned totals: **15 + 14 = 29** server unit cases, **6** client lib cases,
**42** server real-HTTP cases (SI) + **9** journeys, **44** client component
cases → **130 planned test cases** across 16 new QA files (plus 7 QA helper/
fixture files). Evidence for every run (stdout tail, exit code) goes under
`.workflow/sprints/delivery/iteration-01/qa/evidence/`.

## Blockers

None. Preconditions verified during planning:

- Developer final report `developer/test-report.json` status `pass`, empty
  `openIssues` (181 acceptance checks) — QA may proceed.
- `.env` provides `DATABASE_URL` and `JWT_SECRET` (presence checked without
  printing values); server unit suite runs green from documented commands.
- No user feedback is addressed to `qa` in `context.json`.

Conditional risks for the run phase (not blockers): Neon reachability/latency
may slow CMD-3 (mitigate with `--no-file-parallelism`, generous per-suite
timeouts, serialized suites); auth rate-limit tests must use dedicated server
instances with overridden limits so they cannot starve neighboring tests.
If `DATABASE_URL` becomes unreachable mid-run, classify affected tests as
`blocked` with the connection error as evidence — never green.
