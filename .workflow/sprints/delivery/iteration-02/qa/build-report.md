# QA Build Report — Delivery Iteration 2 (Repair + Regression)

Author: qa-engineer (repair + regression phase). Scope: repair a test-owned
flake the developer's own self-test found in a QA test file, then regress
the fix build (commit `ec7323f`) against the full 148-test independent
registry from iteration 1. No new test files were added and no product
source was touched.

## What changed

One file: `client/tests/qa/qa-login-register.test.jsx`. No helper, fixture,
or configuration file needed to change.

## The defect

`iteration-02/developer/evidence/selftest/coverage-flake.md` reported that
`npm run coverage` intermittently (~25-30% of runs) exits 1 with a Vitest
"Unhandled Rejection" (`ReferenceError: window is not defined` inside
`LoginPage.jsx`'s `finally { setSubmitting(false) }`), even though every
test in the run still shows as passed. `git diff de83b87 ec7323f --
client/src/pages/LoginPage.jsx client/src/pages/RegisterPage.jsx` confirms
the only change in these files is the additive `Mail` icon import/prop for
D-DES-001 — `handleSubmit` is byte-identical to iteration 1. This is a
test-owned race, not a product regression.

## Root cause

`QA-CC-04` ("a slow login submits exactly once on a rapid double click")
scripts a `delayMs: 60` login response and only waited for the mock to
*record* the POST call (which happens synchronously, before the mock's
artificial delay elapses) before the test ended. The delayed promise was
still pending at teardown; when coverage instrumentation's shifted
task-queue timing let it resolve after the environment was torn down, the
component's `finally { setSubmitting(false) }` fired against a gone
`window`.

Fixing that alone was not sufficient. A second, previously-unnoticed
occurrence of the identical shape existed in `QA-CC-08` ("the submit button
shows a pending/disabled state while the login is in flight"), which scripts
a `delayMs: 80` login response, asserts the disabled/`aria-busy` pending
state, and also returned without ever letting that promise settle. This was
only discovered because a 4-run coverage batch — run immediately after the
QA-CC-04-only fix — still failed once, with the identical `LoginPage.jsx:62`
signature, proving a second live instance of the same race.

## Repair (test-side only)

Both tests now wait for the follow-on `GET /budgets/:month` request (which
only fires after the mocked login promise resolves and `handleSubmit`
navigates) before returning, mirroring the pattern already used by QA-CC-01
and QA-CC-06. This guarantees the delayed mock promise has settled and
`handleSubmit`'s `try`/`catch`/`finally` — including `setSubmitting(false)`
— has fully run while the jsdom environment is still alive, so nothing is
left pending at `afterEach(cleanup)`/environment teardown. No assertion
value, mock, or fixture changed; only await sequencing. No product code was
touched.

## Proof

- `npm run coverage` run 6 consecutive times after both fixes: 6/6 exit 0,
  each reporting `Test Files 24 passed (24)` / `Tests 236 passed (236)`
  (server) and `Test Files 24 passed (24)` / `Tests 165 passed (165)`
  (client), zero `Unhandled Rejection`/`Errors` lines in any run.
- `npm test -w client` (no coverage instrumentation) run standalone twice:
  2/2 exit 0, 165/165 each time.
- `npx vitest run tests/qa/qa-login-register.test.jsx --reporter=verbose`:
  all 8 tests pass individually by name, including QA-CC-04 and QA-CC-08.

Evidence: `qa/cycle-01/evidence/` (`coverage-run-1..6.log`,
`client-standalone-run-1..2.log`, `qa-cc-04-08-verbose.log`).

## Regression re-run (fix commit ec7323f)

| Command | Exit | Result |
|---|---|---|
| `npm exec -w server -- vitest run tests/qa/unit` | 0 | pass — 54/54 (29 planned IDs) |
| `npm exec -w server -- vitest run tests/qa/integration --no-file-parallelism` | 0 | pass — QA-SI/QA-RJ green (63 planned IDs) |
| `npm exec -w client -- vitest run tests/qa` | 0 | pass — 88/88 (56 planned IDs) |
| `npm test -w server` | 0 | pass — 60/60 (up from 53 in iteration 1: additive `demoSeedData.test.js`) |
| `npm run test:integration -w server` | 0 | pass — 60/60, unchanged |
| `npm test -w client` | 0 | pass — 165/165 |
| `npm run lint` | 0 | pass — 0 problems |
| `npm run format:check` | 0 | pass |
| `npm run build` | 0 | pass — production build succeeds |
| `SERVE_CLIENT=true npm run start -w server` (background) → `npm run smoke` → stop | 0 | pass — 15/15 checks; server confirmed stopped afterward |

Evidence: `qa/evidence/` (`cmd2-server-unit.log`,
`cmd3-server-integration.log`, `cmd4-client-qa.log`,
`regression-server-unit.log`, `regression-server-integration.log`,
`regression-client.log`, `regression-lint.log`,
`regression-format-check.log`, `regression-build.log`,
`regression-smoke.log`, `smoke-server.log`).

## Why the fix build introduces no functional regression

`git diff de83b87 ec7323f` (44 files, 1530 insertions / 88 deletions) shows
the fix commit touched only: CSS/className additions across UI components
(the 15 D-DES visual fixes), two additive chart-math tweaks in
`chartMath.js` with the developer's own new `chartMath.test.js`,
`DonutChart.jsx`/`LineChart.jsx` rendering adjustments, the `Mail` icon
prop on `LoginPage.jsx`/`RegisterPage.jsx`, and `demoSeed.js`'s expense-day
distribution (re-sequenced across the month so the demo cash-flow chart
matches static `content.json` data at the sampled dates — D-DES-012, a
content/design fix; category and month totals are unchanged, and this data
is not used by any QA fixture or assertion). None of these intersect a
QA-owned expected value, kit number, contract shape, or ownership rule.

## Final state

`testIssues` is empty (the one flake found is repaired, proven with 6
consecutive green coverage runs). All 148 planned tests are `status:
"passed"` with `stepsVerified: true` and fresh iteration-2 evidence.
`productIssues` is empty — no product defects were found. Coverage: server
97.24% statements (unchanged), client 87.22% statements (iteration 1:
87.33%; negligible drift from additive markup), both above the 70%
threshold. Final `status`: `"pass"`.
