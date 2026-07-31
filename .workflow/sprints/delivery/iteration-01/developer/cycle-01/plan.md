# Developer fix cycle 01 — plan (delivery iteration 1)

Date: 2026-07-31. Branch: `feature/budgeting-app`. Inputs: the developer
self-test report `../test-report.json` (status `fail`, two open issues), its
evidence (`../evidence/insights-320-overflow-diagnostic.json`,
`../evidence/browser-evidence-summary.json`, `../evidence/format-check.log`).

## Goal and scope

Resolve both open self-test issues, re-verify at the reference viewports, and
bring the developer test report to a genuine `pass`.

- In-scope acceptance checks to flip: `D-INS-F6`, `D-RESP-F1`, `R-FE-1`
  (DEV-SELFTEST-001) and the `format:check` command row plus the `D-SEC-F5` /
  `R-QE-1` reasons (DEV-SELFTEST-002).
- Non-goals: any feature work; touching `.workflow/state.json`, `qa/`,
  `design/`, or `tools/`; weakening any test or acceptance criterion.

## Issue → task map

### DEV-SELFTEST-001 (medium) → Tasks 1–3

Current behavior (evidence): at a 320px viewport the Insights page has real
horizontal scroll — `document.scrollingElement.scrollWidth` 371px vs
`clientWidth` 320px. Root cause (diagnosed in self-test): `.visually-hidden`
(`client/src/styles/global.css:62-72`) sets `width: 1px`, but Chromium's
automatic table layout treats an explicit width on a `<table>` as a minimum
and sizes the three hidden chart tables rendered by
`client/src/features/insights/charts/VisuallyHiddenTable.jsx` to their
min-content widths (measured 269–335px); the widest (7-column cash-flow
table) extends to x=371px. Budget and Login are clean.

- **Task 1 — markup root-cause fix.** In `VisuallyHiddenTable.jsx`, move the
  `visually-hidden` class from the `<table>` to a new `<div>` wrapper. A block
  `div` honors `width: 1px` + `overflow: hidden`, so it clips the table and
  contributes at most 1px to scrollable overflow regardless of table-layout
  quirks. The `<table>`/`caption`/`th scope` semantics are untouched, so the
  screen-reader data view (D-INS-F4) is preserved (clipping is visual only).
- **Task 2 — CSS defense in depth.** In `global.css`, document the table
  pitfall on the `.visually-hidden` comment and add
  `.visually-hidden table, table.visually-hidden { table-layout: fixed; width: 1px; }`
  so a hidden table can never widen the page even if the class is ever applied
  to a `<table>` again. No other `.visually-hidden` consumers are tables
  (grep: only the hero `<span>` in `InsightsPage.jsx`).
- **Task 3 — regression test + DOM-measurement verification.** jsdom computes
  no layout, so the component test asserts the structural contract: extend
  `client/tests/InsightsPage.test.jsx` with a test that all three chart tables
  (a) do not carry `visually-hidden` themselves, (b) sit inside a
  `div.visually-hidden` wrapper, and (c) keep caption/header semantics. The
  real layout claim is verified by Task 6's Chromium DOM measurement
  (`scrollWidth <= 320`), recorded as cycle evidence.

### DEV-SELFTEST-002 (low) → Tasks 4–5

Current behavior (evidence): `npm run format:check` exits 1 on 90 files; no
`.prettierignore` exists; 32 of the files are real product source under
`server/` and `client/`.

- **Task 4 — add a justified `.prettierignore`.** Exclude only what the
  developer must not or should not rewrite:
  - `.workflow/` — phase-owned role reports/evidence, not product source;
  - `tools/` — orchestrator-owned workflow controller (out of developer write
    scope, and excluded by this cycle's constraints);
  - `docs/design/`, `docs/product/`, `docs/workflow/`,
    `Project_requirements_English.md` — read-only product/design/workflow
    sources per CLAUDE.md's ownership table; the figma-kit export in
    particular must stay byte-identical to the design tool's output;
  - `CLAUDE.md` — workflow governance document, kept byte-stable;
  - `client/src/styles/tokens.css` — must remain byte-identical to
    `docs/design/figma-kit/tokens/design-tokens.css` (D-FND-D1); formatting
    either copy would break the verbatim-copy invariant.
- **Task 5 — `npx prettier --write .`** with the ignore file in place, so
  every remaining file — including all 32 product source files, tests,
  server scripts, and developer-authored docs (README, docs/api.md,
  docs/agile/**, docs/demo-script.md, ALL_LICENSES.md) — conforms to
  `.prettierrc.json`. Verify zero behavior change: full unit/component/
  integration suites run green both immediately before (Task 3 gate) and
  after the rewrite; `git diff` reviewed to confirm whitespace/wrapping-only
  changes. Decision rationale: the repo's own `.prettierrc.json` (printWidth
  90) is the declared style contract and `format:check` is part of the
  required check suite, so conforming the writable files is correct; hiding
  product files behind an ignore entry would defeat the check.

## Validation plan (order of execution)

1. `npm test -w client` after Tasks 1–3 (new test passes; nothing regresses).
2. Tasks 4–5, then `npm run format:check` → must exit 0.
3. Full re-test gate, each command from the repo root with recorded exit
   codes: `npm run lint`, `npm run format:check`, `npm test -w server`,
   `npm run test:integration -w server`, `npm test -w client`,
   `npm run coverage`, `npm run build`, `npm run smoke` (against a really
   running server, `SERVE_CLIENT=true`, `ALLOW_DEMO_SEED=true`),
   `npm run workflow:validate`.
4. **Task 6 — browser re-verification** with the scratchpad Playwright
   (chromium) install from the self-test phase, against the freshly built
   client served by the real server with seeded demo data: at a 320px
   viewport, `document.scrollingElement.scrollWidth <= 320` on Login, Budget,
   and Insights (demo user journey through the real UI). Also re-measure the
   three hidden tables' bounding rects (expect ≤1px effective contribution).
   Evidence: `cycle-01/evidence/insights-320-recheck.json` (+ screenshots).
5. Kill all servers started during the cycle.

## Reporting and checkpoints

- Update `../test-report.json`: flip `D-INS-F6`, `D-RESP-F1`, `R-FE-1` to
  `passed` with the new evidence; update the `format:check` command row to
  exit 0; clear `openIssues`; set `status: "pass"` only if every command and
  in-scope check is genuinely green; refresh notes.
- Append a "Fix cycle 01" section to `../build-report.md` (tasks, files,
  deviations, validation).
- Commit the product changes on `feature/budgeting-app` (product files +
  `.prettierignore` + tests; workflow reports may ride along per repo
  convention of committing evidence).

Rollback safety: Task 1–2 changes are two small, isolated files — reverting
them restores the exact prior rendering. Task 5 is mechanically reversible via
git; the before/after test runs are the behavior-preservation checkpoint.

## Risks / assumptions

- Prettier reflow of JSX/JS is behavior-neutral by construction; the full
  suite re-run guards against pathological cases (e.g., ASI issues — none
  expected with `semi: true`).
- The 320px re-check depends on the corporate-TLS workaround from the
  self-test phase only for *installing* Playwright; the install already
  exists in the scratchpad, so no network trust changes are needed.
- Never print or log `DATABASE_URL`/`JWT_SECRET` anywhere in this cycle.
