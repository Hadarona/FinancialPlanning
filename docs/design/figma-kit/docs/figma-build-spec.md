# Figma Build Specification

## 1. File structure

### `00 — Cover`

- Project title: `Budgeting App`
- Subtitle: `Mobile + Desktop UI System`
- One mobile board preview and one desktop board preview
- Status tag: `Design foundation`

### `01 — Foundations`

Create sections for:

- Color primitives
- Semantic color variables
- Typography
- Spacing
- Radius
- Borders and effects
- Mobile and desktop layout grids
- Logo and icon rules
- Chart palette

### `02 — Components`

Build all components listed in `component-inventory.md`. Use Figma component properties and variants instead of detached copies.

### `03 — Mobile`

Create three frames:

- `Mobile / Login / Default`
- `Mobile / Budget / Default`
- `Mobile / Insights / July`

Frame size: `390 × 844`.

### `04 — Desktop`

Create three frames:

- `Desktop / Login / Default`
- `Desktop / Budget / Default`
- `Desktop / Insights / July`

Frame size: `1440 × 900`.

### `05 — Prototype`

Include:

- Login submission to Budget
- Budget navigation to Insights
- July/June tab switching
- Add-expense button interaction placeholder
- Input focus and validation examples
- Chart hover-tooltip examples on desktop

### `99 — Reference`

Place the approved reference boards and individual crops here. Lock the reference image layers.

## 2. Figma variables

Create the following collections:

### `Primitive`

- Color ramps
- Raw spacing values
- Raw radius values
- Typography families, sizes, weights, and line heights

### `Semantic`

- Background and surface
- Text
- Border
- Action
- Positive
- Comparison
- Category colors
- Focus and error

### `Responsive`

Modes:

- `Mobile`
- `Desktop`

Use responsive variables for page padding, content width, gutters, card padding, and section gaps.

## 3. Text styles

| Figma style | Font | Weight | Size / line height |
|---|---|---:|---:|
| `Display/Large` | DM Serif Display | 400 | 40 / 48 |
| `Display/Medium` | DM Serif Display | 400 | 32 / 40 |
| `Heading/Page` | DM Serif Display | 400 | 28 / 36 |
| `Heading/Section` | Inter | 600 | 20 / 28 |
| `Heading/Card` | Inter | 600 | 16 / 24 |
| `Body/Default` | Inter | 400 | 16 / 24 |
| `Body/Strong` | Inter | 600 | 16 / 24 |
| `Label/Default` | Inter | 500 | 14 / 20 |
| `Caption/Default` | Inter | 400 | 12 / 16 |
| `Number/Hero` | DM Serif Display | 400 | 40 / 48 |
| `Number/Summary` | DM Serif Display | 400 | 28 / 36 |

Use tabular figures for numeric data when available.

## 4. Auto Layout rules

- Every card, form, category row, tab, and chart legend must use Auto Layout.
- Do not use absolute positioning for ordinary content.
- Allow text labels to hug contents.
- Allow input fields, buttons, progress tracks, and cards to fill containers.
- Use min/max widths described in `responsive-layout.md`.
- Use an `8 px` spacing grid, with `4 px` only for fine icon and label adjustments.

## 5. Color behavior

- Blue is the primary action and current-month color.
- Green is positive and available-money color.
- Yellow is planning and previous-month comparison color.
- Coral is reserved for the Fun category and error-adjacent visual emphasis.
- Yellow surfaces use near-black text.
- Do not use color alone to distinguish chart series; include labels, legend markers, line style, or patterns.

## 6. Chart construction

Charts should be editable Figma vectors or built from componentized primitives, not flattened screenshots.

### Grouped bar chart

- Five category groups
- July: blue
- June: yellow
- Rounded bar top radius: `3 px`
- Horizontal grid lines: subtle border color
- Legend below chart

### Donut chart

- Five category segments
- Inner radius approximately `45%` of outer radius
- Segment labels appear in a separate legend
- Use values from `data/content.json`

### Cash-flow line chart

- July: solid blue line
- June: dashed yellow line
- Line width: `2 px`
- Circular point markers may appear on hover only
- Desktop includes hover tooltip; mobile uses tap target

## 7. Prototype notes

- Inputs receive a visible blue focus ring.
- Password visibility is toggled by the eye icon.
- The selected month tab changes the active chart dataset.
- Buttons should show hover, pressed, focus, disabled, and loading states.
- Motion duration: `160–220 ms`; use ease-out.

## 8. Delivery checks

- All screens use components, variables, and text styles.
- No detached component instances on final screens.
- Reference PNGs are stored only on the Reference page.
- Layer names use the naming conventions in `component-inventory.md`.
- Frames are constrained for responsive resizing.
- Contrast and keyboard behavior pass `accessibility-checklist.md`.

