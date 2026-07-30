// Pure chart geometry/scale helpers for the hand-rolled SVG charts.
// No DOM, no React — unit-tested in isolation (developer-owned chart math).
// All money values are integer minor units, consistent with lib/money.js.

const STEP_MULTIPLIERS = [1, 2, 5];

/**
 * Picks a "nice" y-axis scale for a maximum data value (integer minor
 * units): the smallest step from {1,2,5}×10^n that covers the value in at
 * most `maxTickCount - 1` segments. Returns `{ max, step, ticks }` with
 * ticks ascending from 0 to max inclusive. A non-positive input falls back
 * to a 100.00 axis so an empty chart still has a stable, honest scale.
 */
export function axisScale(maxValue, maxTickCount = 6) {
  const target = Math.max(1, Math.ceil(maxValue));
  const segments = Math.max(1, maxTickCount - 1);
  let magnitude = 1;
  for (;;) {
    for (const multiplier of STEP_MULTIPLIERS) {
      const step = multiplier * magnitude;
      if (Math.ceil(target / step) <= segments) {
        const max = step * Math.ceil(target / step);
        const ticks = [];
        for (let value = 0; value <= max; value += step) {
          ticks.push(value);
        }
        return maxValue > 0 ? { max, step, ticks } : axisScale(10000, maxTickCount); // 100.00 fallback for all-zero data
      }
    }
    magnitude *= 10;
  }
}

/**
 * Compact tick label for integer minor units: whole thousands of major
 * units render as "5K"/"4.5K", anything else as plain grouped units
 * ("500", "1,234"). Mirrors the kit's insights axis style.
 */
export function compactAxisLabel(minor) {
  const major = minor / 100;
  if (major >= 1000 && major % 100 === 0) {
    const thousands = major / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return major.toLocaleString("en-US");
}

/**
 * Donut segment geometry from raw values: skips zero values and returns
 * `[{ index, start, fraction }]` where `start` is the cumulative fraction
 * (0..1) at which the segment begins, in input order. An all-zero input
 * returns no segments (the component renders an empty track instead).
 */
export function donutSegments(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return [];
  }
  const segments = [];
  let start = 0;
  values.forEach((value, index) => {
    if (value > 0) {
      const fraction = value / total;
      segments.push({ index, start, fraction });
      start += fraction;
    }
  });
  return segments;
}

/**
 * Maps a series to evenly-spaced line-chart points inside a plot area:
 * `[{ x, y }]` with x from 0 to `width` and y measured from the top
 * (`height` = zero line, 0 = axis max). A single point centers on x.
 */
export function linePoints(values, { max, width, height }) {
  const safeMax = max > 0 ? max : 1;
  return values.map((value, index) => ({
    x: values.length > 1 ? (index / (values.length - 1)) * width : width / 2,
    y: height - (Math.min(value, safeMax) / safeMax) * height,
  }));
}

/** SVG path for a vertical bar with only its top corners rounded (rounded
 * data-end anchored to the baseline). Radius is clamped to the bar size. */
export function barTopRoundedPath(x, yTop, width, height, radius = 4) {
  if (height <= 0) {
    return "";
  }
  const r = Math.min(radius, height, width / 2);
  const yBottom = yTop + height;
  return [
    `M${x},${yBottom}`,
    `V${yTop + r}`,
    `Q${x},${yTop} ${x + r},${yTop}`,
    `H${x + width - r}`,
    `Q${x + width},${yTop} ${x + width},${yTop + r}`,
    `V${yBottom}`,
    "Z",
  ].join(" ");
}
