# Figma Creation Prompt

Use this prompt when handing the package to a Figma designer or a Figma-capable agent.

---

Create an editable Figma design system and six high-fidelity screens for the budgeting app described in this package.

Build the following pages:

1. `00 — Cover`
2. `01 — Foundations`
3. `02 — Components`
4. `03 — Mobile`
5. `04 — Desktop`
6. `05 — Prototype`
7. `99 — Reference`

Use:

- `tokens/tokens-studio.json` or `tokens/design-tokens.json` for variables.
- `data/content.json` for all visible text, values, progress percentages, and chart data.
- `assets/logo.svg` for the logo.
- `docs/figma-build-spec.md` for page and style construction.
- `docs/component-inventory.md` for components and variants.
- `docs/responsive-layout.md` for frame sizes, grids, and responsive behavior.
- `docs/accessibility-checklist.md` for accessibility requirements.
- `docs/icon-map.md` for Lucide icon selection.
- `references/` only as visual guidance.

Required final screens:

- `Mobile / Login / Default` at `390 × 844`
- `Mobile / Budget / Default` at `390 × 844`
- `Mobile / Insights / July` at `390 × 844`
- `Desktop / Login / Default` at `1440 × 900`
- `Desktop / Budget / Default` at `1440 × 900`
- `Desktop / Insights / July` at `1440 × 900`

Requirements:

- Use Figma variables for colors, spacing, radius, and responsive values.
- Use named text styles for all typography.
- Use Auto Layout for all ordinary layout.
- Create reusable components and state variants.
- Keep July blue and June yellow.
- Keep positive values green and the Fun category coral.
- Use Inter for UI/body text and DM Serif Display for editorial headings and large financial numbers.
- Preserve the approved warm, soft, professional visual tone.
- Build charts as editable vectors/components using the structured data.
- Add prototype interactions for login, Budget-to-Insights navigation, month switching, input focus, password visibility, and button states.
- Do not flatten final UI into images.
- Put reference PNGs only on the locked Reference page.

When complete, verify:

- All copy and numbers match `data/content.json`.
- All colors match the token files.
- All six screens use component instances.
- No final components are detached.
- Desktop screens resize correctly down to `1024 px`.
- Mobile screens remain usable down to `320 px`.
- Keyboard focus, contrast, labels, chart legends, and hit targets meet the accessibility checklist.

---

## Acceptance criteria

- Six final screens exist at the required frame sizes.
- Foundations include colors, typography, spacing, radius, effects, grids, logo, icons, and chart palette.
- Components include every item from the inventory and required state variants.
- Mobile and desktop screens share the same component system.
- Structured chart values are internally coherent.
- Reference images are not used as final UI layers.
- The Prototype page demonstrates the primary flows and interactive states.

