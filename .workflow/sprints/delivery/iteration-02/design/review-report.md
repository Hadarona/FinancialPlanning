# Design Re-Review — Delivery, Iteration 2

**Status: `pass`** — all 15 iteration-1 issues (D-DES-001..015) verified
fixed against the running production build; no regressions found on Login,
Register, Budget, or Insights. The 10 accepted intentional differences carry
forward unchanged, plus one new accepted entry (D-DES-INT-011, donut legend
stacking). Full detail: `design/review-report.json`; evidence under
`design/evidence/` (20 screenshots, computed-style/geometry/console/contrast
audits).

## How the re-review was performed

- Started the app per the README production-style run (fresh `npm run build`,
  `SERVE_CLIENT=true` server on :4060), re-seeded with
  `ALLOW_DEMO_SEED=true npm run seed:demo` (demo@example.com; totals
  842,000/918,000 minor units). `DATABASE_URL` never printed or logged.
- Re-verified each issue at its reported viewport/state, including hover and
  keyboard-focus states (D-DES-011/013/014) and the June tab
  (D-DES-006/010/012), with computed-style and SVG-geometry measurements
  (`evidence/capture-summary.json`, `evidence/chart-geometry-audit.json`).
- Regression-swept Login, Register, Budget, and Insights at 390×844 and
  1440×900, checked 320px for horizontal scroll on all four screens, audited
  reduced motion, and recorded the browser console.
- Contrast ratios independently recomputed from the kit tokens
  (`evidence/contrast-recheck.md`); they match the developer's audit row for
  row. `tokens.css` re-verified byte-identical to the kit file.

## Per-issue verdicts

| ID | Verdict | Verified result |
|---|---|---|
| D-DES-001 | fixed | Mail icon (20px Lucide) leads the email input on /login and /register. |
| D-DES-002 | fixed | 1440: centered 440px surface card, 40px padding, border/radius-lg/shadow (register too). |
| D-DES-003 | fixed | Auth form measures 350px (max-width 350px) at a 600px viewport. |
| D-DES-004 | fixed | Budget / Spending insights / Edit budget titles 28px/36px DM Serif Display 400 at 390 and 1440. |
| D-DES-005 | fixed | "+ Add expense" one 24px-tall line, icon inline before the label (390 and 1440). |
| D-DES-006 | fixed | July (selected) left, June right at 390 and 1440; selection colors unchanged. |
| D-DES-007 | fixed | Donut SVG 200px at 320/768/1024/1440, 133px in the 390 two-up column — always ≥128px (was ~25px at 1024). Legend-below deviation accepted, see below. |
| D-DES-008 | fixed | Ring inner/outer radius = 45.5% at every viewport (spec ≈45%). |
| D-DES-009 | fixed | Donut center empty — zero text nodes inside the donut SVG. |
| D-DES-010 | fixed | No x-label collisions anywhere: 390 two-up shows first+last only ("Jul 1/Jul 31" gap 33px; June "Jun 1/Jun 30" gap 23px); 320 stacked and ≥768 keep three labels. |
| D-DES-011 | fixed | Markers rest at opacity 0; hover shows marker+tooltip; real keyboard Tab focus shows marker, 2px focus outline, and tooltip. Marks keep tabindex=0. |
| D-DES-012 | fixed | Seeded cash-flow table equals content.json exactly: July 600→8,420 and June 800→9,180 across all seven sample dates; chart shape now matches the kit/approved curve. |
| D-DES-013 | fixed | Row hover shows blue-50 rgb(238,243,252) with 12px radius (resting transparent); hover-capable pointers only; motion-gated transition. |
| D-DES-014 | fixed | Primary buttons and selected July tab on blue-600 (white 16px/600 = 4.95:1); hover blue-700 (7.36:1). |
| D-DES-015 | fixed | Planned label text-primary (16.72:1) with decorative aria-hidden 8px yellow-500 marker dot keeping the yellow=planned semantic. |

## Adjudications requested by the developer

1. **TextButton blue-500 → blue-600 (D-DES-014 extension): CONFIRMED.**
   Identical failing pairing (14px blue-500 text on the page background =
   3.60:1) under the same checklist rule; the in-ramp remedy keeps one
   consistent action color. Measured rgb(71,111,185): 4.67:1 on background,
   4.87:1 on surface — both pass AA.
2. **Donut legend stacks below a 200px donut at 1440 (build-report deviation
   #1): ACCEPTED, satisfies D-DES-007.** Recorded as intentional difference
   D-DES-INT-011. The measured donut-card content is 291px, so legend-beside
   would force an 87px donut — below the 128px minimum and essentially
   iteration 1's defect. The kit constraint ("scale while preserving … a
   minimum usable plot area") outranks the composition's side-by-side
   arrangement inside the already-accepted 4-column card (D-DES-INT-003),
   and the 200px stacked donut matches the approved composition's donut
   prominence far better. The container-driven rule still renders
   legend-beside whenever a card column fits ≥332px of content.

## Regression sweep — clean

No horizontal scroll at 320px on Login, Register, Budget, Insights
(scrollWidth = 320 on all four); reduced motion collapses the new hover and
marker transitions to ~0s with zero remaining animated elements; console has
no unexpected entries; focus rings, 44px targets, dialogs, and state screens
unaffected. At 320px the 28px serif "Spending insights" title wraps to two
lines — anticipated in the fix plan, no overflow, and the kit forbids
scaling fonts with frame width; not a defect.

The 10 iteration-1 intentional differences (D-DES-INT-001..010) were
re-verified as still in place and remain accepted. Functional
classification stays with QA; nothing functional blocked this review.
