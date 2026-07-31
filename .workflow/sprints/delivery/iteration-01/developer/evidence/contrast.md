# Contrast Audit — Stage G (D-RESP-D3, kit accessibility checklist)

Computed WCAG 2.1 relative-luminance ratios for every token pairing the UI
uses (script: standard sRGB linearization; values verified 2026-07-31).
Thresholds: normal text ≥4.5:1, large text (≥24px, or ≥18.66px bold) ≥3:1,
non-text UI graphics ≥3:1 where they carry required information.

## Text pairings — PASS

| Foreground | Background | Ratio | Threshold | Use |
|---|---|---:|---|---|
| text-primary `#111827` | background `#faf8f4` | 16.72 | 4.5 | body text |
| text-primary | surface `#fffdf9` | 17.46 | 4.5 | cards, dialogs |
| text-primary | yellow-500 `#e2be62` | 9.95 | 4.5 | selected previous-month tab (kit rule: near-black on yellow) |
| text-primary | yellow-50 `#fcf7ea` | 16.58 | 4.5 | session-expired notice |
| text-secondary `#4b5563` | background | 7.12 | 4.5 | secondary text, chart axis labels |
| text-secondary | surface | 7.44 | 4.5 | captions, helper text |
| white | text-primary | 17.74 | 4.5 | chart tooltip |
| white | blue-600 `#476fb9` | 4.95 | 4.5 | primary button hover |
| white | coral-700 `#924640` | 6.62 | 4.5 | danger button (raised from coral-600 = 4.28 in Stage G) |
| coral-700 | background | 6.24 | 4.5 | error text (raised from coral-600 = 4.04 in Stage G) |
| coral-700 | coral-50 `#fdf1ef` | 5.99 | 4.5 | warning banners (was coral-600 = 3.88) |
| coral-700 | background | 6.24 | 4.5 | "over plan" flag |
| green-700 `#3b6f4a` | background | 5.56 | 4.5 | status announcements |
| blue-700 `#36558f` | background | 6.94 | 4.5 | Income metric label (raised from blue-500 = 3.60 in Stage G) |
| blue-500 `#5b86d6` | background | 3.40 | 3.0 (large: 24–28px bold) | Income metric value |
| green-600 `#4c8e60` | background | 3.70 | 3.0 (large) | Available metric value (raised from green-500 = 2.70 in Stage G) |
| coral-600 `#bd5e57` | background | 4.04 | 3.0 (large) | negative Available value (24–28px bold) |
| yellow-700 `#927427` | background | 4.17 | 3.0 (large: 19px bold) | insights hero comparison amount (sized 19px/700 in Stage G so the large-text threshold applies) |

## Non-text pairings — PASS

| Element | Ratio | Threshold |
|---|---:|---|
| focus ring blue-700 vs background | 6.94 | 3.0 |
| blue-500 chart marks vs surface | 3.55 | 3.0 |
| blue-700 donut (Savings) vs surface | 7.25 | 3.0 |
| state-panel error icon coral-600 vs background | 4.04 | 3.0 |

## Kit-inherited deviations — documented for design review (not silently changed)

| Pairing | Ratio | Threshold | Disposition |
|---|---:|---|---|
| white 16px/600 on blue-500 (primary buttons, selected current-month tab) | 3.60 | 4.5 | The kit's color scheme explicitly assigns blue-500 `#5B86D6` to primary actions with white text, and the approved compositions show it; the kit's own checklist says this pairing "must be checked against the implementation blue" — checked: it misses AA for normal text. Remedy available if design approves: blue-600 background (4.95). Left at the kit value pending design review. |
| yellow-700 14px "Planned" metric label on background | 4.17 | 4.5 | Kit semantic "yellow = planned"; yellow-700 is the darkest yellow token, so no in-palette value passes at 14px. Near-miss documented for design review (alternatives: text-primary label, or larger label). |
| yellow-500 chart marks vs surface | 1.76 | 3.0 | Kit-mandated previous-month color. Mandatory relief implemented: dashed line / diagonal bar pattern, 2px gaps, direct legend labels, visible text summaries, and visually-hidden data tables — series identity never depends on the fill. |
| green-500 / coral-500 donut segments vs surface | 2.82 / 2.98 | 3.0 | Kit category colors. Same relief as above (legend with explicit percentages, hidden table); adjacent-segment CVD separation validated (worst pair ΔE 11.4). |
| category icons (e.g. yellow-600 on yellow-100 tint = 2.24) | — | n/a | Icons are `aria-hidden` and purely decorative; the category name is adjacent text. |
| input error border coral-600 vs surface | ~2.6 | n/a | The border is supplemental; the error is conveyed by the associated error text (and `aria-describedby`), never color alone. |

## Notes

- `tokens.css` remains a byte-identical copy of the kit's
  `design-tokens.css` (D-FND-D1); every Stage G remedy above only changes
  which *existing* token a component consumes.
- Progress-bar fills use semantic colors but the value is always conveyed
  by `role="progressbar"` + `aria-valuenow` + visible amounts and the
  screen-reader sentence, never color alone (D-BUD-D3).
