# Design-review contrast recheck — Iteration 2

Independently recomputed (WCAG 2.1 relative luminance) by the design
reviewer from the token hexes in `docs/design/figma-kit/tokens/design-tokens.css`
and the computed colors measured in the running app
(`evidence/capture-summary.json`). Matches the developer's
`iteration-02/developer/evidence/contrast.md` row for row.

| Pairing | Measured in app | Ratio | Threshold | Verdict |
|---|---|---:|---|---|
| white on blue-600 #476FB9 (primary buttons, selected July tab, 16px/600) | rgb(71,111,185) | 4.95 | 4.5 | PASS (D-DES-014) |
| white on blue-700 #36558F (primary hover) | rgb(54,85,143) | 7.36 | 4.5 | PASS |
| blue-600 on background #FAF8F4 (TextButton 14px) | rgb(71,111,185) | 4.67 | 4.5 | PASS (D-DES-014 extension, confirmed) |
| blue-600 on surface #FFFDF9 (TextButton on cards) | — | 4.87 | 4.5 | PASS |
| text-primary #111827 on background (Planned label 14px) | rgb(17,24,39) | 16.72 | 4.5 | PASS (D-DES-015) |
| (old) white on blue-500 #5B86D6 | no longer used for text | 3.60 | 4.5 | resolved |

Decorative elements: yellow-500 Planned marker dot is `aria-hidden="true"`
(measured), the word "Planned" carries the meaning — no non-text contrast
requirement applies. Category-row hover blue-50 conveys no information by
color alone.

`tokens.css` verified byte-identical to the kit file at review time
(`diff` empty).
