# Component Inventory

## Naming convention

Use:

```text
Category / Component / Variant
```

Examples:

```text
Button / Primary / Default
Input / Password / Focus
Chart / Bar / Monthly comparison
```

## Core components

### `Brand / Logo`

- Editable vector instance from `assets/logo.svg`
- Sizes: `32`, `48`, `80`, `120`
- Clear space: at least `25%` of logo width

### `Button / Primary`

Anatomy:

- Optional leading icon
- Label
- Optional loading indicator

Variants:

- Default
- Hover
- Pressed
- Focus
- Disabled
- Loading

Sizes:

- Mobile and desktop default height: `48 px`
- Large call-to-action height: `56 px`

### `Button / Text`

Used for `Create account`.

Variants:

- Default
- Hover
- Focus
- Disabled

### `Input / Text`

Anatomy:

- External label
- Leading icon
- Input value or placeholder
- Optional trailing action
- Helper or error message

Variants:

- Empty
- Hover
- Focus
- Filled
- Error
- Disabled

### `Input / Password`

Extends text input with:

- Lock icon
- Visibility toggle

### `Tabs / Month`

Options:

- July
- June

Properties:

- Selected month
- Keyboard focus
- Disabled

Selected July uses blue. Selected June uses yellow with near-black text.

### `Card / Summary metric`

Properties:

- Label
- Value
- Semantic color
- Optional divider

Instances:

- Income
- Planned
- Available

### `Budget / Category row`

Anatomy:

- Tinted circular icon container
- Category label
- Amount
- Progress track
- Progress fill

Properties:

- Category
- Amount
- Progress percentage
- Semantic color
- Hover state for desktop

### `Progress / Linear`

Properties:

- Value from `0–100`
- Semantic color
- Size: small/default

Track height:

- Default: `8 px`
- Small: `6 px`

### `Chart / Bar / Monthly comparison`

Properties:

- Dataset
- Selected month
- Tooltip visibility
- Compact/default layout

### `Chart / Donut / Category`

Properties:

- Dataset
- Legend position: right/bottom
- Selected category

### `Chart / Line / Cash flow`

Properties:

- Dataset
- Tooltip visibility
- Compact/default layout

### `Legend / Item`

Anatomy:

- Color or line marker
- Label
- Optional percentage

### `Icon button`

Instances:

- Back
- More menu
- Password visibility
- Add

Minimum interactive target: `44 × 44 px`.

## Screen compositions

### Login

- Brand logo
- Display heading
- Email input
- Password input
- Primary button
- Text button

### Budget

- Page heading
- More menu
- Three summary metrics
- Five category rows
- Add-expense button

### Insights

- Page heading
- More menu
- Month tabs
- Hero value and comparison
- Bar chart
- Donut chart
- Cash-flow line chart

