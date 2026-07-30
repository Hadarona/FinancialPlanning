// Chart color assignment — kit tokens only (docs/design/figma-kit/tokens).
// Series semantics are fixed by the kit's color scheme: the current month is
// solid blue, the previous month is yellow (plus a dashed line / diagonal
// pattern so the series never differ by color alone).

export const SERIES_COLORS = {
  current: "var(--color-blue-500)",
  previous: "var(--color-yellow-500)",
};

const CATEGORY_COLOR_TOKENS = {
  blue: "var(--color-blue-500)",
  green: "var(--color-green-500)",
  yellow: "var(--color-yellow-500)",
  coral: "var(--color-coral-500)",
};

/**
 * Donut/legend color for a category. The kit assigns the "blue" semantic to
 * both Housing and Savings; inside a single donut two identical fills would
 * be indistinguishable (they meet where the ring wraps), so Savings uses the
 * kit's darker blue-700 step — same blue family, validated ΔE 17 from
 * blue-500. Recorded as a build deviation for design review.
 */
export function categoryChartColor(category) {
  if (category.id === "savings") {
    return "var(--color-blue-700)";
  }
  return CATEGORY_COLOR_TOKENS[category.color] ?? "var(--color-blue-500)";
}
