import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
import { DEFAULT_CATEGORIES } from "../../src/domain/categories.js";

const PASSWORD = "supersecret1";

/** Kit insights fixture (content.json, minor units). Current month totals
 * 842,000; previous 918,000; shares [47,18,10,11,14]. */
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

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

async function registerUser(baseUrl) {
  const client = createCookieJarFetch(baseUrl);
  const res = await client.request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: uniqueEmail("insights"), password: PASSWORD }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  return { client, userId: body.user.id };
}

describe("GET /insights/:month", () => {
  let ctx;
  let pool;

  async function insertBudget({ userId, month, incomeMinor = 1250000 }) {
    const result = await pool.query(
      `INSERT INTO budget_periods (user_id, month, income_minor, categories)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [userId, month, incomeMinor, JSON.stringify(DEFAULT_CATEGORIES)],
    );
    return result.rows[0].id;
  }

  /** Splits each category total into two rows on different days so both
   * the per-category and the per-day aggregations are truly exercised. */
  async function insertMonthActuals({ userId, budgetPeriodId, month, actuals }) {
    const values = [];
    const params = [];
    let index = 1;
    for (const [categoryId, totalMinor] of Object.entries(actuals)) {
      const firstPart = Math.floor(totalMinor / 2);
      const rows = [
        { amountMinor: firstPart, day: "03" },
        { amountMinor: totalMinor - firstPart, day: "17" },
      ];
      for (const row of rows) {
        values.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4})`);
        params.push(userId, budgetPeriodId, categoryId, row.amountMinor, `${month}-${row.day}`);
        index += 5;
      }
    }
    await pool.query(
      `INSERT INTO transactions (user_id, budget_period_id, category_id, amount_minor, occurred_on)
       VALUES ${values.join(", ")}`,
      params,
    );
  }

  async function seedComparisonPair(userId, currentMonthStr, previousMonthStr) {
    const currentId = await insertBudget({ userId, month: currentMonthStr });
    const previousId = await insertBudget({ userId, month: previousMonthStr });
    await insertMonthActuals({
      userId,
      budgetPeriodId: currentId,
      month: currentMonthStr,
      actuals: CURRENT_ACTUALS,
    });
    await insertMonthActuals({
      userId,
      budgetPeriodId: previousId,
      month: previousMonthStr,
      actuals: PREVIOUS_ACTUALS,
    });
    return { currentId, previousId };
  }

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000 });
    const { createPool } = await import("../../src/db/pool.js");
    pool = createPool(ctx.config);
  }, 30000);

  afterAll(async () => {
    await pool.end();
    await ctx.close();
  });

  it(
    "returns one coherent kit-fixture response: totals 842,000/918,000, shares sum 100 (D-INS-B1/B2/B3)",
    async () => {
      const { client, userId } = await registerUser(ctx.baseUrl);
      await seedComparisonPair(userId, "2026-07", "2026-06");

      const res = await client.request("/insights/2026-07");
      expect(res.status).toBe(200);
      const { insights } = await res.json();

      expect(insights.month).toBe("2026-07");
      expect(insights.monthLabel).toBe("July");
      expect(insights.previousMonth).toBe("2026-06");
      expect(insights.previousMonthLabel).toBe("June");
      expect(insights.hasPrevious).toBe(true);
      expect(insights.currentTotalMinor).toBe(842000);
      expect(insights.previousTotalMinor).toBe(918000);

      // Categories in display order with kit values and documented rounding.
      expect(insights.categories.map((category) => category.id)).toEqual([
        "housing",
        "groceries",
        "transport",
        "fun",
        "savings",
      ]);
      expect(insights.categories.map((category) => category.currentMinor)).toEqual([
        395700, 151600, 84200, 92600, 117900,
      ]);
      expect(insights.categories.map((category) => category.previousMinor)).toEqual([
        430000, 170000, 90000, 100000, 128000,
      ]);
      const shares = insights.categories.map((category) => category.sharePercent);
      expect(shares).toEqual([47, 18, 10, 11, 14]);
      expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);

      // Cross-chart coherence: category sums == totals == last cumulative point.
      const sumCurrent = insights.categories.reduce((sum, c) => sum + c.currentMinor, 0);
      const sumPrevious = insights.categories.reduce((sum, c) => sum + c.previousMinor, 0);
      expect(sumCurrent).toBe(insights.currentTotalMinor);
      expect(sumPrevious).toBe(insights.previousTotalMinor);
      expect(insights.cashFlow.labels).toEqual([
        "Jul 1",
        "Jul 6",
        "Jul 11",
        "Jul 16",
        "Jul 21",
        "Jul 26",
        "Jul 31",
      ]);
      expect(insights.cashFlow.currentCumulativeMinor).toHaveLength(7);
      expect(insights.cashFlow.previousCumulativeMinor).toHaveLength(7);
      expect(insights.cashFlow.currentCumulativeMinor.at(-1)).toBe(842000);
      expect(insights.cashFlow.previousCumulativeMinor.at(-1)).toBe(918000);
      // Cumulative series never decrease.
      for (const series of [
        insights.cashFlow.currentCumulativeMinor,
        insights.cashFlow.previousCumulativeMinor,
      ]) {
        for (let i = 1; i < series.length; i += 1) {
          expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
        }
      }
    },
    30000,
  );

  it(
    "compares January with December of the previous year (D-INS-B4)",
    async () => {
      const { client, userId } = await registerUser(ctx.baseUrl);
      await seedComparisonPair(userId, "2026-01", "2025-12");

      const res = await client.request("/insights/2026-01");
      expect(res.status).toBe(200);
      const { insights } = await res.json();
      expect(insights.previousMonth).toBe("2025-12");
      expect(insights.previousMonthLabel).toBe("December");
      expect(insights.hasPrevious).toBe(true);
      expect(insights.previousTotalMinor).toBe(918000);
      expect(insights.cashFlow.labels[0]).toBe("Jan 1");
    },
    30000,
  );

  it(
    "returns an explicit no-comparison state when the previous month has no budget (D-INS-B5)",
    async () => {
      const { client, userId } = await registerUser(ctx.baseUrl);
      const budgetId = await insertBudget({ userId, month: "2026-07" });
      await insertMonthActuals({
        userId,
        budgetPeriodId: budgetId,
        month: "2026-07",
        actuals: CURRENT_ACTUALS,
      });

      const res = await client.request("/insights/2026-07");
      expect(res.status).toBe(200);
      const { insights } = await res.json();
      expect(insights.hasPrevious).toBe(false);
      expect(insights.previousTotalMinor).toBeNull();
      expect(insights.cashFlow.previousCumulativeMinor).toEqual([]);
      for (const category of insights.categories) {
        expect(category.previousMinor).toBeNull();
      }
      expect(insights.currentTotalMinor).toBe(842000);
    },
    30000,
  );

  it(
    "never lets another user's transactions enter the aggregation (D-INS-B6)",
    async () => {
      const userA = await registerUser(ctx.baseUrl);
      const userB = await registerUser(ctx.baseUrl);
      await seedComparisonPair(userA.userId, "2026-07", "2026-06");
      // User B has an identical-months budget with different spending.
      const bBudget = await insertBudget({ userId: userB.userId, month: "2026-07" });
      await pool.query(
        `INSERT INTO transactions (user_id, budget_period_id, category_id, amount_minor, occurred_on)
         VALUES ($1, $2, 'fun', 999999, '2026-07-09')`,
        [userB.userId, bBudget],
      );

      const resA = await userA.client.request("/insights/2026-07");
      const { insights: insightsA } = await resA.json();
      expect(insightsA.currentTotalMinor).toBe(842000);

      const resB = await userB.client.request("/insights/2026-07");
      const { insights: insightsB } = await resB.json();
      expect(insightsB.currentTotalMinor).toBe(999999);
      expect(insightsB.hasPrevious).toBe(false);
    },
    30000,
  );

  it("returns 404 when the user has no budget for the month, 400 for a malformed month, 401 unauthenticated", async () => {
    const { client } = await registerUser(ctx.baseUrl);

    const missing = await client.request("/insights/2026-09");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("NOT_FOUND");

    const malformed = await client.request("/insights/2026-13");
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("VALIDATION_ERROR");

    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const unauthenticated = await anonymous.request("/insights/2026-07");
    expect(unauthenticated.status).toBe(401);
    expect((await unauthenticated.json()).error.code).toBe("UNAUTHENTICATED");
  }, 30000);

  it(
    "aggregates ~1,000 transactions within the local performance budget (D-INS-B7)",
    async () => {
      const { client, userId } = await registerUser(ctx.baseUrl);
      const budgetId = await insertBudget({ userId, month: "2026-04" });

      // 1,000 deterministic transactions spread across days/categories.
      const categoryIds = DEFAULT_CATEGORIES.map((category) => category.id);
      const values = [];
      const params = [];
      let index = 1;
      for (let i = 0; i < 1000; i += 1) {
        const day = String((i % 28) + 1).padStart(2, "0");
        values.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4})`);
        params.push(userId, budgetId, categoryIds[i % 5], 100 + i, `2026-04-${day}`);
        index += 5;
      }
      await pool.query(
        `INSERT INTO transactions (user_id, budget_period_id, category_id, amount_minor, occurred_on)
         VALUES ${values.join(", ")}`,
        params,
      );

      const startedAt = performance.now();
      const res = await client.request("/insights/2026-04");
      const durationMs = performance.now() - startedAt;

      expect(res.status).toBe(200);
      const { insights } = await res.json();
      const expectedTotal = Array.from({ length: 1000 }, (_, i) => 100 + i).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(insights.currentTotalMinor).toBe(expectedTotal);

      // Soft budget (<500 ms locally) is logged; remote Neon latency makes it
      // noisy, so only >2 s is a hard failure (plan risk #2).
      if (durationMs >= 500) {
        console.warn(
          `[perf] insights aggregation over 1,000 tx took ${Math.round(durationMs)} ms (soft budget 500 ms)`,
        );
      }
      expect(durationMs).toBeLessThan(2000);
    },
    60000,
  );
});
