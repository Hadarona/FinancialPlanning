# Responsive Layout Specification

## Breakpoints

| Name | Width |
|---|---:|
| Mobile | `320–767 px` |
| Tablet | `768–1023 px` |
| Desktop | `1024–1439 px` |
| Wide desktop | `1440 px+` |

## Mobile foundation

- Reference frame: `390 × 844`
- Page padding: `20 px`
- Four-column grid
- Column gutter: `12 px`
- Card padding: `16 px`
- Section gap: `24 px`
- Content maximum: frame width minus page padding

## Desktop foundation

- Reference frame: `1440 × 900`
- Page padding: `64 px`
- Twelve-column grid
- Column gutter: `24 px`
- Content maximum width: `1200 px`
- Card padding: `24 px`
- Section gap: `32 px`

## Login

### Mobile

- Form width fills available content.
- Logo, heading, and form are vertically centered where device height permits.
- Maximum form width: `350 px`.

### Desktop

- Center a single login card within the viewport.
- Card width: `440 px`.
- Card padding: `40 px`.
- Maintain generous surrounding whitespace.

## Budget

### Mobile

- Single-column content.
- Summary metrics appear in one three-cell row.
- Category rows stack vertically.
- Add-expense button fills content width.

### Desktop

- Center content at a maximum width of `960 px`.
- Summary metrics remain in a single row.
- Category list uses the full content width.
- Increase row horizontal padding, but keep the same information order.
- Add-expense button aligns to the content width.

## Insights

### Mobile

- Month tabs fill content width.
- Hero total is centered.
- Bar chart uses full width.
- Donut and cash-flow charts form a two-column row only when each remains at least `150 px`; otherwise stack.

### Desktop

- Center content at a maximum width of `1200 px`.
- Top row: month tabs and hero summary.
- Main grid:
  - Bar chart: `8` columns.
  - Donut chart: `4` columns.
  - Cash-flow chart: `12` columns below, or `6` columns beside the donut when space permits.
- Minimum chart-card height: `280 px`.

## Constraint behavior

- Page containers: center horizontally.
- Cards: fill container.
- Text: hug content.
- Buttons: fill on mobile; fill defined container or hug content on desktop.
- Charts: scale while preserving labels and a minimum usable plot area.
- Do not scale fonts continuously with frame width.

