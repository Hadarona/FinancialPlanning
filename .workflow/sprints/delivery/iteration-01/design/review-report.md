# Design Review — Delivery, Iteration 1

**Status: `issues`** — 15 issues (3 medium, 12 low), 10 accepted intentional
differences. Full detail: `design/review-report.json`; all evidence under
`design/evidence/` (49 screenshots, style/scroll/console/reduced-motion audits).

## How the review was performed

- Started the app per the README production-style run (`npm run build` current,
  `SERVE_CLIENT=true` server), seeded deterministic demo data with
  `ALLOW_DEMO_SEED=true npm run seed:demo` (demo@example.com, 2026-07/2026-06,
  kit totals 842,000/918,000 minor units).
- Captured Login, Register, Budget (+ create/edit form and dialogs), and
  Insights at 390×844 and 1440×900, plus 320/768/1024 reflow, a 200%-zoom
  equivalent (720px viewport), keyboard focus, reduced motion, and every
  roadmap state (loading skeleton, empty month, fresh user, zero progress,
  validation, error+retry, overspent, no-comparison, session-expired, menu,
  delete confirm, unsaved-changes, over-allocation).
- Compared against the six approved compositions (content inside their frames)
  and the structured kit (content.json → tokens → docs → references) per
  `docs/workflow/source-of-truth.md`. Capture-session-only rate-limit env
  overrides were needed for automation (see `evidence/capture-summary.json`).

## Issues

| ID | Sev | Screen | Summary |
|---|---|---|---|
| D-DES-001 | low | Login/Register | Email input is missing its leading Lucide `Mail` icon (icon map + both approved Login compositions; password's lock icon is present). |
| D-DES-002 | medium | Login (desktop) | No login card at 1440: `.auth-card` is transparent (no surface/padding/shadow) and 400px wide instead of the specified 440px card with 40px padding. |
| D-DES-003 | low | Login (mobile) | Form width capped at 400px, exceeding the mobile spec's 350px maximum between ~440–767px (measured 400px at 600px viewport). |
| D-DES-004 | low | Budget/Insights | Page titles render 20px DM Serif; the kit's Heading/Page style is DM Serif 28/36 (20px exists only as Inter Heading/Section). |
| D-DES-005 | low | Budget | Add-expense button stacks the Plus icon above the label; Button/Primary anatomy and approved compositions show icon + label inline. |
| D-DES-006 | low | Insights | Month tabs reversed: June left / July right; kit inventory and both approved compositions order July (left) then June. |
| D-DES-007 | medium | Insights | Donut collapses beside its legend: ~90px at 768, ~25px at 1024 (unreadable), ~95px at 1440 — below the intended 128px minimum and far from the approved prominent donut. |
| D-DES-008 | low | Insights | Donut ring too thin: inner radius ≈70% of outer vs the build spec's ≈45%. |
| D-DES-009 | low | Insights | Donut center total ("8,420 / month") is an addition — spec/approved show an empty center; it duplicates the hero and is illegible when the donut shrinks. |
| D-DES-010 | low | Insights | Cash-flow x-axis labels collide at 390 two-up ("Jul 16Jul 31"; June view "Jun 1Jun 16un 30") — kit checklist requires legible labels at small widths. |
| D-DES-011 | low | Insights | Line-chart point markers are always visible; build spec allows markers on hover only, approved shows clean lines. |
| D-DES-012 | low | Insights | Demo seed doesn't reproduce the kit cash-flow series: day-1 cumulative ≈4,100 vs content.json's 600/800, so the demo chart shape differs from the kit/approved reference (totals are honored; rendering itself is correct). |
| D-DES-013 | low | Budget (desktop) | Category-row hover state missing (inventory lists "Hover state for desktop"; no `:hover` rule, no visual change). |
| D-DES-014 | medium | all screens | White 16px/600 on blue-500 primary buttons and the selected July tab = 3.60:1, below AA 4.5:1 — the kit's own checklist mandates this exact check; in-ramp remedy exists (blue-600 = 4.95:1). Kit-internal conflict escalated to a defect because the roadmap gates on the checklist. |
| D-DES-015 | low | Budget | 14px yellow-700 "Planned" label = 4.17:1 (<4.5). Darkest yellow token; needs a size/weight or color-strategy decision. |

## Intentional differences accepted (see JSON for rationale + refs)

1. Budget progress 99/101/105/103/39 + "over plan" rows instead of the kit's
   63/34/26/28/56 — the roadmap's authoritative totals and progress formula
   contradict the kit percentages; roadmap wins (INT-001).
2. Donut Savings segment in blue-700 (kit maps Housing *and* Savings to blue;
   identical adjacent fills would be indistinguishable) (INT-002).
3. Desktop insights grid bar-8/donut-4/line-12 per the responsive spec over the
   conflicting desktop mockup (INT-003).
4. Lucide `Trash2`/`TriangleAlert` gap-filling icons (INT-004).
5. Voice-consistent copy extensions beyond content.json (register, forms,
   states, navigation, tooltips), marked in `lib/copy.js` (INT-005).
6. Neutral unselected month tab (kit defines selected-state colors only; the
   mockup's simultaneous blue+yellow pair would hide the selection) (INT-006).
7. Roadmap-required UI beyond the compositions: month nav, expense history +
   delete, budget form, full state coverage (INT-007).
8. Budget header shows the logo, not the mockup's back arrow (root screen; kit
   composition lists no back control — Insights keeps its arrow) (INT-008).
9. In-ramp contrast token swaps (coral-700/blue-700/green-600, 19px comparison
   amount), June bar pattern, visible chart text summaries — required by the
   kit's accessibility checklist; tokens.css untouched (INT-009).
10. Cash-flow axis tops at 10K per content.json data (mockup's 15K axis is
    inconsistent with the kit's own series) (INT-010).

## What passes

No horizontal scroll at 320 on any screen; reduced-motion removes all
animation; console free of JS errors/warnings; visible focus rings; kit-true
dialogs (bottom sheet <768 / centered 480px card ≥768); ≥44px targets;
skeleton/empty/error/validation/loading/overspent/no-comparison/
session-expired states all present and coherent; keyboard-focus tooltips show
category, month, value, units; summary metrics, category rows, tints, radii,
shadows, and progress tracks match tokens; 200%-zoom-equivalent layouts reflow
without loss.

Functional classification stays with QA; nothing functional blocked this
visual review.
