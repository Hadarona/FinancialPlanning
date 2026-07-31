# `npm run coverage` intermittent failure (self-test finding — RESOLVED)

## Resolution (update)

QA repaired this in cycle-01: `client/tests/qa/qa-login-register.test.jsx`
QA-CC-04 and a second identical race in QA-CC-08 now `await waitFor(...)`
the post-login budget fetch (or an equivalent settle point) before the test
ends, guaranteeing the mocked login promise — and `LoginPage.jsx`'s
`handleSubmit` `finally` block — has fully resolved while the jsdom
environment is still alive. The change is additive await-sequencing only,
no assertion changes (developer-verified via read-only `git diff`; this
file was not edited by developer). QA's own evidence
(`.workflow/sprints/delivery/iteration-02/qa/cycle-01/evidence/coverage-run-{1..6}.log`)
shows 6/6 consecutive `npm run coverage` runs exit 0. Developer
independently re-ran `npm run coverage` 3 more consecutive times from the
repo root afterward: all 3 exit 0 (236 server + 165 client tests each, zero
`Unhandled Rejection` lines). See `test-report.json`
`resolvedIssues[DEV-SELFTEST-IT2-001]` for the full resolution record. The
sections below are the original finding, left intact for the record.

## Summary

`npm run coverage` (client workspace) intermittently exits 1 with an
"Unhandled Rejection" reported by Vitest, even though every test in the run
still shows as passed. Reproduction rate observed this session: 1 fail / 3
runs of the full root `npm run coverage` chain, and 1 fail / 4 runs of
`npm run coverage -w client` alone (~25-30%). Plain `npm test -w client`
(no coverage instrumentation) never reproduced it in this session.

## Exact error (identical every time it occurs)

```
⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
ReferenceError: window is not defined
 ❯ getCurrentEventPriority ../node_modules/react-dom/cjs/react-dom.development.js:10993:22
 ❯ requestUpdateLane ../node_modules/react-dom/cjs/react-dom.development.js:25495:19
 ❯ dispatchSetState ../node_modules/react-dom/cjs/react-dom.development.js:16648:14
 ❯ handleSubmit src/pages/LoginPage.jsx:62:7
     60|       setFormError(described.formError);
     61|     } finally {
     62|       setSubmitting(false);
     63|     }
     64|   }

This error originated in "tests/qa/qa-login-register.test.jsx" test file.
This error was caught after test environment was torn down.
```

`Test Files 24 passed (24)` / `Tests 165 passed (165)` still report all
green; only the trailing unhandled-rejection line flips the process exit
code to 1.

## Root cause analysis

- The QA-owned test `qa-login-register.test.jsx` "QA-CC-04: a slow login
  submits exactly once on a rapid double click" triple-clicks the Sign-in
  button against a mock `POST /auth/login` with a 60ms artificial delay.
  Occasionally the mocked promise resolves after the test (and its jsdom
  window) has already torn down, so `LoginPage.jsx`'s `finally { setSubmitting
  (false) }` fires against a gone `window`, and Vitest surfaces that as a
  process-level unhandled rejection under v8 coverage instrumentation
  (which shifts task-queue timing enough to expose the latent race; it was
  not observed under plain `npm test -w client` in this session).
- **This is not a regression from iteration-2's fixes.** `git diff de83b87
  ec7323f -- client/src/pages/LoginPage.jsx` shows the only change to this
  file is the additive `import { Mail } from "lucide-react"` and
  `icon={Mail}` prop for D-DES-001 — `handleSubmit` (including the exact
  `finally` block at the reported line) is byte-identical to iteration 1's
  code. The race pre-dates this iteration's fix build.
- QA's test file itself was not modified and must not be modified by
  developer (per the developer-loop skill and this assignment's
  constraints); no product code change was made to investigate or patch
  this in this test-only phase.

## Reproduction

```
cd client && npx vitest run --coverage    # repeat 3-5x; ~1 in 3-4 fails
```
or from the repo root: `npm run coverage` (chains server then client).

## Suggested fix (not applied — test-only phase, no product code changes)

Guard the post-await `setSubmitting`/`setFieldErrors`/`setFormError` calls
in `LoginPage.jsx` (`RegisterPage.jsx` has the same pattern) with an
unmounted-ref/AbortController check, or have the QA test `await` the mocked
response settling before the test ends. Either is a small, isolated fix for
the next fix cycle; recorded here rather than fixed, per this phase's
test-only, no-product-code-changes restriction.

## Impact on this report (superseded by the resolution above)

`npm run coverage` was originally listed as `fail` (flaky) in the commands
array and as open issue `DEV-SELFTEST-IT2-001`, which forced the report
`status` to `fail`. After QA's cycle-01 repair and developer's independent
3/3 re-verification, `npm run coverage` is `pass`, the issue is moved to
`resolvedIssues`, `openIssues` is empty, and the report `status` is `pass`.
