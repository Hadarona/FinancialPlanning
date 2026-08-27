// QA-SU-01..15: independent unit coverage of server/src/services/calc.js.
// Pure calculations, no I/O. Every expected value here is computed directly
// from the roadmap §2.2 formulas, never copied from calc.js's own output.
import { describe, it, expect } from "vitest";
import {
  previousMonth,
  daysInMonth,
  monthRange,
  monthName,
  shortDateLabel,
  cashFlowSampleDates,
  cumulativeAtDates,
  summarizeBudget,
  largestRemainderShares,
} from "../../../src/services/calc.js";
import { DEFAULT_CATEGORIES } from "../../../src/domain/categories.js";
import {
  KIT_INCOME_MINOR,
  KIT_PLANNED_MINOR,
  KIT_AVAILABLE_MINOR,
} from "../helpers/qaFixtures.js";

function kitBudgetRow(overrides = {}) {
  return {
    id: "budget-1",
    month: "2026-07",
    currencyCode: "USD",
    incomeMinor: KIT_INCOME_MINOR,
    categories: DEFAULT_CATEGORIES,
    ...overrides,
  };
}

describe("QA-SU: calc.js — summarizeBudget", () => {
  it("QA-SU-01: kit row with empty actuals recomputes planned/available/actual", () => {
    const result = summarizeBudget(kitBudgetRow(), {});
    expect(result.plannedMinor).toBe(KIT_PLANNED_MINOR);
    expect(result.plannedMinor).toBe(1020000);
    expect(result.availableMinor).toBe(KIT_AVAILABLE_MINOR);
    expect(result.availableMinor).toBe(230000);
    expect(result.actualMinor).toBe(0);
  });

  it("QA-SU-02: over-allocated income preserves a negative availableMinor", () => {
    const result = summarizeBudget(kitBudgetRow({ incomeMinor: 100000 }), {});
    expect(result.plannedMinor).toBe(1020000);
    expect(result.availableMinor).toBe(-920000);
  });

  it("QA-SU-03: progress is actual/planned, never planned/income", () => {
    const row = kitBudgetRow({ incomeMinor: 1250000 });
    const result = summarizeBudget(row, { housing: 252000 });
    const housing = result.categories.find((category) => category.id === "housing");
    expect(housing.plannedMinor).toBe(400000);
    expect(housing.progressPercent).toBe(63);
    const plannedOverIncome = Math.round((400000 / 1250000) * 100);
    expect(plannedOverIncome).toBe(32);
    expect(housing.progressPercent).not.toBe(plannedOverIncome);
  });

  it("QA-SU-04: overspend is preserved above 100, not capped or hidden", () => {
    const result = summarizeBudget(kitBudgetRow(), { housing: 420000 });
    const housing = result.categories.find((category) => category.id === "housing");
    expect(housing.progressPercent).toBe(105);
    expect(housing.state).toBe("overspent");
  });

  it("QA-SU-05: zero planned with spending never divides by zero (no NaN/Infinity)", () => {
    const result = summarizeBudget(
      kitBudgetRow({ categories: [{ ...DEFAULT_CATEGORIES[3], plannedMinor: 0 }] }),
      {
        fun: 5000,
      },
    );
    const fun = result.categories.find((category) => category.id === "fun");
    expect(fun.progressPercent).toBeNull();
    expect(fun.state).toBe("unplanned");
    const roundTripped = JSON.parse(JSON.stringify(result));
    function assertNoNanOrInfinity(value) {
      if (typeof value === "number") {
        expect(Number.isNaN(value)).toBe(false);
        expect(Number.isFinite(value)).toBe(true);
      } else if (value && typeof value === "object") {
        for (const nested of Object.values(value)) {
          assertNoNanOrInfinity(nested);
        }
      }
    }
    assertNoNanOrInfinity(roundTripped);
  });

  it("QA-SU-06: zero planned with zero spending is normal, not flagged", () => {
    const result = summarizeBudget(
      kitBudgetRow({ categories: [{ ...DEFAULT_CATEGORIES[3], plannedMinor: 0 }] }),
      { fun: 0 },
    );
    const fun = result.categories.find((category) => category.id === "fun");
    expect(fun.progressPercent).toBeNull();
    expect(fun.state).toBe("normal");
  });

  it("QA-SU-07: categories are always output sorted ascending by displayOrder", () => {
    const reversed = [...DEFAULT_CATEGORIES].sort(
      (a, b) => b.displayOrder - a.displayOrder,
    );
    expect(reversed[0].displayOrder).toBeGreaterThan(
      reversed[reversed.length - 1].displayOrder,
    );
    const result = summarizeBudget(kitBudgetRow({ categories: reversed }), {});
    const orders = result.categories.map((category) => category.displayOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(orders).toEqual([1, 2, 3, 4, 5]);
  });

  it("QA-SU-08: actuals map with extra/missing keys — missing defaults to 0, aggregate ignores extras", () => {
    const actuals = { housing: 1000, groceries: 500, unknownCategory: 999999 };
    const result = summarizeBudget(kitBudgetRow(), actuals);
    const transport = result.categories.find((category) => category.id === "transport");
    expect(transport.actualMinor).toBe(0);
    expect(result.actualMinor).toBe(1000 + 500);
  });

  it("QA-SU-09: many small additions aggregate without float drift", () => {
    let sum = 0;
    for (let i = 0; i < 1000; i += 1) {
      sum += 3;
    }
    for (let i = 0; i < 3; i += 1) {
      sum += 3333;
    }
    expect(sum).toBe(12999);
    const result = summarizeBudget(kitBudgetRow(), { housing: sum });
    const housing = result.categories.find((category) => category.id === "housing");
    expect(housing.actualMinor).toBe(12999);
    expect(Number.isInteger(housing.actualMinor)).toBe(true);
    expect(Number.isInteger(result.actualMinor)).toBe(true);
    expect(Number.isInteger(result.plannedMinor)).toBe(true);
    expect(Number.isInteger(result.availableMinor)).toBe(true);
  });
});

describe("QA-SU-10: largestRemainderShares", () => {
  it("sums to exactly 100 for realistic seeded values", () => {
    const shares = largestRemainderShares([395700, 182100, 120000, 80000, 64200]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares.every((value) => Number.isInteger(value))).toBe(true);
  });

  it("breaks ties deterministically (lower index wins) and still sums to 100", () => {
    const shares = largestRemainderShares([1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    // 1/3 of 100 = 33.33... each; three equal remainders (.33) tie-broken by
    // index, so index 0 gets the first extra point.
    expect(shares).toEqual([34, 33, 33]);
  });

  it("returns all-zero shares for all-zero input", () => {
    const shares = largestRemainderShares([0, 0, 0]);
    expect(shares).toEqual([0, 0, 0]);
  });

  it("a single value takes the whole 100%", () => {
    expect(largestRemainderShares([7])).toEqual([100]);
  });
});

describe("QA-SU-11: previousMonth", () => {
  it("rolls January back to December of the previous year", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("steps back one month within a year", () => {
    expect(previousMonth("2026-07")).toBe("2026-06");
  });

  it("throws on an invalid month", () => {
    expect(() => previousMonth("2026-13")).toThrow();
  });
});

describe("QA-SU-12: daysInMonth / monthRange leap and century boundaries", () => {
  it.each([
    ["2026-02", 28],
    ["2028-02", 29],
    ["2000-02", 29],
    ["2100-02", 28],
    ["2026-04", 30],
    ["2026-07", 31],
  ])("daysInMonth(%s) === %i", (month, expected) => {
    expect(daysInMonth(month)).toBe(expected);
  });

  it.each([
    ["2026-02", "2026-02-01", "2026-02-28"],
    ["2028-02", "2028-02-01", "2028-02-29"],
    ["2000-02", "2000-02-01", "2000-02-29"],
    ["2100-02", "2100-02-01", "2100-02-28"],
  ])("monthRange(%s) === {%s, %s}", (month, firstDay, lastDay) => {
    expect(monthRange(month)).toEqual({ firstDay, lastDay });
  });
});

describe("QA-SU-13: cashFlowSampleDates", () => {
  it("returns 7 dates with the documented sample grid, leap-aware last day", () => {
    const leapDates = cashFlowSampleDates("2028-02");
    expect(leapDates).toHaveLength(7);
    expect(leapDates[leapDates.length - 1]).toBe("2028-02-29");
    expect(leapDates).toEqual([
      "2028-02-01",
      "2028-02-06",
      "2028-02-11",
      "2028-02-16",
      "2028-02-21",
      "2028-02-26",
      "2028-02-29",
    ]);
  });

  it("uses the calendar last day for a 31-day month", () => {
    const dates = cashFlowSampleDates("2026-07");
    expect(dates).toHaveLength(7);
    expect(dates[dates.length - 1]).toBe("2026-07-31");
    expect(dates).toContain("2026-07-01");
    expect(dates).toContain("2026-07-06");
    expect(dates).toContain("2026-07-11");
    expect(dates).toContain("2026-07-16");
    expect(dates).toContain("2026-07-21");
    expect(dates).toContain("2026-07-26");
  });
});

describe("QA-SU-14: cumulativeAtDates", () => {
  it("is monotonic non-decreasing and its final value equals the total sum", () => {
    const sampleDates = ["2026-07-01", "2026-07-06", "2026-07-11"];
    const sumsByDate = { "2026-07-11": 100, "2026-07-01": 50, "2026-07-08": 25 };
    const result = cumulativeAtDates(sampleDates, sumsByDate);
    // Cumulative-at-date includes every entry whose date is <= the sample
    // date: 07-08's 25 only enters at the 07-11 sample, not 07-06.
    expect(result).toEqual([50, 50, 175]);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
    }
    const total = Object.values(sumsByDate).reduce((a, b) => a + b, 0);
    expect(result[result.length - 1]).toBe(total);
  });

  it("returns all zeros for an empty sums map", () => {
    const sampleDates = ["2026-07-01", "2026-07-06"];
    expect(cumulativeAtDates(sampleDates, {})).toEqual([0, 0]);
  });
});

describe("QA-SU-15: shortDateLabel / monthName", () => {
  it("formats a valid date and month", () => {
    expect(shortDateLabel("2026-07-16")).toBe("Jul 16");
    expect(monthName("2026-07")).toBe("July");
  });

  it("throws on invalid inputs", () => {
    expect(() => shortDateLabel("2026/07/16")).toThrow();
    expect(() => monthName("2026-13")).toThrow();
  });
});
