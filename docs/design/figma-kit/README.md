# Budgeting App — Figma Source Kit

This package contains the source material needed to recreate the approved budgeting app in Figma as an editable, responsive design system.

The PNG files are visual references. The tokens, structured content, and specifications in this kit are authoritative when a generated reference contains small inconsistencies.

## Recommended Figma pages

1. `00 — Cover`
2. `01 — Foundations`
3. `02 — Components`
4. `03 — Mobile`
5. `04 — Desktop`
6. `05 — Prototype`
7. `99 — Reference`

## Package contents

| Path | Purpose |
|---|---|
| `docs/figma-build-spec.md` | Figma page structure, variables, styles, components, and build sequence |
| `docs/figma-creation-prompt.md` | Copy-ready instructions and acceptance criteria for a designer or Figma-capable agent |
| `docs/component-inventory.md` | Component anatomy, variants, states, and naming |
| `docs/responsive-layout.md` | Mobile and desktop frames, grids, spacing, and breakpoint behavior |
| `docs/accessibility-checklist.md` | Contrast, keyboard, focus, chart, and form requirements |
| `docs/icon-map.md` | Recommended Lucide icon names and sizing |
| `docs/color-scheme.md` | Human-readable palette reference |
| `tokens/design-tokens.json` | Framework-neutral design tokens |
| `tokens/tokens-studio.json` | Tokens Studio-compatible Figma token set |
| `tokens/design-tokens.css` | CSS custom properties for implementation |
| `data/content.json` | Exact screen copy, budget values, and coherent chart data |
| `assets/logo.svg` | Editable vector logo |
| `references/` | Approved boards and individual screen crops |

## Fonts

- **UI and body:** Inter
- **Editorial headings and large financial numbers:** DM Serif Display

Both fonts are available through Google Fonts and should be installed or enabled before building the Figma file.

## Build order

1. Import the token set or create Figma variables manually.
2. Create color, text, effect, and grid styles.
3. Import `assets/logo.svg`.
4. Build primitives and components with Auto Layout.
5. Build mobile frames at `390 × 844`.
6. Build desktop frames at `1440 × 900`.
7. Add component interactions and prototype links.
8. Run the accessibility and consistency checklist.

## Source-of-truth order

When sources conflict, use this priority:

1. `data/content.json`
2. Files in `tokens/`
3. Specifications in `docs/`
4. Images in `references/`
