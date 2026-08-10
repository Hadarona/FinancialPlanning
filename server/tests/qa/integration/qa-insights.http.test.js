// QA-SI-60..69: real-HTTP insights coverage against an isolated schema.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
import {
  kitBudgetPayload,
  expensePayload,
  expectedLargestRemainderShares,
} from "../helpers/qaFixtures.js";

// Remote Neon round-trips make multi-request journeys slower than vitest's
// 5s default test timeout.
const SLOW_TEST_TIMEOUT = 30000;

/** Kit comparison fixture (roadmap §2.2 / content.json, minor units):
 * current month totals 842,000; previous 918,000; shares [47,18,10,11,14]. */
const CURRENT_ACTUALS = {
  housing: 395700,
  groceries: 151600,
  transport: 84200,
  fun: 92600,
  savings: 117900,
};
const PREVIOUS_ACTUALS = {
  housing: 430000,
  groceries: 170000,
  transport: 90000,
  fun: 100000,
  savings: 128000,
};

describe("QA-SI: insights http", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  async function freshUserSession() {
    const session = createSession(ctx.baseUrl);
    await registerUser(session);
    return session;
  }

  /** Creates a budget for `month` then splits each category's total actual
   * spend into two expenses (day 03 and day 17) so both the per-category
   * and per-day server-side aggregations are truly exercised over real HTTP. */
  async function seedMonthActuals(session, month, actualsByCategory) {
    await session.request("/budgets", { method: "POST", body: kitBudgetPayload(month) });
    // Fired concurrently (each request gets its own pool connection/
    // transaction) so seeding ten expenses over remote Neon round-trips
    // stays well inside the test timeout.
    const requests = [];
    for (const [categoryId, totalMinor] of Object.entries(actualsByCategory)) {
      const firstPart = Math.floor(totalMinor / 2);
      const secondPart = totalMinor - firstPart;
      if (firstPart > 0) {
        requests.push(
          session.request(`/budgets/${month}/transactions`, {
            method: "POST",
            body: expensePayload({
              month,
              categoryId,
              amountMinor: firstPart,
              occurredOn: `${month}-03`,
            }),
          }),
        );
      }
      if (secondPart > 0) {
        requests.push(
          session.request(`/budgets/${month}/transactions`, {
            method: "POST",
            body: expensePayload({
              month,
              categoryId,
              amountMinor: secondPart,
              occurredOn: `${month}-17`,
            }),
          }),
        );
      }
    }
    const responses = await Promise.all(requests);
    for (const response of responses) {
      if (response.status !== 201) {
        throw new Error(`seedMonthActuals: expense POST failed with ${response.status}`);
      }
    }
  }

  async function seedComparisonPair(session, currentMonth, previousMonth) {
    await Promise.all([
      seedMonthActuals(session, currentMonth, CURRENT_ACTUALS),
      seedMonthActuals(session, previousMonth, PREVIOUS_ACTUALS),
    ]);
  }

  it(
    "QA-SI-60: current and previous totals are internally coherent (category sums == total == last cumulative point)",
    async () => {
      const session = await freshUserSession();
      await seedComparisonPair(session, "2026-07", "2026-06");
      const body = await mustJson(await session.request("/insights/2026-07"), 200);
      const { insights } = body;

      const sumCurrent = insights.categories.reduce((sum, c) => sum + c.currentMinor, 0);
      const sumPrevious = insights.categories.reduce(
        (sum, c) => sum + c.previousMinor,
        0,
      );
      expect(sumCurrent).toBe(insights.currentTotalMinor);
      expect(sumPrevious).toBe(insights.previousTotalMinor);
      expect(insights.currentTotalMinor).toBe(842000);
      expect(insights.previousTotalMinor).toBe(918000);
      expect(insights.cashFlow.currentCumulativeMinor).toHaveLength(7);
      expect(insights.cashFlow.previousCumulativeMinor).toHaveLength(7);
      expect(insights.cashFlow.currentCumulativeMinor.at(-1)).toBe(
        insights.currentTotalMinor,
      );
      expect(insights.cashFlow.previousCumulativeMinor.at(-1)).toBe(
        insights.previousTotalMinor,
      );
      for (const series of [
        insights.cashFlow.currentCumulativeMinor,
        insights.cashFlow.previousCumulativeMinor,
      ]) {
        for (let i = 1; i < series.length; i += 1) {
          expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
        }
      }
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-61: insights and the budget read model agree on actual spending totals",
    async () => {
      const session = await freshUserSession();
      await seedComparisonPair(session, "2026-07", "2026-06");
      const insightsBody = await mustJson(
        await session.request("/insights/2026-07"),
        200,
      );
      const budgetBody = await mustJson(await session.request("/budgets/2026-07"), 200);

      expect(insightsBody.insights.currentTotalMinor).toBe(budgetBody.budget.actualMinor);
      for (const category of insightsBody.insights.categories) {
        const budgetCategory = budgetBody.budget.categories.find(
          (c) => c.id === category.id,
        );
        expect(category.currentMinor).toBe(budgetCategory.actualMinor);
      }
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-62: donut shares match the documented largest-remainder rounding and sum to 100",
    async () => {
      const session = await freshUserSession();
      await seedComparisonPair(session, "2026-07", "2026-06");
      const body = await mustJson(await session.request("/insights/2026-07"), 200);
      const { insights } = body;

      const currentValues = insights.categories.map((c) => c.currentMinor);
      const expectedShares = expectedLargestRemainderShares(currentValues);
      const actualShares = insights.categories.map((c) => c.sharePercent);
      expect(actualShares).toEqual(expectedShares);
      expect(actualShares.reduce((sum, value) => sum + value, 0)).toBe(100);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-63: cash-flow labels and month labels follow the documented sample grid",
    async () => {
      const session = await freshUserSession();
      await seedComparisonPair(session, "2026-07", "2026-06");
      const body = await mustJson(await session.request("/insights/2026-07"), 200);
      const { insights } = body;

      expect(insights.cashFlow.labels).toEqual([
        "Jul 1",
        "Jul 6",
        "Jul 11",
        "Jul 16",
        "Jul 21",
        "Jul 26",
        "Jul 31",
      ]);
      expect(insights.monthLabel).toBe("July");
      expect(insights.previousMonthLabel).toBe("June");
      expect(insights.hasPrevious).toBe(true);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-64: January compares against December of the previous year",
    async () => {
      const session = await freshUserSession();
      await seedComparisonPair(session, "2026-01", "2025-12");
      const body = await mustJson(await session.request("/insights/2026-01"), 200);
      const { insights } = body;

      expect(insights.previousMonth).toBe("2025-12");
      expect(insights.previousMonthLabel).toBe("December");
      expect(insights.hasPrevious).toBe(true);
      expect(insights.previousTotalMinor).toBe(918000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-65: a missing previous month is an explicit no-comparison state, never a 500 or a fake zero",
    async () => {
      const session = await freshUserSession();
      await seedMonthActuals(session, "2026-07", CURRENT_ACTUALS);
      const body = await mustJson(await session.request("/insights/2026-07"), 200);
      const { insights } = body;

      expect(insights.hasPrevious).toBe(false);
      expect(insights.previousTotalMinor).toBeNull();
      expect(insights.cashFlow.previousCumulativeMinor).toEqual([]);
      for (const category of insights.categories) {
        expect(category.previousMinor).toBeNull();
      }
      expect(insights.currentTotalMinor).toBe(842000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-66: a month with zero expenses has a zero total and zero shares, no NaN/asymmetry",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const body = await mustJson(await session.request("/insights/2026-07"), 200);
      const { insights } = body;

      expect(insights.currentTotalMinor).toBe(0);
      for (const category of insights.categories) {
        expect(category.currentMinor).toBe(0);
        expect(category.sharePercent).toBe(0);
      }
      expect(insights.cashFlow.currentCumulativeMinor.every((value) => value === 0)).toBe(
        true,
      );
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-67: another user's spending never enters my aggregation",
    async () => {
      const userA = await freshUserSession();
      await seedComparisonPair(userA, "2026-07", "2026-06");
      const beforeB = await mustJson(await userA.request("/insights/2026-07"), 200);

      const userB = await freshUserSession();
      await userB.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      await userB.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "fun",
          amountMinor: 999999,
        }),
      });

      const afterB = await mustJson(await userA.request("/insights/2026-07"), 200);
      expect(afterB).toEqual(beforeB);

      const asB = await mustJson(await userB.request("/insights/2026-07"), 200);
      expect(asB.insights.currentTotalMinor).toBe(999999);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-68: a month with no budget is 404; a malformed month is 400",
    async () => {
      const session = await freshUserSession();
      const missingRes = await session.request("/insights/2026-04");
      const missingBody = await mustJson(missingRes, 404);
      expect(missingBody.error.code).toBe("NOT_FOUND");

      const malformedRes = await session.request("/insights/2026-13");
      expect(malformedRes.status).toBe(400);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-69: a leap-day expense (Feb 29) is included and forms the last cumulative point",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2028-02"),
      });
      await session.request("/budgets/2028-02/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2028-02",
          categoryId: "housing",
          amountMinor: 5000,
          occurredOn: "2028-02-29",
        }),
      });
      const body = await mustJson(await session.request("/insights/2028-02"), 200);
      const { insights } = body;

      expect(insights.currentTotalMinor).toBe(5000);
      expect(insights.cashFlow.labels.at(-1)).toBe("Feb 29");
      expect(insights.cashFlow.currentCumulativeMinor.at(-1)).toBe(5000);
    },
    SLOW_TEST_TIMEOUT,
  );
});
