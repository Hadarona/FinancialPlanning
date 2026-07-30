import { describe, it, expect } from "vitest";
import {
  previousMonth,
  daysInMonth,
  monthRange,
  summarizeBudget,
  largestRemainderShares,
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
    expect(monthRange("2026-07")).toEqual({ firstDay: "2026-07-01", lastDay: "2026-07-31" });
    expect(monthRange("2026-02")).toEqual({ firstDay: "2026-02-01", lastDay: "2026-02-28" });
  });

  it("rejects a malformed month", () => {
    expect(() => monthRange("2026-00")).toThrow();
  });
});

// Kit fixture (docs/design/figma-kit/data/content.json, in minor units):
// income 12,500; plans 4,000/1,500/800/900/3,000 (=10,200); available 2,300.
function kitBudgetRow() {
  return {
    id: "budget-1",
    month: "2026-07",
    currencyCode: "USD",
    incomeMinor: 1250000,
    categories: [
      { id: "housing", name: "Housing", icon: "House", color: "blue", displayOrder: 1, plannedMinor: 400000 },
      { id: "groceries", name: "Groceries", icon: "ShoppingCart", color: "green", displayOrder: 2, plannedMinor: 150000 },
      { id: "transport", name: "Transport", icon: "CarFront", color: "yellow", displayOrder: 3, plannedMinor: 80000 },
      { id: "fun", name: "Fun", icon: "PartyPopper", color: "coral", displayOrder: 4, plannedMinor: 90000 },
      { id: "savings", name: "Savings", icon: "PiggyBank", color: "blue", displayOrder: 5, plannedMinor: 300000 },
    ],
  };
}

describe("summarizeBudget", () => {
  it("computes kit totals: planned 10,200 and available 2,300 from income 12,500", () => {
    const summary = summarizeBudget(kitBudgetRow(), { housing: 252000 });
    expect(summary.incomeMinor).toBe(1250000);
    expect(summary.plannedMinor).toBe(1020000);
    expect(summary.availableMinor).toBe(230000);
    expect(summary.actualMinor).toBe(252000);
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
    expect(summary.availableMinor).toBe(-120000);
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

  it("resolves the classic 1/3 split to a 100 total", () => {
    const shares = largestRemainderShares([1, 1, 1]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(shares.sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });

  it("returns all zeros for an all-zero input", () => {
    expect(largestRemainderShares([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
