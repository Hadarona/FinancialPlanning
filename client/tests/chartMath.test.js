import { describe, it, expect } from "vitest";
import {
  axisScale,
  compactAxisLabel,
  donutSegments,
  linePoints,
  barTopRoundedPath,
} from "../src/features/insights/charts/chartMath.js";

describe("axisScale", () => {
  it("picks the kit axis for the kit bar maximum: 4,600 major -> 0..5K in 1K steps", () => {
    // June housing 430,000 minor is the largest bar value in the kit data.
    const scale = axisScale(430000);
    expect(scale.max).toBe(500000);
    expect(scale.step).toBe(100000);
    expect(scale.ticks).toEqual([0, 100000, 200000, 300000, 400000, 500000]);
  });

  it("covers the cash-flow maximum 9,180 with a nice bound", () => {
    const scale = axisScale(918000);
    expect(scale.max).toBeGreaterThanOrEqual(918000);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.ticks.at(-1)).toBe(scale.max);
    expect(scale.ticks.length).toBeLessThanOrEqual(6);
  });

  it("falls back to a stable non-zero axis for all-zero data (no 0/0 scale)", () => {
    const scale = axisScale(0);
    expect(scale.max).toBeGreaterThan(0);
    expect(scale.ticks.at(-1)).toBe(scale.max);
  });
});

describe("compactAxisLabel", () => {
  it("renders whole thousands of major units as K labels", () => {
    expect(compactAxisLabel(500000)).toBe("5K");
    expect(compactAxisLabel(450000)).toBe("4.5K");
    expect(compactAxisLabel(100000)).toBe("1K");
  });

  it("renders sub-thousand values as grouped major units", () => {
    expect(compactAxisLabel(0)).toBe("0");
    expect(compactAxisLabel(50000)).toBe("500");
  });
});

describe("donutSegments", () => {
  it("maps kit category actuals to fractions summing to 1, in order", () => {
    const segments = donutSegments([395700, 151600, 84200, 92600, 117900]);
    expect(segments).toHaveLength(5);
    const totalFraction = segments.reduce((sum, segment) => sum + segment.fraction, 0);
    expect(totalFraction).toBeCloseTo(1, 10);
    // Cumulative starts line up with the preceding fractions.
    expect(segments[0].start).toBe(0);
    expect(segments[1].start).toBeCloseTo(segments[0].fraction, 10);
    expect(segments[4].start + segments[4].fraction).toBeCloseTo(1, 10);
  });

  it("skips zero categories but keeps their original index", () => {
    const segments = donutSegments([100, 0, 300]);
    expect(segments.map((segment) => segment.index)).toEqual([0, 2]);
  });

  it("returns no segments for all-zero data", () => {
    expect(donutSegments([0, 0, 0])).toEqual([]);
  });
});

describe("linePoints", () => {
  it("spaces points evenly and maps values to the top-down y axis", () => {
    const points = linePoints([0, 50, 100], { max: 100, width: 200, height: 100 });
    expect(points).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ]);
  });

  it("never divides by zero when max is 0 (flat zero series)", () => {
    const points = linePoints([0, 0], { max: 0, width: 200, height: 100 });
    expect(points.every((point) => Number.isFinite(point.y))).toBe(true);
    expect(points[0].y).toBe(100);
  });
});

describe("barTopRoundedPath", () => {
  it("returns an empty path for a zero-height bar (no phantom mark)", () => {
    expect(barTopRoundedPath(10, 50, 20, 0)).toBe("");
  });

  it("anchors the bar to the baseline and clamps the radius", () => {
    const path = barTopRoundedPath(10, 90, 20, 2, 4);
    // Radius is clamped to the 2px height; the path closes on the baseline y=92.
    expect(path.startsWith("M10,92")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });
});
