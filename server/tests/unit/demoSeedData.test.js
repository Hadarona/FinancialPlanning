// D-DES-012 / CR2-4 — the demo seed's expense distribution must reproduce
// the kit's cash-flow series (docs/design/figma-kit/data/content.json
// cashFlow) exactly at the seven sample dates, while keeping the monthly
// totals identical to the delivery-1 dataset. CR-001 reworked the
// per-category split to include Subscriptions and Utilities WITHOUT moving
// any per-day sum, so the sampled cumulative series is byte-identical.
// Pure data test — no DB.

import { describe, it, expect } from "vitest";
import {
  CURRENT_MONTH_EXPENSES,
  PREVIOUS_MONTH_EXPENSES,
} from "../../src/seed/demoSeed.js";
import { DEFAULT_CATEGORY_IDS } from "../../src/domain/categories.js";
import { cashFlowSampleDates, cumulativeAtDates } from "../../src/services/calc.js";

// content.json cashFlow cumulative values ×100 (minor units).
const KIT_CURRENT_SERIES = [60000, 180000, 310000, 460000, 590000, 730000, 842000];
const KIT_PREVIOUS_SERIES = [80000, 210000, 350000, 500000, 650000, 790000, 918000];

const CATEGORY_TOTALS = {
  current: {
    savings: 117900,
    housing: 323600,
    groceries: 136600,
    subscriptions: 15000,
    transport: 84200,
    utilities: 72100,
    fun: 92600,
  },
  previous: {
    savings: 128000,
    housing: 350000,
    groceries: 155000,
    subscriptions: 15000,
    transport: 90000,
    utilities: 80000,
    fun: 100000,
  },
};

function totalsByCategory(expenses) {
  const totals = {};
  for (const expense of expenses) {
    totals[expense.categoryId] = (totals[expense.categoryId] ?? 0) + expense.amountMinor;
  }
  return totals;
}

function grandTotal(expenses) {
  return expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
}

/** Seed the expenses into a synthetic month and sample like insightsService. */
function cumulativeSeries(expenses, month) {
  const sumsByDate = {};
  for (const expense of expenses) {
    const date = `${month}-${String(expense.day).padStart(2, "0")}`;
    sumsByDate[date] = (sumsByDate[date] ?? 0) + expense.amountMinor;
  }
  return cumulativeAtDates(cashFlowSampleDates(month), sumsByDate);
}

describe("demo seed expense data (D-DES-012)", () => {
  it("matches the CR-001 seven-category totals for the current month", () => {
    expect(totalsByCategory(CURRENT_MONTH_EXPENSES)).toEqual(CATEGORY_TOTALS.current);
  });

  it("matches the CR-001 seven-category totals for the previous month", () => {
    expect(totalsByCategory(PREVIOUS_MONTH_EXPENSES)).toEqual(CATEGORY_TOTALS.previous);
  });

  it("includes subscriptions and utilities expenses in both months (CR2-4)", () => {
    for (const expenses of [CURRENT_MONTH_EXPENSES, PREVIOUS_MONTH_EXPENSES]) {
      const ids = new Set(expenses.map((expense) => expense.categoryId));
      expect(ids.has("subscriptions")).toBe(true);
      expect(ids.has("utilities")).toBe(true);
    }
  });

  it("uses only ids from the fixed seven-category set", () => {
    const validIds = new Set(DEFAULT_CATEGORY_IDS);
    expect(validIds.size).toBe(7);
    for (const expense of [...CURRENT_MONTH_EXPENSES, ...PREVIOUS_MONTH_EXPENSES]) {
      expect(validIds.has(expense.categoryId)).toBe(true);
    }
  });

  it("keeps the monthly grand totals (8,420.00 / 9,180.00)", () => {
    expect(grandTotal(CURRENT_MONTH_EXPENSES)).toBe(842000);
    expect(grandTotal(PREVIOUS_MONTH_EXPENSES)).toBe(918000);
  });

  it("reproduces the kit's current-month cumulative series in a 31-day month", () => {
    expect(cumulativeSeries(CURRENT_MONTH_EXPENSES, "2026-07")).toEqual(
      KIT_CURRENT_SERIES,
    );
  });

  it("reproduces the kit's previous-month cumulative series in a 30-day month", () => {
    expect(cumulativeSeries(PREVIOUS_MONTH_EXPENSES, "2026-06")).toEqual(
      KIT_PREVIOUS_SERIES,
    );
  });

  it("reproduces both series even in a 28-day month (all days <= 28)", () => {
    expect(cumulativeSeries(CURRENT_MONTH_EXPENSES, "2026-02")).toEqual(
      KIT_CURRENT_SERIES,
    );
    expect(cumulativeSeries(PREVIOUS_MONTH_EXPENSES, "2026-02")).toEqual(
      KIT_PREVIOUS_SERIES,
    );
  });

  it("uses only integer days 1-28 and positive integer minor amounts", () => {
    for (const expense of [...CURRENT_MONTH_EXPENSES, ...PREVIOUS_MONTH_EXPENSES]) {
      expect(Number.isInteger(expense.day)).toBe(true);
      expect(expense.day).toBeGreaterThanOrEqual(1);
      expect(expense.day).toBeLessThanOrEqual(28);
      expect(Number.isInteger(expense.amountMinor)).toBe(true);
      expect(expense.amountMinor).toBeGreaterThan(0);
    }
  });
});
