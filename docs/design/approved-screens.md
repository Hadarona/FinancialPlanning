# Approved Screen Map

The approved visual baseline consists of six screenshots plus the structured
Figma-like kit.

| Screen | Reference viewport | Approved composition | Kit crop |
| --- | ---: | --- | --- |
| Desktop Login | `1440 × 900` | `approved/desktop-login.jpg` | `figma-kit/references/desktop-login.png` |
| Desktop Budget | `1440 × 900` | `approved/desktop-budget.jpg` | `figma-kit/references/desktop-budget.png` |
| Desktop Insights | `1440 × 900` | `approved/desktop-insights.jpg` | `figma-kit/references/desktop-insights.png` |
| Mobile Login | `390 × 844` | `approved/mobile-login.jpg` | `figma-kit/references/mobile-login.png` |
| Mobile Budget | `390 × 844` | `approved/mobile-budget.jpg` | `figma-kit/references/mobile-budget.png` |
| Mobile Insights | `390 × 844` | `approved/mobile-insights.jpg` | `figma-kit/references/mobile-insights.png` |

The files in `approved/` include a presentation board, browser frame, or phone
frame. Do not implement those outer frames. Review the app content inside them.

Exact content comes from `figma-kit/data/content.json`. Exact visual tokens and
responsive values come from `figma-kit/tokens/` and `figma-kit/docs/`.

## Required review widths

- Normal sprint UI: `390` and `1440`.
- Any responsive or release review: `320`, `390`, `768`, `1024`, and `1440`.
- Accessibility sprint/release: also inspect 200% zoom, keyboard focus, and
  reduced motion.

Use deterministic demo data so chart shape and budget progress can be compared
meaningfully.
