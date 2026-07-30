# Budgeting App Color Scheme

## Core palette

| Token | Color | Hex | Primary use |
|---|---|---:|---|
| `primary-blue` | Muted medium blue | `#5B86D6` | Primary actions, links, income, housing, savings, and current-month data |
| `positive-green` | Muted natural green | `#5FA873` | Available money, groceries, positive values, and supporting chart segments |
| `comparison-yellow` | Soft golden yellow | `#E2BE62` | Planned spending, transport, and previous-month comparisons |
| `accent-coral` | Soft coral | `#D97972` | Fun and entertainment category accents |
| `text-primary` | Near-black navy | `#111827` | Headings, body text, icons, and strong outlines |
| `background` | Warm off-white | `#FAF8F4` | Application and presentation backgrounds |
| `border-subtle` | Light warm gray | `#E5E5E2` | Borders, dividers, inactive controls, and progress tracks |

## Light UI tints

Use these for icon circles, selected-card backgrounds, and other low-emphasis surfaces.

| Token | Hex |
|---|---:|
| `blue-tint` | `#E7EEF9` |
| `green-tint` | `#E6F1E9` |
| `yellow-tint` | `#F8EFD7` |
| `coral-tint` | `#F8E6E3` |

## Semantic mapping

- **Blue:** primary actions and the current month, July.
- **Green:** positive and available values.
- **Yellow:** planned values and the previous month, June.
- **Coral:** the Fun category.
- **Near-black:** typography and structural outlines.
- **Warm off-white:** main surfaces.

## CSS variables

```css
:root {
  --color-primary-blue: #5B86D6;
  --color-positive-green: #5FA873;
  --color-comparison-yellow: #E2BE62;
  --color-accent-coral: #D97972;

  --color-text-primary: #111827;
  --color-background: #FAF8F4;
  --color-border-subtle: #E5E5E2;

  --color-blue-tint: #E7EEF9;
  --color-green-tint: #E6F1E9;
  --color-yellow-tint: #F8EFD7;
  --color-coral-tint: #F8E6E3;
}
```

> The generated mockups may contain slight pixel-level color variation. These values are the intended implementation palette.
