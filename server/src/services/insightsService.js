import { AppError } from "../errors.js";
import {
  previousMonth,
  monthName,
  shortDateLabel,
  cashFlowSampleDates,
  cumulativeAtDates,
  largestRemainderShares,
} from "./calc.js";

/**
 * Month-comparison aggregates for the Insights screen (Stage F). One coherent
 * response (D-INS-F1): totals, per-category comparison with donut shares, and
 * the two cumulative cash-flow series. Ownership follows the same rule as
 * every other service: methods take the authenticated user id first and every
 * repo query filters by it (D-INS-B6).
 */
export function createInsightsService({ budgetRepo, transactionRepo }) {
  /** Aggregates one owned budget period. Two independent SQL aggregations
   * (per category, per day) cross-check each other in `assertCoherent`. */
  async function aggregateMonth(userId, budgetRow) {
    const [byCategory, byDay] = await Promise.all([
      transactionRepo.sumByCategory(userId, budgetRow.id),
      transactionRepo.sumByDay(userId, budgetRow.id),
    ]);
    const sampleDates = cashFlowSampleDates(budgetRow.month);
    const cumulative = cumulativeAtDates(sampleDates, byDay);
    return { byCategory, cumulative, sampleDates };
  }

  /** D-INS-B1/B2: the per-category sum and the last cumulative point come
   * from independent aggregations; a mismatch means corrupted aggregation
   * and must never be served as insight data. */
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

  async function getInsights(userId, month) {
    const budgetRow = await budgetRepo.findByUserAndMonth(userId, month);
    if (!budgetRow) {
      throw new AppError("NOT_FOUND", "No budget for this month.");
    }

    const prevMonth = previousMonth(month);
    // The previous-month lookup is independent of the current-month
    // aggregation — run them in parallel (matters on remote-DB latency).
    const [current, prevBudgetRow] = await Promise.all([
      aggregateMonth(userId, budgetRow),
      budgetRepo.findByUserAndMonth(userId, prevMonth),
    ]);
    const hasPrevious = prevBudgetRow !== null;
    const previous = hasPrevious ? await aggregateMonth(userId, prevBudgetRow) : null;

    const currentTotalMinor = assertCoherent(
      month,
      current.byCategory,
      current.cumulative,
    );
    const previousTotalMinor = hasPrevious
      ? assertCoherent(prevMonth, previous.byCategory, previous.cumulative)
      : null;

    const orderedCategories = [...budgetRow.categories].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    const currentActuals = orderedCategories.map(
      (category) => current.byCategory[category.id] ?? 0,
    );
    // Documented rounding rule (decision #10): largest-remainder shares of
    // actual spending, integers summing to exactly 100 (all-zero -> all 0).
    const shares = largestRemainderShares(currentActuals);

    const categories = orderedCategories.map((category, index) => ({
      id: category.id,
      label: category.name,
      color: category.color,
      currentMinor: currentActuals[index],
      previousMinor: hasPrevious ? (previous.byCategory[category.id] ?? 0) : null,
      sharePercent: shares[index],
    }));

    return {
      insights: {
        month,
        monthLabel: monthName(month),
        previousMonth: prevMonth,
        previousMonthLabel: monthName(prevMonth),
        hasPrevious,
        currentTotalMinor,
        previousTotalMinor,
        categories,
        cashFlow: {
          labels: current.sampleDates.map(shortDateLabel),
          currentCumulativeMinor: current.cumulative,
          // Sampled at the previous month's own days 1/6/11/16/21/26/last;
          // both series plot against the same seven x positions.
          previousCumulativeMinor: hasPrevious ? previous.cumulative : [],
        },
      },
    };
  }

  return { getInsights };
}
