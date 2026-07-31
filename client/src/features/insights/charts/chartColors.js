// Chart color assignment — kit tokens only (docs/design/figma-kit/tokens).
// CR-001 item 3: insights compare 1–3 selected months. Series slots are
// ordered newest-first and every slot pairs a kit color with a non-color
// cue (solid/dashed/dotted lines; plain/diagonal/dotted bar patterns) so
// series never differ by color alone.

/** Ordered series colors: slot 0 = newest selected month. */
export const SERIES_COLORS = [
  "var(--color-blue-500)",
  "var(--color-yellow-500)",
  "var(--color-green-500)",
];

/** Darker same-ramp partners used inside the slot's pattern strokes. */
export const SERIES_PATTERN_STROKES = [
  "var(--color-blue-700)",
  "var(--color-yellow-700)",
  "var(--color-green-700)",
];

/** Non-color series cues, index-aligned with SERIES_COLORS. */
export const SERIES_LINE_DASHES = [undefined, "6 4", "2 5"];
export const SERIES_BAR_PATTERNS = ["plain", "diagonal", "dotted"];
export const SERIES_LEGEND_LINE_MARKERS = ["line", "dashed-line", "dotted-line"];

const CATEGORY_COLOR_TOKENS = {
  blue: "var(--color-blue-500)",
  green: "var(--color-green-500)",
  yellow: "var(--color-yellow-500)",
  coral: "var(--color-coral-500)",
};

/**
 * Donut/legend color for a category. The kit assigns the same semantic hue
 * to several categories; inside a single donut two identical fills would be
 * indistinguishable, so the second category of each hue family uses the
 * kit's darker 700 step (savings blue-700 vs housing blue-500 — the
 * delivery-1 precedent — extended by CR-001 to subscriptions coral-700 vs
 * fun coral-500 and utilities green-700 vs groceries green-500). No two
 * donut segments share a fill.
 */
export function categoryChartColor(category) {
  if (category.id === "savings") {
    return "var(--color-blue-700)";
  }
  if (category.id === "subscriptions") {
    return "var(--color-coral-700)";
  }
  if (category.id === "utilities") {
    return "var(--color-green-700)";
  }
  return CATEGORY_COLOR_TOKENS[category.color] ?? "var(--color-blue-500)";
}
