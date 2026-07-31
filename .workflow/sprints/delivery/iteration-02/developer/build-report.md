# Build Report — Delivery Iteration 2 (FIX BUILD, D-DES-001 … D-DES-015)

Executed the approved fix plan (`developer/plan.md`) tasks T1–T14 in order,
then T15 full validation. All 15 design issues implemented; no issue
dropped or disputed. No API, schema, routing, calculation, or copy-contract
changes; the only server change is the demo seed's expense distribution
(totals preserved and now test-locked).

## Changes per issue ID

| Issue | Task | Files changed | What changed |
|---|---|---|---|
| D-DES-012 | T1 | `server/src/seed/demoSeed.js`, `server/tests/unit/demoSeedData.test.js` (new) | Replaced both expense datasets with the plan's distribution so the sampled cumulative series equals content.json's cashFlow exactly (July 600→8,420; June 800→9,180); per-category and monthly totals unchanged; datasets exported for the new pure-data unit test (7 assertions incl. the 28-day-month invariant). Header/inline comments updated. |
| D-DES-001 | T2 | `client/src/pages/LoginPage.jsx`, `RegisterPage.jsx`, `client/tests/LoginPage.test.jsx`, `RegisterPage.test.jsx` | `icon={Mail}` (lucide) on both email `TextInput`s — rendered at 20px by the existing component. Additive icon-presence assertions added to both developer-owned suites (sourceRef: icon-map.md). |
| D-DES-002 | T3 | `client/src/pages/AuthPage.css` | ≥768px: `.auth-card` becomes a centered 440px surface card with 40px padding, border, radius-lg, shadow-card (Card.css recipe). Measured at 1440: width 440, padding 40px, centered. |
| D-DES-003 | T3 | `client/src/pages/AuthPage.css` | Mobile `.auth-card` max-width 400px → 350px. Measured 350px at 600 and at the 720×450 zoom-equivalent (still the mobile layout, no card, no horizontal scroll). |
| D-DES-004 | T4 | `client/src/components/ui/AppHeader.css` | `.app-header-title` 20px → 28px/36px (DM Serif Display 400 inherited from the global h1 rule). Verified on Budget, Insights, Edit budget at 390/1440. |
| D-DES-005 | T5 | `client/src/components/ui/Button.css` | `.btn-label` → inline-flex with space-2 gap, defeating the global `svg { display: block }` reset. "+ Add expense" measured single-line (label height 24px) at 390 and 1440, icon before text. |
| D-DES-013 | T6 | `client/src/features/budget/CategoryRow.css` | `.category-row:hover` → blue-50 background + radius-md, gated to `(hover: hover) and (pointer: fine)`; 180ms transition inside `prefers-reduced-motion: no-preference`. Measured hover fill rgb(238,243,252) at 1440. |
| D-DES-014 | T7 | `client/src/components/ui/Button.css`, `MonthTabs.css`, `TextButton.css` | Primary buttons and the selected current-month tab consume blue-600 (white text 4.95:1), hover moves to blue-700 (7.36:1). TextButton 14px action text blue-500 → blue-600 (4.67:1 on background) — same failing pairing/rule, listed for design confirmation per plan assumption. tokens.css untouched. |
| D-DES-015 | T8 | `client/src/features/budget/SummaryMetrics.jsx`, `SummaryMetrics.css` | Planned label → text-primary (16.72:1) with a decorative 8px yellow-500 marker dot (`aria-hidden`), keeping the yellow=planned semantic non-textually. Income/Available labels untouched. |
| D-DES-006 | T9 | `client/src/features/insights/InsightsPage.jsx` | `tabOptions` reordered to [current, previous] — July renders left, June right. Wrap-around arrow-key behavior unchanged (dev + QA suites green unmodified, as the plan's analysis predicted). |
| D-DES-009 | T10 | `client/src/features/insights/charts/DonutChart.jsx`, `charts.css` | Removed the two donut center `<text>` nodes and their CSS; `totalMinor` still feeds the visible figcaption and hidden table. Doc comment updated. |
| D-DES-008 | T11 | `DonutChart.jsx` | Ring geometry `radius = 0.32×size`, `strokeWidth = 0.24×size` → inner/outer measured 45.5% at every viewport (kit ≈45%). |
| D-DES-007 | T12 | `DonutChart.jsx`, `charts.css` | Container-driven layout: component measures its column, adds `.donut-layout-row` only when a ≥128px donut fits beside the 180px legend; deleted the viewport-media row rule; `.donut-layout svg { width: auto; flex: none }` stops the flex-shrink collapse. Donut now ≥128px everywhere (200px at 768/1024/1440, 133px in the 390 two-up column; was ~25px at 1024). |
| D-DES-010 | T13 | `chartMath.js` (+`chartMath.test.js`, additive), `LineChart.jsx` | New pure `xLabelIndexes(labelCount, plotWidth)` (≥150px → first/middle/last; below → first+last; deduped). Measured: 390 two-up shows "Jul 1/Jul 31" and "Jun 1/Jun 30"; 320 stacked and all ≥768 keep three labels. |
| D-DES-011 | T14 | `LineChart.jsx`, `charts.css` | Line point markers get `.chart-mark-hover` (opacity 0; 1 on `:hover`/`:focus-visible`; 160ms transition motion-gated). Marks keep `tabindex=0`/`role="img"`; keyboard Tab shows marker + focus ring + tooltip (verified in a real browser). |

## Commands and results (T15 full validation)

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 |
| Format | `npm run format:check` | exit 0 (after `prettier --write` on the 2 new/edited files) |
| Server unit | `npm test -w server` | 60/60 pass (incl. 7 new demoSeedData tests) |
| Server integration (real HTTP) | `npm run test:integration` | 60/60 pass, exit 0 |
| Client suites | `npm test -w client` | 165/165 pass (148 QA tests untouched and green) |
| Coverage | `npm run coverage` | exit 0 (server 236 tests, client 165; thresholds met) — `scratchpad it2-coverage.log` |
| Production build | `npm run build` | exit 0 |
| Guarded seed | `ALLOW_DEMO_SEED=true npm run seed:demo` | exit 0; summary totals 842000 / 918000 |
| Smoke (SERVE_CLIENT build, real server) | `SMOKE_BASE_URL=http://localhost:4050 npm run smoke` | 15/15 checks pass, exit 0 |
| tokens byte-identity | `diff client/src/styles/tokens.css docs/design/figma-kit/tokens/design-tokens.css` | empty diff; `git diff` shows no change to tokens.css |

Browser evidence (Playwright, chromium, seeded demo user, SERVE_CLIENT
build on :4050): `evidence/browser-evidence.json` (per-issue computed
measurements), `evidence/insights-320-recheck.json` (login/budget/insights
scrollWidth = 320, no horizontal scroll, pass), `evidence/contrast.md`
(recomputed changed pairings), `evidence/screenshots/` (every issue's
screen at its reported viewport, incl. hover/focus states and the June
view). Console clean (only expected auth 401 network noise, filtered list
empty). Reduced-motion sweep: row and marker transitions collapse to ~0s.
DATABASE_URL was never printed or logged.

## Deviations from the plan

1. **T12 expected-result table at 1440 (documentation-level, not
   behavioral):** the plan predicted donut-card content ≈336px → legend
   beside a ≈132px donut. The real card content is 291px (the plan's
   estimate did not subtract the card's 24px padding within the 1200px
   main max-width), so `besideWidth` = 87 < 128 and the implemented rule
   correctly stacks the legend below a 200px donut. This satisfies
   D-DES-007's acceptance criterion exactly as worded ("when the card is
   too narrow for donut+legend side-by-side the legend stacks below and
   the donut uses the full column"); plan risk #1 anticipated this
   adjudication and the 1440 screenshot is in evidence. No code deviation.
2. **Prettier reflow** of two files after writing them (whitespace only).

Nothing else deviates: all geometry values, color pairings, seed tables,
and file/symbol targets match the plan verbatim.

## Notes for self-test

- New tests to keep green: `server/tests/unit/demoSeedData.test.js`;
  `chartMath.test.js` `xLabelIndexes` cases; Login/Register icon
  assertions. All additive; no existing expectation was changed.
- D-DES-007 at 1440 renders legend-below/200px donut (see deviation #1) —
  do not flag as a regression; the row layout engages when a card column
  reaches ≥332px content width.
- TextButton blue-600 is part of the D-DES-014 remediation (plan
  assumption) — flag to design review for confirmation, not a bug.
- Rate limits were never overridden; a single UI login's storage state was
  reused across capture contexts.
- Server started for evidence/smoke was killed (port 4050 free).
