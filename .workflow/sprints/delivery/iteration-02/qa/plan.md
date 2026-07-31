# QA Plan

Delivery iteration 2 — addendum. Author: qa-engineer (QA REPAIR + REGRESSION
phase). Scope: (1) regression re-verification of the fix build commit
`ec7323f` (15 D-DES visual-issue fixes, additive developer self-tests only,
no product behavior change in scope for this QA phase) and (2) repair of a
test-owned flake QA's own self-test found in `qa-login-register.test.jsx`
(case QA-CC-04). This addendum does not replan or re-plan coverage; the full
independent test registry, behavior contract, traceability matrix, risk
matrix, fixtures, and ordered build remain exactly as authored in
`.workflow/sprints/delivery/iteration-01/qa/plan.md` (148 test IDs, unchanged
scope, unchanged product acceptance criteria — no new functional surface
shipped in this iteration). This file only records what changed for
iteration 2 and why.

## Behavior contract

Unchanged from iteration 1 (`iteration-01/qa/plan.md` §Behavior contract).
Confirmed still authoritative: `git diff de83b87 ec7323f -- client/src/pages/LoginPage.jsx
client/src/pages/RegisterPage.jsx` shows the only product change in the
affected files is the additive `import { Mail } from "lucide-react"` and
`icon={Mail}` prop (D-DES-001, a visual affordance) — `handleSubmit`,
including its exact `try/catch/finally` block, is byte-identical to
iteration 1. No behavior-contract clause changed.

## Acceptance-to-test traceability

Unchanged — see `iteration-01/qa/plan.md` §Acceptance-to-test traceability
for the full criterion-to-test-id map. The fix commit addresses design
issues D-DES-001..015 (visual/styling), which are out of this functional QA
plan's scope per the agent's charter ("never review visual styling"); design
review owns re-verifying those against the design report separately. This
addendum only re-confirms that the 148 functional QA tests already mapped to
those same criteria still pass unchanged against the fix build.

## Risk and coverage matrix

Unchanged — see `iteration-01/qa/plan.md` §Risk and coverage matrix. No new
risk surface: the fix commit touched only CSS/className additions, two chart
math helpers (`chartMath.js`, exercised by the developer's own new
`chartMath.test.js`, additive), `DonutChart.jsx`/`LineChart.jsx` rendering
tweaks, `demoSeed.js` (dev-only seeding, not user-facing product behavior),
and the two icon props above. None of these intersect a QA-owned assertion
target in a way that changes expected values (kit numbers, money formatting,
auth/session contracts, ownership rules are all untouched).

## Fixtures and environment

Unchanged — see `iteration-01/qa/plan.md` §Fixtures and environment. No new
QA helper, fixture, or harness file was needed for the regression re-run. One
existing QA test file was repaired in place (see below); no fixture or
helper semantics changed, only the repaired test's own await sequencing.

## Ordered test implementation — repair record

**Defect (test-owned, not a product bug):** the developer's self-test build
found `npm run coverage` intermittently (~25-30% of runs) exiting 1 with a
Vitest "Unhandled Rejection" — `ReferenceError: window is not defined` at
`LoginPage.jsx`'s `finally { setSubmitting(false) }` — even though every test
still reported as passed. Root cause and first reproduction are recorded in
`iteration-02/developer/evidence/selftest/coverage-flake.md`.

Investigation (this phase) found **two** instances of the same defect shape
in `client/tests/qa/qa-login-register.test.jsx`, both pre-existing since
iteration 1 (product code in the affected path is unchanged — confirmed
above):

1. **QA-CC-04** ("a slow login submits exactly once on a rapid double
   click"): scripts a `delayMs: 60` login response, triple-clicks Sign in,
   then only waited for the mock to *record* the POST call (which happens
   synchronously before the mock's artificial delay elapses) before ending.
   The delayed promise was still pending at test teardown; when it later
   resolved under coverage instrumentation's shifted task-queue timing, the
   component's `finally { setSubmitting(false) }` fired against a torn-down
   jsdom environment.
2. **QA-CC-08** ("the submit button shows a pending/disabled state while the
   login is in flight"): scripts a `delayMs: 80` login response, asserts the
   disabled/`aria-busy` pending state, and returned immediately — the
   identical unresolved-promise-at-teardown shape. This is why the repair
   cycle (`cycle-01`) needed two attempts: fixing QA-CC-04 alone still left
   the coverage run failing (observed once in a 4-run batch, at the same
   `LoginPage.jsx:62` line), because QA-CC-08 carries the same latent race
   independently.

**Repair (test-side only, no product code touched):** both tests now wait
for the follow-on `GET /budgets/:month` request (fired only after the mocked
login promise resolves and `handleSubmit` navigates) before the test
function returns, mirroring the pattern already used by QA-CC-01 and
QA-CC-06. This guarantees the delayed mock promise has settled and
`handleSubmit`'s `try`/`catch`/`finally` — including `setSubmitting(false)`
— has fully run while the jsdom environment is still alive, so nothing is
left pending at `afterEach(cleanup)`/environment teardown. No assertion
values, fixtures, mocks, or coverage targets changed; only await sequencing.
File: `client/tests/qa/qa-login-register.test.jsx` (QA-CC-04 lines ~118-142,
QA-CC-08 lines ~213-247 in the repaired file).

Proof: `npm run coverage` was run 6 consecutive times after the second fix —
all exit 0, all report `Test Files 24 passed (24)` / `Tests 165 passed
(165)` (client) and `Tests 236 passed (236)` (server, full QA+dev sweep),
zero `Unhandled Rejection`/`Errors` lines in any run. `npm test -w client`
(no coverage instrumentation) was additionally run standalone twice, both
green. A dedicated verbose run of `qa-login-register.test.jsx` alone
confirms all 8 tests, including QA-CC-04 and QA-CC-08 by name, pass
individually. Evidence: `iteration-02/qa/cycle-01/evidence/`.

## Commands and expected results

| # | Command | Expected result | This iteration's result |
|---|---|---|---|
| CMD-R1 | `npm run coverage` × 6 (repair proof) | exit 0 every time | 6/6 exit 0 — see `cycle-01/evidence/coverage-run-1..6.log` |
| CMD-R2 | `npm test -w client` × 2 (standalone, repair proof) | exit 0 every time | 2/2 exit 0 — see `cycle-01/evidence/client-standalone-run-1..2.log` |
| CMD-R3 | `npm test -w server` | developer server-unit suite green | pass, 60/60 — `qa/evidence/regression-server-unit.log` |
| CMD-R4 | `npm run test:integration -w server` | developer server-integration suite green | pass, 60/60 — `qa/evidence/regression-server-integration.log` |
| CMD-R5 | `npm test -w client` | full client sweep (dev + QA) green | pass, 165/165 — `qa/evidence/regression-client.log` |
| CMD-R6 | `npm run lint` | exit 0 | pass — `qa/evidence/regression-lint.log` |
| CMD-R7 | `npm run format:check` | exit 0 (extra regression check, matches iteration-1 CMD-1) | pass — `qa/evidence/regression-format-check.log` |
| CMD-R8 | `npm run build` | production build succeeds | pass — `qa/evidence/regression-build.log` |
| CMD-R9 | `npm run start -w server` (SERVE_CLIENT=true, backgrounded) → `npm run smoke` → stop | 15-check smoke journey passes against a real listening server; server stopped afterward | pass, 15/15 checks — `qa/evidence/regression-smoke.log` + `qa/evidence/smoke-server.log`; server process confirmed stopped |

All commands run from `/private/tmp/FinancialPlanning`. No `.env` contents
were echoed at any point.

## Blockers

None. The developer self-test report (`iteration-02/developer/test-report.json`)
and `coverage-flake.md` were both readable and provided an exact, reproducible
line-level root cause before repair began. `DATABASE_URL`/`JWT_SECRET`
presence was verified without printing values; server integration/coverage
suites ran green against the reachable database throughout this phase.
