import { AppError } from "../errors.js";
import {
  monthName,
  monthRange,
  shortDateLabel,
  cashFlowSampleDates,
  cumulativeAtDates,
  largestRemainderShares,
} from "./calc.js";

/**
 * Multi-month insights aggregates (CR-001 item 3): the caller selects 1–3
 * calendar months (validated upstream); the fixed current+previous model is
 * superseded. One coherent response: per-month totals + cash-flow series,
 * per-category totals aligned index-for-index with `months`, and combined
 * donut shares across the selection. Ownership follows the same rule as
 * every other service: methods take the authenticated user id first and
 * every repo query filters by it.
 */
export function createInsightsService({ budgetRepo, transactionRepo }) {
  /** Aggregates one owned calendar month. Two independent SQL aggregations
   * (per category, per day) cross-check each other in `assertCoherent`. */
  async function aggregateMonth(userId, month) {
    const range = monthRange(month);
    const [byCategory, byDay] = await Promise.all([
      transactionRepo.sumByCategory(userId, range),
      transactionRepo.sumByDay(userId, range),
    ]);
    const sampleDates = cashFlowSampleDates(month);
    const cumulative = cumulativeAtDates(sampleDates, byDay);
    return { month, byCategory, cumulative, sampleDates };
  }

  /** The per-category sum and the last cumulative point come from
   * independent aggregations; a mismatch means corrupted aggregation and
   * must never be served as insight data (CR3-5). */
  function assertCoherent(month, byCategory, cumulative) {
    const categoryTotal = Object.values(byCategory).reduce(
      (sum, value) => sum + value,
      0,
    );
    const cumulativeTotal = cumulative[cumulative.length - 1];
    if (categoryTotal !== cumulativeTotal) {
      // A plain Error (not AppError) so the error handler logs the
      // diagnostic detail server-side and serves only the safe INTERNAL
      // envelope to the client.
      throw new Error(
        `Insights aggregation incoherent for ${month}: ` +
          `category total ${categoryTotal} != cumulative total ${cumulativeTotal}`,
      );
    }
    return categoryTotal;
  }

  /**
   * @param months validated array of 1–3 unique "YYYY-MM" strings.
   * Response months are normalized newest-first (CR3-3). A selected month
   * with no expenses returns zeros, never an error (CR3-7).
   */
  async function getInsights(userId, months) {
    const budgetRow = await budgetRepo.findByUser(userId);
    if (!budgetRow) {
      throw new AppError("NOT_FOUND", "No budget yet.");
    }

    // Newest first; pure string sort is correct for zero-padded YYYY-MM.
    const orderedMonths = [...months].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    const aggregates = await Promise.all(
      orderedMonths.map((month) => aggregateMonth(userId, month)),
    );

    const totals = aggregates.map((aggregate) =>
      assertCoherent(aggregate.month, aggregate.byCategory, aggregate.cumulative),
    );

    const orderedCategories = [...budgetRow.categories].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    // Combined spending per category across the selection drives the donut
    // (largest-remainder shares of the combined totals, decision #10).
    const combinedByCategory = orderedCategories.map((category) =>
      aggregates.reduce(
        (sum, aggregate) => sum + (aggregate.byCategory[category.id] ?? 0),
        0,
      ),
    );
    const shares = largestRemainderShares(combinedByCategory);

    const categories = orderedCategories.map((category, index) => ({
      id: category.id,
      label: category.name,
      color: category.color,
      // Aligned index-for-index with `insights.months`.
      totalsMinor: aggregates.map((aggregate) => aggregate.byCategory[category.id] ?? 0),
      combinedMinor: combinedByCategory[index],
      sharePercent: shares[index],
    }));

    return {
      insights: {
        months: aggregates.map((aggregate, index) => ({
          month: aggregate.month,
          label: monthName(aggregate.month),
          yearLabel: `${monthName(aggregate.month)} ${aggregate.month.slice(0, 4)}`,
          totalMinor: totals[index],
          cashFlow: {
            labels: aggregate.sampleDates.map(shortDateLabel),
            cumulativeMinor: aggregate.cumulative,
          },
        })),
        categories,
        combinedTotalMinor: totals.reduce((sum, value) => sum + value, 0),
      },
    };
  }

  return { getInsights };
}
