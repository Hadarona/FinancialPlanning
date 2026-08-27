import { describe, it, expect } from "vitest";
import {
  previousMonth,
  daysInMonth,
  monthRange,
  summarizeBudget,
  monthReadModel,
  budgetPlanModel,
  largestRemainderShares,
  monthName,
  shortDateLabel,
  cashFlowSampleDates,
  cumulativeAtDates,
} from "../../src/services/calc.js";

describe("previousMonth", () => {
  it("rolls back within the same year", () => {
    expect(previousMonth("2026-07")).toBe("2026-06");
  });

  it("rolls back across a year boundary (January -> previous December)", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("rejects a malformed month", () => {
    expect(() => previousMonth("2026-13")).toThrow();
  });
});

describe("daysInMonth / monthRange", () => {
  it("knows standard month lengths", () => {
    expect(daysInMonth("2026-07")).toBe(31);
    expect(daysInMonth("2026-06")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
  });

  it("handles leap years (divisible by 4, century rule)", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2000-02")).toBe(29);
    expect(daysInMonth("2100-02")).toBe(28);
  });

  it("returns string date bounds for month membership comparison", () => {
    expect(monthRange("2026-07")).toEqual({
      firstDay: "2026-07-01",
      lastDay: "2026-07-31",
    });
    expect(monthRange("2026-02")).toEqual({
      firstDay: "2026-02-01",
      lastDay: "2026-02-28",
    });
  });

  it("rejects a malformed month", () => {
    expect(() => monthRange("2026-00")).toThrow();
  });
});

// Kit fixture extended per CR-001 (seven fixed categories, minor units):
// income 12,500; plans 4,000/1,500/800/900/3,000/600/1,200 (=12,000);
// available 500. The single budget row carries no month (CR1-2).
function kitBudgetRow() {
  return {
    id: "budget-1",
    currencyCode: "USD",
    incomeMinor: 1250000,
    categories: [
      {
        id: "housing",
        name: "Housing",
        icon: "House",
        color: "blue",
        displayOrder: 1,
        plannedMinor: 400000,
      },
      {
        id: "groceries",
        name: "Groceries",
        icon: "ShoppingCart",
        color: "green",
        displayOrder: 2,
        plannedMinor: 150000,
      },
      {
        id: "transport",
        name: "Transport",
        icon: "CarFront",
        color: "yellow",
        displayOrder: 3,
        plannedMinor: 80000,
      },
      {
        id: "fun",
        name: "Fun",
        icon: "PartyPopper",
        color: "coral",
        displayOrder: 4,
        plannedMinor: 90000,
      },
      {
        id: "savings",
        name: "Savings",
        icon: "PiggyBank",
        color: "blue",
        displayOrder: 5,
        plannedMinor: 300000,
      },
      {
        id: "subscriptions",
        name: "Subscriptions",
        icon: "Repeat",
        color: "coral",
        displayOrder: 6,
        plannedMinor: 60000,
      },
      {
        id: "utilities",
        name: "Utilities",
        icon: "Plug",
        color: "green",
        displayOrder: 7,
        plannedMinor: 120000,
      },
    ],
  };
}

describe("summarizeBudget", () => {
  it("computes CR-001 totals: planned 12,000 and available 500 from income 12,500", () => {
    const summary = summarizeBudget(kitBudgetRow(), { housing: 252000 });
    expect(summary.incomeMinor).toBe(1250000);
    expect(summary.plannedMinor).toBe(1200000);
    expect(summary.availableMinor).toBe(50000);
    expect(summary.actualMinor).toBe(252000);
  });

  it("carries no month field: the single budget applies to every month (CR1-2)", () => {
    const summary = summarizeBudget(kitBudgetRow(), {});
    expect(summary).not.toHaveProperty("month");
  });

  it("computes progress as actual/planned (housing 2,520 of 4,000 -> 63%)", () => {
    const summary = summarizeBudget(kitBudgetRow(), { housing: 252000 });
    const housing = summary.categories.find((category) => category.id === "housing");
    expect(housing.actualMinor).toBe(252000);
    expect(housing.progressPercent).toBe(63);
    expect(housing.state).toBe("normal");
  });

  it("handles an empty month: zero actuals, zero progress, all normal", () => {
    const summary = summarizeBudget(kitBudgetRow(), {});
    expect(summary.actualMinor).toBe(0);
    for (const category of summary.categories) {
      expect(category.actualMinor).toBe(0);
      expect(category.progressPercent).toBe(0);
      expect(category.state).toBe("normal");
    }
  });

  it("preserves >100% progress and flags the category overspent", () => {
    const summary = summarizeBudget(kitBudgetRow(), { transport: 92000 });
    const transport = summary.categories.find((category) => category.id === "transport");
    expect(transport.progressPercent).toBe(115);
    expect(transport.state).toBe("overspent");
  });

  it("never divides by zero: zero-plan spending is 'unplanned' with null progress", () => {
    const row = kitBudgetRow();
    row.categories = row.categories.map((category) =>
      category.id === "fun" ? { ...category, plannedMinor: 0 } : category,
    );
    const summary = summarizeBudget(row, { fun: 5000 });
    const fun = summary.categories.find((category) => category.id === "fun");
    expect(fun.progressPercent).toBeNull();
    expect(fun.state).toBe("unplanned");
    expect(Number.isFinite(summary.plannedMinor)).toBe(true);
  });

  it("keeps a zero-plan category with no spending 'normal' with null progress", () => {
    const row = kitBudgetRow();
    row.categories = row.categories.map((category) =>
      category.id === "fun" ? { ...category, plannedMinor: 0 } : category,
    );
    const summary = summarizeBudget(row, {});
    const fun = summary.categories.find((category) => category.id === "fun");
    expect(fun.progressPercent).toBeNull();
    expect(fun.state).toBe("normal");
  });

  it("allows over-allocation: available may be negative (decision #2)", () => {
    const row = kitBudgetRow();
    row.incomeMinor = 900000;
    const summary = summarizeBudget(row, {});
    expect(summary.availableMinor).toBe(-300000);
  });

  it("orders categories by displayOrder regardless of stored order", () => {
    const row = kitBudgetRow();
    row.categories = [...row.categories].reverse();
    const summary = summarizeBudget(row, {});
    expect(summary.categories.map((category) => category.id)).toEqual([
      "housing",
      "groceries",
      "transport",
      "fun",
      "savings",
      "subscriptions",
      "utilities",
    ]);
  });
});

describe("monthReadModel", () => {
  it("adds the requested month to the summarized plans + actuals (CR1-3)", () => {
    const model = monthReadModel(kitBudgetRow(), "2026-07", { utilities: 72100 });
    expect(model.month).toBe("2026-07");
    expect(model.plannedMinor).toBe(1200000);
    expect(model.actualMinor).toBe(72100);
    const utilities = model.categories.find((category) => category.id === "utilities");
    expect(utilities.actualMinor).toBe(72100);
    expect(utilities.progressPercent).toBe(60);
  });

  it("returns identical plans with different actuals for two months", () => {
    const july = monthReadModel(kitBudgetRow(), "2026-07", { housing: 100000 });
    const may = monthReadModel(kitBudgetRow(), "2026-05", {});
    expect(july.categories.map((c) => c.plannedMinor)).toEqual(
      may.categories.map((c) => c.plannedMinor),
    );
    expect(july.actualMinor).toBe(100000);
    expect(may.actualMinor).toBe(0);
  });

  it("rejects a malformed month", () => {
    expect(() => monthReadModel(kitBudgetRow(), "2026-13", {})).toThrow();
  });
});

describe("budgetPlanModel", () => {
  it("returns plans only: computed planned/available, no actuals, no month (CR1-2)", () => {
    const model = budgetPlanModel(kitBudgetRow());
    expect(model.plannedMinor).toBe(1200000);
    expect(model.availableMinor).toBe(50000);
    expect(model).not.toHaveProperty("month");
    expect(model).not.toHaveProperty("actualMinor");
    expect(model.categories).toHaveLength(7);
    for (const category of model.categories) {
      expect(category).not.toHaveProperty("actualMinor");
      expect(category).not.toHaveProperty("progressPercent");
    }
  });

  it("orders categories by displayOrder", () => {
    const row = kitBudgetRow();
    row.categories = [...row.categories].reverse();
    const model = budgetPlanModel(row);
    expect(model.categories.map((category) => category.displayOrder)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });
});

describe("largestRemainderShares", () => {
  it("returns integers summing to exactly 100", () => {
    const shares = largestRemainderShares([395700, 151600, 84200, 92600, 117900]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);
    // Kit insights percentages (content.json julyPercent values).
    expect(shares).toEqual([47, 18, 10, 11, 14]);
  });

  it("sums to 100 across the CR-001 seven-category demo distribution", () => {
    const shares = largestRemainderShares([
      323600, 136600, 84200, 92600, 117900, 15000, 72100,
    ]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("resolves the classic 1/3 split to a 100 total", () => {
    const shares = largestRemainderShares([1, 1, 1]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(shares.sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });

  it("returns all zeros for an all-zero input", () => {
    expect(largestRemainderShares([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("monthName / shortDateLabel", () => {
  it("maps months to fixed English names", () => {
    expect(monthName("2026-07")).toBe("July");
    expect(monthName("2026-01")).toBe("January");
    expect(monthName("2025-12")).toBe("December");
  });

  it("builds short chart labels by pure string arithmetic", () => {
    expect(shortDateLabel("2026-07-01")).toBe("Jul 1");
    expect(shortDateLabel("2026-07-16")).toBe("Jul 16");
    expect(shortDateLabel("2025-12-31")).toBe("Dec 31");
  });

  it("rejects malformed input", () => {
    expect(() => monthName("2026-7")).toThrow();
    expect(() => shortDateLabel("2026-07")).toThrow();
  });

  it("rejects dates that are formatted correctly but do not exist", () => {
    for (const invalidDate of ["2026-02-29", "2026-02-31", "2026-99-01", "2026-01-00"]) {
      expect(() => shortDateLabel(invalidDate)).toThrow(`Invalid date: ${invalidDate}`);
    }
    expect(shortDateLabel("2028-02-29")).toBe("Feb 29");
  });
});

describe("cashFlowSampleDates", () => {
  it("samples days 1,6,11,16,21,26 and the clamped last day of a 31-day month", () => {
    expect(cashFlowSampleDates("2026-07")).toEqual([
      "2026-07-01",
      "2026-07-06",
      "2026-07-11",
      "2026-07-16",
      "2026-07-21",
      "2026-07-26",
      "2026-07-31",
    ]);
  });

  it("clamps the last sample to 30, 28, and 29 (leap February)", () => {
    expect(cashFlowSampleDates("2026-06").at(-1)).toBe("2026-06-30");
    expect(cashFlowSampleDates("2026-02").at(-1)).toBe("2026-02-28");
    expect(cashFlowSampleDates("2028-02").at(-1)).toBe("2028-02-29");
  });
});

describe("cumulativeAtDates", () => {
  const sampleDates = cashFlowSampleDates("2026-07");

  it("accumulates per-day sums up to and including each sample date", () => {
    const sums = {
      "2026-07-01": 60000, // included in the Jul 1 point (boundary)
      "2026-07-03": 50000,
      "2026-07-06": 70000, // included in the Jul 6 point (boundary)
      "2026-07-19": 10000,
      "2026-07-31": 25000, // included in the final point (boundary)
    };
    expect(cumulativeAtDates(sampleDates, sums)).toEqual([
      60000, 180000, 180000, 180000, 190000, 190000, 215000,
    ]);
  });

  it("returns an all-zero series for a month with no spending", () => {
    expect(cumulativeAtDates(sampleDates, {})).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("ends at the month's total spending (coherence with per-category sums)", () => {
    const sums = { "2026-07-02": 111, "2026-07-15": 222, "2026-07-28": 333 };
    const series = cumulativeAtDates(sampleDates, sums);
    expect(series.at(-1)).toBe(666);
    // Monotonically non-decreasing by construction.
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
    }
  });
});
