# Contrast Evidence — Iteration 2 (D-DES-014 / D-DES-015)

Same method as iteration 1's audit (WCAG 2.1 relative luminance, standard
sRGB linearization; recomputed 2026-07-31). Only the pairings changed by
this iteration are listed; every other row of the iteration-1 audit is
unchanged. `tokens.css` remains byte-identical to the kit's
`design-tokens.css` — every remedy below only changes which existing token
a component consumes.

## Changed pairings — PASS

| Foreground | Background | Ratio | Threshold | Use |
|---|---|---:|---|---|
| white | blue-600 `#476FB9` | 4.95 | 4.5 | primary buttons, selected current-month tab (D-DES-014; was blue-500 = 3.60 FAIL) |
| white | blue-700 `#36558F` | 7.36 | 4.5 | primary button hover (moved from blue-600 so hover stays distinguishable) |
| blue-600 `#476FB9` | background `#FAF8F4` | 4.67 | 4.5 | TextButton 14px action text (same D-DES-014 rule; was blue-500 = 3.60 FAIL) |
| blue-600 `#476FB9` | surface `#FFFDF9` | 4.87 | 4.5 | TextButton on card surfaces |
| text-primary `#111827` | background `#FAF8F4` | 16.72 | 4.5 | "Planned" summary label (D-DES-015; was yellow-700 = 4.17 FAIL at 14px) |

The iteration-1 "kit-inherited deviations" rows for white-on-blue-500
(3.60) and the yellow-700 Planned label (4.17) are resolved by the rows
above and no longer apply.

## Decorative / non-text notes

| Element | Ratio | Disposition |
|---|---:|---|
| yellow-500 `#E2BE62` Planned marker dot vs surface | 1.76 | Decorative (`aria-hidden="true"`); the word "Planned" carries the meaning, so no 3:1 non-text requirement applies. It preserves the kit's yellow=planned semantic non-textually. |
| blue-50 `#EEF3FC` category-row hover vs surface | 1.10 | Hover background is decorative feedback (D-DES-013); no information is conveyed by hover alone. Matches the existing secondary-button hover tint. |

## Unchanged (verified still in place)

- Income label blue-700 (6.94) and Income value blue-500 large-text (3.40 ≥ 3.0) — accepted under D-DES-INT-009.
- Available value green-600 (3.70 large), hero comparison yellow-700 19px/700 (4.17 large).
- Chart series blue-500 non-text marks (3.55 ≥ 3.0); focus ring blue-700 (6.94 ≥ 3.0).
- Selected previous-month tab: text-primary on yellow-500 (9.95).
