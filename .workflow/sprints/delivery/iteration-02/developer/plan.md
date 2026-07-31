# Developer Plan

Iteration 2 — FIX PLAN for the 15 design-review issues from
`.workflow/sprints/delivery/iteration-01/design/review-report.json`
(D-DES-001 … D-DES-015). Developer and QA both passed iteration 1
(148/148 QA, no product issues), so this plan changes **visual/UI behavior
only** — no API, schema, routing, calculation, or copy-contract changes.
The only server-side change is the demo seed's expense *distribution*
(D-DES-012), which preserves every monthly and per-category total.

## Delivery goal and scope

Resolve all 15 design issues so the next design review can pass, without
regressing any QA-verified behavior, any accepted intentional difference
(D-DES-INT-001 … 010), or any roadmap gate (money/date rules, ownership,
logging, accessibility, 320-px no-horizontal-scroll, tokens byte-identity).

In scope (exactly the 15 issue IDs — none dropped, none disputed):

| Area | Issues |
|---|---|
| Auth screens | D-DES-001, D-DES-002, D-DES-003 |
| Shell/typography | D-DES-004 |
| Budget screen | D-DES-005, D-DES-013, D-DES-015 |
| Insights tabs/charts | D-DES-006, D-DES-007, D-DES-008, D-DES-009, D-DES-010, D-DES-011 |
| Action-color contrast | D-DES-014 |
| Demo seed data | D-DES-012 |

Explicit non-goals (do NOT "fix" these — accepted intentional differences
from the iteration-1 design report, plus reviewer notes):

- D-DES-INT-001 — roadmap-derived progress percentages (99/101/105/103/39),
  not the kit's inconsistent progressPercent values.
- D-DES-INT-002 — donut Savings segment on blue-700 (Housing/Savings share
  the kit "blue"; keep the differentiated fill).
- D-DES-INT-003 — desktop Insights grid per responsive-layout.md
  (bar 8 / donut 4 / line 12 below), NOT the approved composition's
  full-width bar chart. D-DES-007 is fixed **within** this accepted grid.
- D-DES-INT-004 — Lucide `Trash2` / `TriangleAlert` gap-filling icons.
- D-DES-INT-005 — copy extensions beyond content.json (`client/src/lib/copy.js`).
- D-DES-INT-006 — unselected month tab stays neutral (never the mockup's
  simultaneous blue+yellow filled pair).
- D-DES-INT-007 — roadmap-required UI beyond the compositions (month nav,
  expense history/delete, budget form, loading/empty/error states).
- D-DES-INT-008 — Budget root header shows logo, no back arrow.
- D-DES-INT-009 — contrast-driven in-ramp token consumption swaps
  (coral-700 errors, blue-700 Income label, green-600 Available, 19px/700
  yellow-700 hero comparison amount, June bar pattern, chart text summaries).
- D-DES-INT-010 — cash-flow y-axis derived from data (10K, not 15K); three
  labeled x dates.
- Reviewer notes (not issues): Budget desktop 960px container reading;
  June-view chart coloring; capture-only rate-limit env overrides.

Also out of scope: `tokens.css` **must remain byte-identical** to
`docs/design/figma-kit/tokens/design-tokens.css` (D-FND-D1 — re-verify with
`diff` at the end; verified identical at planning time). D-DES-014/015 are
fixed purely by changing **which existing token a component consumes**,
consistent with the kit's own conflict rule already adjudicated by design
review (accessibility-checklist.md + roadmap contrast gate outrank
color-scheme.md's blue-500 assignment; in-ramp remedies exist — see
review-report.json notes[7] and issues D-DES-014/015 text).

## Acceptance criteria

Per issue (the design report's "expected" is the acceptance test; sourceRefs
cited per task below):

1. D-DES-001 — Email inputs on /login and /register show a leading Lucide
   `Mail` icon at 20 px (like the password field's `LockKeyhole`).
2. D-DES-002 — At ≥768 px, /login (and /register) render a centered visible
   surface card: width 440 px, padding 40 px, rounded, on the page background.
3. D-DES-003 — At 320–767 px the auth form is capped at 350 px.
4. D-DES-004 — Authenticated page titles (Budget, Spending insights, Edit
   budget, Create budget) render DM Serif Display 400 at 28/36 (Heading/Page).
5. D-DES-005 — "+ Add expense" renders icon inline before the label on one
   visual line at every viewport.
6. D-DES-006 — Month tabs render current month (July) left, previous (June)
   right; keyboard behavior still per a11y checklist.
7. D-DES-007 — The donut SVG never renders below 128 px next to its legend;
   when the card is too narrow for donut+legend side-by-side the legend
   stacks below and the donut uses the full column (128–200 px).
8. D-DES-008 — Donut inner radius ≈45% of outer radius (thick ring).
9. D-DES-009 — Donut center is empty (no total/month text inside the ring).
10. D-DES-010 — Cash-flow x-axis labels never collide: at narrow plot widths
    only first+last labels render; ≥ threshold, first/middle/last.
11. D-DES-011 — Line markers are visually hidden until hover/focus; the
    keyboard-focusable tooltip targets remain in the DOM with `tabindex=0`.
12. D-DES-012 — With the guarded demo seed, /insights cash-flow reproduces
    content.json exactly: July cumulative 600→8,420 and June 800→9,180 at
    the seven sample dates; all monthly/per-category totals unchanged.
13. D-DES-013 — Budget category rows show a visible desktop hover state.
14. D-DES-014 — White label text on primary buttons and the selected
    current-month tab meets ≥4.5:1 (blue-600 #476FB9 = 4.95:1); tokens.css
    unchanged.
15. D-DES-015 — The "Planned" summary label meets AA (near-black text plus a
    non-text yellow marker keeps the kit's yellow=planned semantic).

Cross-cutting gates (must all still hold):

- All existing suites green: server unit + integration (real HTTP), client
  developer + QA component suites (148 QA tests), lint, format:check,
  coverage thresholds, production build, smoke.
- No horizontal scroll at 320 px on Login/Budget/Insights (re-measure).
- Reduced-motion, focus visibility, 44×44 targets unchanged.
- `client/src/styles/tokens.css` byte-identical to the kit file.
- Never print/log `DATABASE_URL`.

## Findings to resolve

### Issue-ID → task mapping (all 15; none dropped, none disputed)

| Issue | Sev | Screen @ viewport | Fix summary | Task(s) |
|---|---|---|---|---|
| D-DES-001 | low | Login/Register (all) | Pass `icon={Mail}` to email `TextInput` | T2 |
| D-DES-002 | medium | Login @1440 | Visible 440 px / 40 px-padding surface card ≥768 px | T3 |
| D-DES-003 | low | Login @600 | `max-width: 350px` for the mobile auth card | T3 |
| D-DES-004 | low | Budget/Insights/forms @all | `.app-header-title` 20px → 28px/36px | T4 |
| D-DES-005 | low | Budget @all | `.btn-label` inline-flex (defeats global `svg{display:block}`) | T5 |
| D-DES-006 | low | Insights @all | `tabOptions` order → [current, previous] | T9 |
| D-DES-007 | medium | Insights @768/1024/1440 | Container-driven donut size + legend beside/below decision; stop flex-shrinking the SVG | T12 |
| D-DES-008 | low | Insights @320 (all) | Ring geometry: inner ≈45% of outer | T11 |
| D-DES-009 | low | Insights @all | Remove donut center total/month text | T10 |
| D-DES-010 | low | Insights @390 two-up | Width-aware x-label thinning (first+last when narrow) | T13 |
| D-DES-011 | low | Insights @all | Line markers opacity-0 until hover/focus (still focusable) | T14 |
| D-DES-012 | low | Insights @1440 (seed) | Re-distribute seed expenses to match content.json cumulative series exactly; totals unchanged | T1 |
| D-DES-013 | low | Budget @1440 hover | `.category-row:hover` treatment (hover-capable pointers) | T6 |
| D-DES-014 | medium | all primary actions | Consume blue-600 for primary button/selected-current-tab fills (hover → blue-700); tokens untouched | T7 |
| D-DES-015 | low | Budget @all | Planned label → text-primary + yellow-500 marker dot | T8 |

Kit-conflict check for D-DES-014/015 (required before changing color usage):
the design reviewer already adjudicated both as **defects, not intentional
differences** (review-report.json notes: "the two kit-inherited contrast
misses -> defects D-DES-014 / D-DES-015 because the kit's own accessibility
checklist and the roadmap's contrast gate outrank the color assignment, and
in-ramp remedies exist"). This is the same conflict-resolution rule the
accepted D-DES-INT-009 swaps already use: `docs/` accessibility checklist
outranks reference imagery, and only token *consumption* changes — never
token values. Neither issue is disputed.

### Current behavior and evidence (verified against source at planning time)

- Email icon: `LoginPage.jsx`/`RegisterPage.jsx` render `TextInput` without
  `icon`; the component supports `icon` (used by `PasswordInput`).
- Auth card: `AuthPage.css` `.auth-card` has `max-width: 400px`, no surface
  styles, at every width.
- Page title: `AppHeader.css` `.app-header-title { font-size: 20px }`.
- Add-expense stacking root cause: `global.css` sets `img, svg { display:
  block }`; `Button.jsx` puts children (Plus svg + text) inside a plain
  inline `<span class="btn-label">`, so the block-level svg wraps the text
  to a second line.
- Tab order: `InsightsPage.jsx` builds `tabOptions = [previous, current]`.
- Donut collapse root cause: `.chart-figure svg { width: 100% }` +
  `.donut-layout` forced `flex-direction: row` at ≥768 px viewport with a
  180 px legend — the SVG is a shrinkable flex item, so it collapses (~25 px
  at 1024) even though `DonutChart.jsx` computes a 128–200 px `size`; the
  measured ref (`plotRef`) also measures the whole row, not the space the
  donut can actually use.
- Ring thickness: `radius = 0.37×size`, `strokeWidth = 0.13×size` → inner ≈
  70% of outer (kit: ≈45%).
- Center total: `DonutChart.jsx` renders `donut-center-value` +
  `donut-center-label` texts; no source shows them.
- X labels: `LineChart.jsx` always renders indexes `[0, mid, last]`
  regardless of plot width (~95 px plot in the 390 px two-up column).
- Markers: `renderPoints` circles are always visible (r 4.5, opaque fills).
- Seed distribution: `demoSeed.js` front-loads day 1 (rent 3,500 + savings
  600 = 4,100 vs content.json's 600 at Jul 1). Sampling contract (verified
  in `server/src/services/calc.js`): cumulative sums at days
  1/6/11/16/21/26/last (`CASH_FLOW_BASE_DAYS`), inclusive string compare.
- Row hover: no `.category-row:hover` rule exists.
- Contrast: `Button.css` `.btn-primary` uses `--color-action-primary`
  (=blue-500, 3.60:1 with white); `MonthTabs.css` selected-current uses
  blue-500; `TextButton.css` uses `--color-action-primary` as 14 px text on
  the page background (3.60:1 — same failing pairing, same remedy; fixed
  under D-DES-014 to avoid an inconsistent action color being re-flagged).
- Planned label: `SummaryMetrics.css` `.summary-metric-label-planned` uses
  yellow-700 at 14 px (4.17:1).

## Ordered implementation tasks

Order minimizes risk: server-side data first (tests-first), then isolated
CSS/component fixes, then the chart cluster (largest), then full validation.
Each task is independently revertible (single-concern diffs); run the named
targeted checks after each task before moving on (rollback checkpoint =
green targeted checks + clean `git diff` scope).

### T1 — D-DES-012: seed distribution reproduces content.json cash flow (tests first)

sourceRefs: `docs/design/figma-kit/data/content.json` (cashFlow),
`server/src/seed/demoSeed.js`, roadmap money rules (integer minor units).

1. **New developer unit test** `server/tests/unit/demoSeedData.test.js`
   (pure data — no DB): import `CURRENT_MONTH_EXPENSES`,
   `PREVIOUS_MONTH_EXPENSES` (export them from `demoSeed.js`) and assert:
   - per-category totals (minor): current 395700/151600/84200/92600/117900,
     previous 430000/170000/90000/100000/128000;
   - grand totals 842000 / 918000;
   - cumulative at sample days 1/6/11/16/21/26/28+ (reuse
     `cumulativeAtDates`/`cashFlowSampleDates` from `services/calc.js` with a
     synthetic month, e.g. "2026-07" and "2026-02" to prove the ≤28-day
     invariant) equals content.json ×100:
     July [60000, 180000, 310000, 460000, 590000, 730000, 842000];
     June [80000, 210000, 350000, 500000, 650000, 790000, 918000];
   - every `day` is an integer 1–28; every `amountMinor` a positive integer.
2. **Replace the two datasets** in `server/src/seed/demoSeed.js` with the
   distribution below (designed so window sums match the kit increments;
   days ≤28 preserved so February seeding stays valid — note the last sample
   window then covers days 27–28, still matching the kit's final value):

   Current month (increments 600/1200/1300/1500/1300/1400/1120 major):
   | categoryId | day | amountMinor | note |
   |---|---:|---:|---|
   | savings | 1 | 60000 | Transfer to savings |
   | housing | 2 | 82000 | Rent installment |
   | groceries | 4 | 38000 | Supermarket |
   | groceries | 8 | 40000 | Supermarket |
   | housing | 9 | 90000 | Rent installment |
   | housing | 13 | 100000 | Rent installment |
   | transport | 14 | 30000 | Transit pass |
   | groceries | 15 | 20000 | Market |
   | savings | 17 | 57900 | Transfer to savings |
   | housing | 18 | 72100 | Utilities |
   | fun | 22 | 50000 | Concert |
   | housing | 23 | 51600 | Repairs |
   | transport | 25 | 38400 | Fuel |
   | groceries | 27 | 53600 | Supermarket |
   | fun | 27 | 42600 | Dinner out |
   | transport | 28 | 15800 | Fuel |

   Previous month (increments 800/1300/1400/1500/1500/1400/1280 major):
   | categoryId | day | amountMinor | note |
   |---|---:|---:|---|
   | savings | 1 | 80000 | Transfer to savings |
   | housing | 2 | 90000 | Rent installment |
   | groceries | 4 | 40000 | Supermarket |
   | groceries | 8 | 45000 | Supermarket |
   | housing | 9 | 95000 | Rent installment |
   | housing | 13 | 117000 | Rent installment |
   | transport | 14 | 33000 | Transit pass |
   | savings | 17 | 48000 | Transfer to savings |
   | housing | 18 | 80000 | Utilities |
   | groceries | 20 | 22000 | Market |
   | fun | 22 | 60000 | Concert |
   | housing | 23 | 48000 | Repairs |
   | transport | 25 | 32000 | Fuel |
   | groceries | 27 | 63000 | Supermarket |
   | fun | 27 | 40000 | Dinner out |
   | transport | 28 | 25000 | Fuel |

   (Both tables verified at planning time: window sums equal the kit
   increments; category totals unchanged from iteration 1.)
3. Update the file-header comment (now also documents the cash-flow-series
   guarantee) and the inline totals comment.
4. API/schema impact: none. Data flow: seed → transactions →
   `insightsService.getInsights` cumulative sampling (unchanged code).

Affected tests: **none change** — no existing test imports the seed
(verified: integration/QA suites seed via the HTTP API with their own
fixtures; `smoke.mjs` checks coherence, not specific values). New test added.
Targeted check: `npm test -w server` (unit only) — new test green.

### T2 — D-DES-001: email leading Mail icon (test first)

sourceRefs: `docs/design/figma-kit/docs/icon-map.md` (Email → Mail, 20 px),
component-inventory.md (Input/Text anatomy), approved mobile/desktop login.

1. Extend `client/tests/LoginPage.test.jsx` and
   `client/tests/RegisterPage.test.jsx` (developer-owned) with an assertion:
   the email field's `.field-control` contains an `svg` (e.g.
   `screen.getByLabelText("Email").closest(".field-control").querySelector("svg")`
   not null). Justification for the new expectation: icon-map.md maps
   Email → `Mail`; both approved login compositions show it.
2. `client/src/pages/LoginPage.jsx` and `RegisterPage.jsx`: import `Mail`
   from `lucide-react`; pass `icon={Mail}` to the email `TextInput`.
   `TextInput` already renders `icon` at `size={20}` with `.field-icon`
   styling — no component change.

Targeted check: `npx vitest run tests/LoginPage.test.jsx tests/RegisterPage.test.jsx -w client`
(from repo root: `npm test -w client -- tests/LoginPage.test.jsx tests/RegisterPage.test.jsx`).

### T3 — D-DES-002 + D-DES-003: auth card surface + width caps

sourceRefs: `docs/design/figma-kit/docs/responsive-layout.md` (Login Mobile:
max form width 350 px; Login Desktop: card 440 px, padding 40 px),
`docs/design/approved/desktop-login.jpg`.

`client/src/pages/AuthPage.css` only:

1. `.auth-card`: `max-width: 400px` → `350px` (mobile default, D-DES-003).
2. Add:
   ```css
   @media (min-width: 768px) {
     .auth-card {
       max-width: 440px;
       padding: var(--space-10); /* 40px */
       background: var(--color-surface);
       border: 1px solid var(--color-border);
       border-radius: var(--radius-lg);
       box-shadow: var(--shadow-card);
     }
   }
   ```
   (Same surface recipe as `Card.css`; kit `docs/` define no tablet-specific
   login, and the ≥768 breakpoint matches the dialog centered-card rule the
   reviewer already approved. Width 440 is the card outer width per spec.)
3. Verify the 200%-zoom-equivalent 720 px viewport still renders the mobile
   (350 px, no card) layout — it does (<768).

Affected tests: none (no test asserts auth layout CSS).
Targeted check: client Login/Register/SessionExpiry suites + visual check at
1440/768/600/390/320.

### T4 — D-DES-004: page-title type ramp

sourceRef: `docs/design/figma-kit/docs/figma-build-spec.md` §3 (Heading/Page
= DM Serif Display 400, 28/36), approved mobile-budget.jpg.

`client/src/components/ui/AppHeader.css`: `.app-header-title` →
`font-size: 28px; line-height: 36px;` (font family/weight already inherited
from the global `h1` rule). Covers Budget, Insights, Edit/Create budget —
all use `AppHeader`. Login's 32 px `auth-title` (Display/Medium) is correct
and untouched.

Affected tests: none (`getByRole("heading", { name: … })` is size-agnostic).
Targeted check: client BudgetPage/InsightsPage suites; visual check that the
header row still fits at 320 px (title truncation/wrap; flex row with
32 px logo + menu button leaves ~200 px — "Spending insights" wraps to two
36 px lines at 320 if needed; confirm no overflow in the 320 recheck).

### T5 — D-DES-005: inline button icon

sourceRefs: `docs/design/figma-kit/docs/component-inventory.md`
(Button/Primary anatomy: leading icon inline), approved budget compositions.

`client/src/components/ui/Button.css`: add
```css
.btn-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
```
Root cause is the global `svg { display: block }` reset; making the label a
flex row puts any icon child on the same line for every `Button` usage
(Add expense, dialog actions). No JSX change.

Affected tests: none (`Button.test.jsx` asserts roles/labels/spinner only).
Targeted check: client Button/BudgetPage suites; visual check of
"+ Add expense" at 390 and 1440.

### T6 — D-DES-013: category-row hover state

sourceRef: `docs/design/figma-kit/docs/component-inventory.md`
(Budget/Category row: "Hover state for desktop").

`client/src/features/budget/CategoryRow.css`: add
```css
@media (hover: hover) and (pointer: fine) {
  .category-row {
    border-radius: var(--radius-md);
  }
  .category-row:hover {
    background: var(--color-blue-50);
  }
}
@media (prefers-reduced-motion: no-preference) {
  .category-row {
    transition: background-color 180ms ease;
  }
}
```
blue-50 (#eef3fc) is the kit's lightest blue tint, matching the existing
secondary-button hover; hover-capable-pointer media query keeps touch
devices unaffected. Rows keep their divider borders; background hover is
non-color-critical (no information conveyed by hover alone).

Affected tests: none. Targeted check: client BudgetPage suites; visual hover
check at 1440 (compare against `budget-1440-row-hover.png` failure mode).

### T7 — D-DES-014: white-on-blue AA (token usage only)

sourceRefs: `docs/design/figma-kit/docs/accessibility-checklist.md` ("White
text on blue buttons must be checked against the implementation blue"; AA
4.5:1), `docs/design/figma-kit/docs/color-scheme.md`, roadmap contrast gate;
adjudication in review-report.json notes. tokens.css stays byte-identical.

1. `client/src/components/ui/Button.css`:
   - `.btn-primary { background: var(--color-blue-600); }` (was
     `--color-action-primary` = blue-500; white on blue-600 = 4.95:1);
   - `.btn-primary:hover:not(:disabled) { background: var(--color-blue-700); }`
     (hover must stay distinguishable from the new default; white on
     blue-700 ≈ 7.3:1).
2. `client/src/components/ui/MonthTabs.css`:
   `.month-tab-current.month-tab-selected { background: var(--color-blue-600); }`
   (selected July tab, white 16/600 text). Selected June (yellow-500 +
   near-black, 9.95:1) untouched.
3. `client/src/components/ui/TextButton.css`:
   `color: var(--color-blue-600);` (was action-primary/blue-500 at 14 px on
   the page background = 3.60:1 — the identical failing pairing in text
   form; blue-600 on #FAF8F4 ≈ 4.6–4.7:1). Documented as part of the
   D-DES-014 remediation (same checklist rule, keeps one action color) in
   the build report and contrast evidence.
4. Do NOT touch: chart series blue-500 (non-text, 3.55:1 ≥3:1), Income value
   blue-500 (large text), progress fills, focus ring — all pass and/or are
   covered by D-DES-INT-009.
5. Recompute and record the affected rows in a new
   `.workflow/sprints/delivery/iteration-02/developer/evidence/contrast.md`
   (same script/method as iteration 1); the "kit-inherited deviations" rows
   for white-on-blue-500 move to the PASS table.

Affected tests: none (no test asserts button colors).
Targeted check: client Button/MonthTabs-related suites; contrast
recomputation; visual check of Sign in / Add expense / selected July tab.

### T8 — D-DES-015: "Planned" label AA

sourceRefs: `docs/design/figma-kit/docs/accessibility-checklist.md` (AA
4.5:1 for normal text), `docs/design/figma-kit/docs/color-scheme.md`
(yellow = planned), roadmap contrast gate; remedy options named in the
issue: larger/bolder label or neutral text + yellow marker. Chosen remedy:
**neutral text + yellow marker** — keeps the composition's 14 px label scale
(a ≥18.66 px bold label would break the summary-card hierarchy) while the
kit's yellow=planned semantic stays visible non-textually.

1. `client/src/features/budget/SummaryMetrics.jsx`: inside the Planned `dt`,
   prepend `<span className="summary-metric-marker summary-metric-marker-yellow" aria-hidden="true" />`
   before the label text.
2. `client/src/features/budget/SummaryMetrics.css`:
   - `.summary-metric-label-planned { color: var(--color-text-primary); }`
     (was yellow-700 — 4.17:1; text-primary = 16.7:1);
   - add:
     ```css
     .summary-metric-label {
       display: inline-flex;
       align-items: center;
       gap: 6px;
     }
     .summary-metric-marker {
       width: 8px;
       height: 8px;
       border-radius: var(--radius-full);
       flex: none;
     }
     .summary-metric-marker-yellow {
       background: var(--color-yellow-500);
     }
     ```
   The marker is decorative (aria-hidden; the word "Planned" carries the
   meaning), so no 3:1 non-text requirement applies. Income label stays
   blue-700 (6.94:1, accepted under D-DES-INT-009); Available stays
   text-primary.
3. Record the new pairing in the iteration-02 contrast evidence.

Affected tests: none (`getByText("Planned")` style queries unaffected;
verified BudgetPage/QA suites assert text and values, not colors).
Targeted check: client BudgetPage + qa-budget-page suites; visual check at
390/1440.

### T9 — D-DES-006: month tab order

sourceRefs: `docs/design/figma-kit/docs/component-inventory.md` (Tabs/Month
options listed "July, June"), approved mobile/desktop insights.

`client/src/features/insights/InsightsPage.jsx`: reorder `tabOptions` to
`[{current}, {previous}]` (current/July first → renders left). No MonthTabs
component change; roving tabindex, wrap-around arrow keys, Home/End all
order-agnostic.

Affected tests — analyzed, **no expectation changes needed**:
- `InsightsPage.test.jsx` "switches months … with arrow keys": focuses the
  current tab and presses ArrowLeft; with the new order index 0 wraps to
  index 1 (previous) — same selected result. Still passes.
- `qa-insights-page.test.jsx` QA-CC-62/63 (ArrowLeft → previous,
  ArrowRight → current): wrap-around yields identical outcomes. Still pass
  (QA-owned; must not be edited anyway).
If any of these unexpectedly fail during build, the failure means the
roving-focus logic regressed — fix the product, never the QA test.
Targeted check: client InsightsPage + qa-insights-page suites; visual check
July-left at 390/1440.

### T10 — D-DES-009: remove donut center total

sourceRefs: `docs/design/figma-kit/docs/figma-build-spec.md` §6 (labels in a
separate legend; no center content), approved mobile/desktop insights
(empty center).

1. `client/src/features/insights/charts/DonutChart.jsx`: delete the two
   `<text>` nodes (`donut-center-value`, `donut-center-label`). Keep the
   `totalMinor` prop — still used by the visible figcaption ("… Total
   8,420.") and hidden table.
2. `client/src/features/insights/charts/charts.css`: delete
   `.donut-center-value` / `.donut-center-label` rules.
3. Update the component doc comment (no longer "the center shows the
   month's total").

Affected tests — analyzed, **no expectation changes needed**: all
`findAllByText("8,420")` assertions use `>= 1` and the hero + caption still
match; no test targets the center nodes (verified by grep). The count of
"8,420" matches drops by one — assertions are count-agnostic.
Targeted check: client InsightsPage + qa-insights-page suites.

### T11 — D-DES-008: ring thickness ≈45% inner radius

sourceRef: `docs/design/figma-kit/docs/figma-build-spec.md` §6 (donut inner
radius ≈45% of outer), approved compositions.

`client/src/features/insights/charts/DonutChart.jsx`: change the geometry
constants to `radius = size * 0.32`, `strokeWidth = size * 0.24`
(outer = 0.44×size, inner = 0.20×size → inner/outer ≈ 45.5%, with a
0.06×size margin so the 2 px focus outline + 2 px offset never clips inside
the SVG). Keep `SEGMENT_GAP`, dasharray math (radius-dependent — recomputed
automatically), and the empty-state track.

Affected tests: none (no geometry assertions in jsdom).
Targeted check: client InsightsPage suites; visual thickness comparison at
320 vs `docs/design/approved/mobile-insights.jpg`.

### T12 — D-DES-007: donut vs legend layout (container-driven)

sourceRefs: `docs/design/figma-kit/docs/responsive-layout.md` ("Charts:
scale while preserving labels and a minimum usable plot area"; Insights
grid), `docs/design/approved/desktop-insights.jpg`,
`client/src/features/insights/charts/DonutChart.jsx`. Depends on T10/T11
(same file). Fix stays inside the accepted D-DES-INT-003 grid.

1. `DonutChart.jsx`:
   - add constants `LEGEND_MIN = 180`, `LEGEND_GAP = 24`;
   - `measured = useMeasuredWidth(plotRef, MAX_SIZE)` (unchanged ref on the
     `.donut-layout` element);
   - `const besideWidth = measured - LEGEND_MIN - LEGEND_GAP;`
   - `const legendBeside = besideWidth >= MIN_SIZE;`
   - `const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, legendBeside ? besideWidth : measured));`
   - layout div className:
     `` `chart-plot donut-layout${legendBeside ? " donut-layout-row" : ""}` ``.
2. `charts.css`:
   - delete the `@media (min-width: 768px) .donut-layout { flex-direction:
     row … }` block (the viewport is the wrong signal — the card, not the
     window, constrains the donut);
   - add:
     ```css
     .donut-layout-row {
       flex-direction: row;
       justify-content: center;
       gap: var(--space-6);
     }
     .donut-layout-row .chart-legend {
       min-width: 180px;
     }
     .donut-layout svg {
       width: auto;
       flex: none;
     }
     ```
     The `svg` override defeats `.chart-figure svg { width: 100% }` (the
     flex-shrink root cause) so the donut always renders at its computed
     128–200 px attribute size.
3. Expected results by reported viewport (computed from the grid math):
   - 1440 (donut card content ≈336 px): `besideWidth` ≈132 ≥128 → legend
     right, donut ≈132 px (was ~95);
   - 1024 (content ≈235 px): besideWidth <128 → legend below, donut 200 px
     (was ~25);
   - 768 (two-up content ≈310 px): besideWidth <128 → legend below, donut
     200 px (was ~90);
   - 320/390 stacked/two-up mobile: unchanged stacking, 128–200 px.
   - jsdom (no ResizeObserver): fallback 200 → stacked column — same DOM
     shape tests exercise today.

Affected tests: none change (layout classes are not asserted; legend items,
percentages, tables, tabindex all unchanged).
Targeted check: client InsightsPage + qa-insights-page suites; visual check
at 768/1024/1440 with the seeded demo user (donut ≥128 px, legible).

### T13 — D-DES-010: x-label collision (tests first)

sourceRef: `docs/design/figma-kit/docs/accessibility-checklist.md`
("Maintain legible labels at the smallest supported width").

1. **Unit tests first** in `client/tests/chartMath.test.js` (developer-owned)
   for a new pure helper `xLabelIndexes(labelCount, plotWidth)` in
   `client/src/features/insights/charts/chartMath.js`:
   - returns `[0, mid, last]` when `plotWidth >= 150`;
   - returns `[0, last]` when `plotWidth < 150`;
   - degenerate counts: `labelCount 1 → [0]`, `2 → [0, 1]` (no duplicates —
     dedupe indexes);
   - justification for the new expected behavior: the checklist's
     smallest-width legibility rule (three ~38 px labels + anchors cannot
     fit a ~95 px plot: measured collision in the 390 two-up card).
   Threshold 150 keeps three labels at the 320 stacked plot (~206 px) and
   every ≥768 layout, and drops to first+last only in the narrow two-up
   column (~95 px).
2. `chartMath.js`: implement `xLabelIndexes` (exported, pure).
3. `LineChart.jsx`: replace the hardcoded
   `labelIndexes = [0, Math.floor((labels.length-1)/2), labels.length-1]`
   with `xLabelIndexes(labels.length, plotWidth)`; anchor logic unchanged
   (first=start, last=end, middle=middle).

Affected tests — one existing suite gains cases (`chartMath.test.js`,
additive only); `InsightsPage.test.jsx`/QA suites unaffected (jsdom fallback
width 560 → still three labels; the hidden table, not the axis, carries the
full date list). Targeted check: client chartMath + InsightsPage suites;
visual check at 390 (July and June views — the reported worst case).

### T14 — D-DES-011: hover-only line markers

sourceRefs: `docs/design/figma-kit/docs/figma-build-spec.md` §6 ("Circular
point markers may appear on hover only"), approved desktop-insights; the
issue text explicitly permits keyboard-focusable targets that are visually
hidden until hover/focus (a11y checklist: tooltips via keyboard focus AND
hover — both preserved).

1. `LineChart.jsx`: in `renderPoints`, add class → `className="chart-mark
   chart-mark-hover"` (donut/bar marks unaffected).
2. `charts.css`:
   ```css
   .chart-mark-hover {
     opacity: 0;
   }
   .chart-mark-hover:hover,
   .chart-mark-hover:focus-visible {
     opacity: 1;
   }
   @media (prefers-reduced-motion: no-preference) {
     .chart-mark-hover {
       transition: opacity 160ms ease;
     }
   }
   ```
   Opacity keeps hit-testing and focusability (unlike `visibility`/`display`),
   so hover reveals the marker + tooltip together and Tab focus shows marker,
   focus ring, and tooltip.

Affected tests — analyzed, **no expectation changes needed**:
`InsightsPage.test.jsx` and `qa-insights-page.test.jsx` (QA-CC-67) assert
`role="img"` + `tabindex="0"` on marks — both preserved; jsdom asserts no
computed visibility. Targeted check: client InsightsPage + QA insights
suites; visual hover/focus check at 1440 and 390.

### T15 — Full validation, evidence, reports

See Test plan below. Write `build-report.md` (any deviations + reasons) and
`test-report.json` (repository template) under
`.workflow/sprints/delivery/iteration-02/developer/`; evidence under
`…/iteration-02/developer/evidence/` (screenshots, contrast.md,
insights-320 recheck, seed verification output).

## Test plan

All commands from the repo root. Treat any skipped/flaky/unexecuted check as
a failure. Never print or log `DATABASE_URL` (seed/migrate/integration runs
read it from the environment; redact command echoes in evidence).

Tests-first order: T1.1 (seed data test) and T13.1 (xLabelIndexes tests)
are written before their implementations; T2.1 (icon assertions) before the
one-line page changes.

### Suites and commands (full re-test scope, after all tasks)

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Lint | `npm run lint` | exit 0 |
| 2 | Format | `npm run format:check` | exit 0 |
| 3 | Server unit (incl. new demoSeedData test) | `npm test -w server` | all pass |
| 4 | Server integration (real HTTP) | `npm run test:integration` | all pass |
| 5 | Client developer + QA suites (148 QA tests intact) | `npm test -w client` | all pass |
| 6 | Coverage (thresholds unchanged) | `npm run coverage` | exit 0 |
| 7 | Production build | `npm run build` | exit 0 |
| 8 | Migrate + seed (guarded) | `ALLOW_DEMO_SEED=true npm run seed:demo` | summary totals 842000/918000 |
| 9 | Smoke against SERVE_CLIENT build | `npm run smoke` | all steps pass incl. insights coherence |
| 10 | tokens byte-identity (D-FND-D1) | `diff client/src/styles/tokens.css docs/design/figma-kit/tokens/design-tokens.css` | empty diff |

### Issue-level verification matrix (visual spot-check at the reported viewport)

Run the built app (`SERVE_CLIENT=true`, seeded demo user) with the same
headless-browser tooling as iteration 1; capture to
`…/iteration-02/developer/evidence/screenshots/`.

| Issue | View | Viewport(s) | Pass condition |
|---|---|---|---|
| D-DES-001 | /login, /register | 390 | Mail icon (svg) leading the email input, 20 px |
| D-DES-002 | /login | 1440 | one centered 440 px surface card, 40 px padding, radius+shadow |
| D-DES-003 | /login | 600 (+320 sanity) | form measures ≤350 px |
| D-DES-004 | /budget, /insights, /budget/:m/edit | 390 + 1440 | h1 computed 28 px/36 px DM Serif Display |
| D-DES-005 | /budget | 390 + 1440 | "+ Add expense" one line, icon before label |
| D-DES-006 | /insights | 390 + 1440 | July tab left, June right; arrow keys + selection colors correct |
| D-DES-007 | /insights | 768, 1024, 1440 | donut SVG ≥128 px; legend right at 1440, below at 768/1024; center text absent |
| D-DES-008 | /insights | 320 | ring thickness visually ≈ approved comp (inner ≈45%) |
| D-DES-009 | /insights | 390 + 1440 | donut center empty |
| D-DES-010 | /insights | 390 (July AND June views) | x labels non-overlapping (first+last only in two-up column); 320 stacked keeps 3 labels |
| D-DES-011 | /insights | 1440 + 390 | no visible markers at rest; marker+tooltip on hover and on keyboard focus |
| D-DES-012 | /insights (seeded) | 1440 | Jul 1 point at 600 (not ~4.1K); curve matches content.json shape; totals 8,420/9,180 |
| D-DES-013 | /budget | 1440 | row hover shows blue-50 background; screenshot differs from resting state |
| D-DES-014 | /login, /budget, /insights | 390 | primary buttons + selected July tab on blue-600; computed contrast 4.95:1 recorded |
| D-DES-015 | /budget | 390 | Planned label near-black + yellow dot; computed contrast recorded |

### Regression rechecks (roadmap/accepted-baseline gates)

- 320 px: `document.documentElement.scrollWidth === 320` on Login, Budget,
  Insights (guards T3/T4/T8/T12 changes; record JSON like iteration 1's
  `insights-320-recheck.json`).
- 200% zoom equivalent (720×450): login mobile layout, no horizontal scroll.
- Keyboard: tab order on login (icon must not add a stop), month-tab arrow
  keys, chart-mark focus ring + tooltip visible (T14 focus-visible path).
- Reduced motion: new transitions (T6 hover, T14 opacity) are inside
  `prefers-reduced-motion: no-preference` guards or neutralized by the
  global reduce block; re-run the reduced-motion sweep on /budget /insights.
- Browser console clean on /login /budget /insights (except expected
  401/404 network entries).
- Contrast evidence: recompute the changed pairings (white/blue-600 4.95,
  white/blue-700, blue-600/background, text-primary label, yellow-500 dot
  decorative note) into `evidence/contrast.md`.

### Existing tests that could be affected — disposition summary

| Test (owner) | Behavior it asserts | Impact | Action |
|---|---|---|---|
| `client/tests/InsightsPage.test.jsx` tab-switch test (dev) | ArrowLeft from current selects previous | Order swap (T9) — wrap-around keeps outcome | none (verify green) |
| `client/tests/qa/qa-insights-page.test.jsx` QA-CC-62/63 (QA) | Arrow keys + refetch | same wrap-around analysis | none — QA-owned, must stay untouched |
| `client/tests/InsightsPage.test.jsx` + QA "8,420" queries | `findAllByText("8,420").length >= 1` | center-total removal (T10) reduces matches by 1 | none (assertions count-agnostic) |
| `InsightsPage.test.jsx` D-INS-D3 / QA-CC-67 chart-mark `tabindex` | marks focusable | T14 keeps marks in DOM, opacity-only | none |
| `client/tests/chartMath.test.js` (dev) | axis/segment/point math | T13 adds `xLabelIndexes` cases | additive change — new expectations justified by accessibility-checklist.md |
| `client/tests/LoginPage.test.jsx` / `RegisterPage.test.jsx` (dev) | labels, validation, submit | T2 adds icon assertions | additive change — justified by icon-map.md + approved logins |
| `server/tests/unit/*` | calc/auth/schemas | new `demoSeedData.test.js` only | additive — justified by content.json cashFlow |
| `server/tests/integration/*`, `server/tests/qa/*` (QA) | HTTP behavior with API-seeded fixtures | none import the demo seed | none |
| `scripts/smoke.mjs` | insights coherence (sum == total == last cumulative) | seed totals unchanged | none |
| `client/tests/Button.test.jsx`, `BudgetPage.test.jsx`, QA budget suites | roles/labels/values | T5/T6/T7/T8 are CSS/markup-decoration only | none |

No test expectation is being *changed*; all test deltas are additive, each
tied to an authoritative design sourceRef above. If an unlisted test fails
during build, treat it as a product regression first; only adjust a
developer-owned expectation when the design spec demands the new behavior,
and record the sourceRef in `build-report.md`.

## Risks, assumptions, and blockers

Risks:

1. **T12 donut sizing at 1440** — computed ≈132 px donut beside the legend
   is within the component's 128–200 px band but visibly smaller than the
   approved comp's donut. Mitigation: it satisfies the reported expectation
   ("minimum usable plot size next to its legend", 128 px floor); if the
   reviewer wants larger, the same code path stacks the legend below at any
   threshold change (one constant). Spot-check screenshot included in
   evidence for adjudication.
2. **T4 title at 320 px** — 28 px serif titles ("Spending insights") may
   wrap in the 320 header row. Wrapping is acceptable (no fixed heights);
   the 320 recheck guards overflow. If clipping appears, allow the title to
   wrap (`overflow-wrap`), never shrink below 28 px (kit forbids scaling
   fonts with frame width).
3. **T7 hover-state collision** — primary hover moves blue-600 → blue-700,
   which is also the focus-ring token; visually distinct in context (fill vs
   ring) but verify hover+focus simultaneously in the spot-check.
4. **Seed determinism vs live date** — the seed writes the *current*
   calendar month; in short months the last sample window (days 27–last)
   still contains both W7 transactions because all days ≤28. The new unit
   test proves the series for both a 31-day and a 28-day month.
5. **`.donut-layout svg { width: auto }` specificity** — must beat
   `.chart-figure svg { width: 100% }` (equal specificity — relies on later
   order in the same stylesheet import graph; both rules live in charts.css,
   so place the override after it; verify computed width in the browser
   spot-check).
6. **Font metric drift** — the 150 px x-label threshold assumes ~38 px
   labels at 12 px Inter; verified against the real July/June labels in the
   visual check (both views at 390).

Assumptions:

- The ≥768 px breakpoint for the desktop login card (kit defines only
  Mobile 320–767 and a "Desktop" card; the reviewer measured the mobile cap
  violation up to 767) — consistent with the approved dialog breakpoint.
- TextButton's blue-500 → blue-600 is in-scope for D-DES-014 (same failing
  white/blue family pairing, same checklist rule); it will be listed in the
  build report so design review can confirm.
- Browser-based evidence uses the same local SERVE_CLIENT + guarded-seed
  setup as iteration 1 (temporary RATE_LIMIT env overrides allowed for
  capture only, product defaults unchanged).

Blockers: none — all 15 issues have deterministic, in-repo fixes; no source
conflicts requiring user decisions were found (D-DES-014/015 conflict was
already adjudicated by design review).
