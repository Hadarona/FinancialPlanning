import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
import { DEFAULT_CATEGORY_IDS } from "../../src/domain/categories.js";

const PASSWORD = "supersecret1";

/** CR-001 demo-fixture actuals (minor units): current month totals 842,000
 * across the seven categories; previous month 918,000. */
const CURRENT_ACTUALS = {
  housing: 323600,
  groceries: 136600,
  transport: 84200,
  fun: 92600,
  savings: 117900,
  subscriptions: 15000,
  utilities: 72100,
};
const PREVIOUS_ACTUALS = {
  housing: 350000,
  groceries: 155000,
  transport: 90000,
  fun: 100000,
  savings: 128000,
  subscriptions: 15000,
  utilities: 80000,
};

const SEVEN_IDS = [
  "housing",
  "groceries",
  "transport",
  "fun",
  "savings",
  "subscriptions",
  "utilities",
];

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

describe("GET /insights?months= (CR-001 multi-month comparison)", () => {
  let ctx;
  let pool;

  /** Splits each category total into two rows on different days so both
   * the per-category and the per-day aggregations are truly exercised. */
  async function insertMonthActuals({ userId, month, actuals }) {
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
        values.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3})`);
        params.push(userId, categoryId, row.amountMinor, `${month}-${row.day}`);
        index += 4;
      }
    }
    await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount_minor, occurred_on)
       VALUES ${values.join(", ")}`,
      params,
    );
  }

  async function seedComparisonPair(userId, currentMonthStr, previousMonthStr) {
    await insertMonthActuals({
      userId,
      month: currentMonthStr,
      actuals: CURRENT_ACTUALS,
    });
    await insertMonthActuals({
      userId,
      month: previousMonthStr,
      actuals: PREVIOUS_ACTUALS,
    });
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

  it("returns one coherent two-month response: totals 842,000/918,000, combined shares sum 100 (CR3-4/5)", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    await seedComparisonPair(userId, "2026-07", "2026-06");

    const res = await client.request("/insights?months=2026-06,2026-07");
    expect(res.status).toBe(200);
    const { insights } = await res.json();

    // Months normalized newest-first regardless of query order (CR3-3).
    expect(insights.months.map((entry) => entry.month)).toEqual(["2026-07", "2026-06"]);
    expect(insights.months[0]).toMatchObject({
      label: "July",
      yearLabel: "July 2026",
      totalMinor: 842000,
    });
    expect(insights.months[1]).toMatchObject({
      label: "June",
      yearLabel: "June 2026",
      totalMinor: 918000,
    });
    expect(insights.combinedTotalMinor).toBe(842000 + 918000);

    // Categories in display order (seven), totals aligned with months.
    expect(insights.categories.map((category) => category.id)).toEqual(SEVEN_IDS);
    expect(insights.categories.map((category) => category.totalsMinor[0])).toEqual([
      323600, 136600, 84200, 92600, 117900, 15000, 72100,
    ]);
    expect(insights.categories.map((category) => category.totalsMinor[1])).toEqual([
      350000, 155000, 90000, 100000, 128000, 15000, 80000,
    ]);
    for (const category of insights.categories) {
      expect(category.combinedMinor).toBe(
        category.totalsMinor[0] + category.totalsMinor[1],
      );
    }
    const shares = insights.categories.map((category) => category.sharePercent);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);

    // Cross-chart coherence per month: category sums == totals == last
    // cumulative point (CR3-5).
    for (const [index, monthEntry] of insights.months.entries()) {
      const categorySum = insights.categories.reduce(
        (sum, category) => sum + category.totalsMinor[index],
        0,
      );
      expect(categorySum).toBe(monthEntry.totalMinor);
      expect(monthEntry.cashFlow.cumulativeMinor).toHaveLength(7);
      expect(monthEntry.cashFlow.cumulativeMinor.at(-1)).toBe(monthEntry.totalMinor);
      for (let i = 1; i < monthEntry.cashFlow.cumulativeMinor.length; i += 1) {
        expect(monthEntry.cashFlow.cumulativeMinor[i]).toBeGreaterThanOrEqual(
          monthEntry.cashFlow.cumulativeMinor[i - 1],
        );
      }
    }
    expect(insights.months[0].cashFlow.labels).toEqual([
      "Jul 1",
      "Jul 6",
      "Jul 11",
      "Jul 16",
      "Jul 21",
      "Jul 26",
      "Jul 31",
    ]);
  }, 30000);

  it("supports a single month (one series) and three months (CR3-4)", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    await seedComparisonPair(userId, "2026-07", "2026-06");

    const single = await client.request("/insights?months=2026-07");
    expect(single.status).toBe(200);
    const { insights: singleInsights } = await single.json();
    expect(singleInsights.months).toHaveLength(1);
    expect(singleInsights.months[0].totalMinor).toBe(842000);
    expect(singleInsights.combinedTotalMinor).toBe(842000);
    for (const category of singleInsights.categories) {
      expect(category.totalsMinor).toHaveLength(1);
      expect(category.combinedMinor).toBe(category.totalsMinor[0]);
    }

    const triple = await client.request("/insights?months=2026-05,2026-07,2026-06");
    expect(triple.status).toBe(200);
    const { insights: tripleInsights } = await triple.json();
    expect(tripleInsights.months.map((entry) => entry.month)).toEqual([
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
    // 2026-05 has no expenses: a zero month, never an error (CR3-7).
    expect(tripleInsights.months[2].totalMinor).toBe(0);
    expect(tripleInsights.months[2].cashFlow.cumulativeMinor).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(tripleInsights.combinedTotalMinor).toBe(842000 + 918000);
  }, 30000);

  it("selects a cross-year triple: December + January work by string month math (CR3-6)", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    await seedComparisonPair(userId, "2026-01", "2025-12");

    const res = await client.request("/insights?months=2025-12,2026-01");
    expect(res.status).toBe(200);
    const { insights } = await res.json();
    expect(insights.months.map((entry) => entry.month)).toEqual(["2026-01", "2025-12"]);
    expect(insights.months[0].yearLabel).toBe("January 2026");
    expect(insights.months[1].yearLabel).toBe("December 2025");
    expect(insights.months[1].totalMinor).toBe(918000);
    expect(insights.months[0].cashFlow.labels[0]).toBe("Jan 1");
  }, 30000);

  it("answers 400 VALIDATION_ERROR for 0, 4+, duplicate, and malformed months (CR3-3)", async () => {
    const { client } = await registerUser(ctx.baseUrl);

    const badQueries = [
      "", // parameter missing entirely
      "?months=",
      "?months=2026-07,2026-06,2026-05,2026-04",
      "?months=2026-07,2026-07",
      "?months=2026-7",
      "?months=2026-13",
      "?months=july",
      "?months=2026-07-01",
    ];
    for (const query of badQueries) {
      const res = await client.request(`/insights${query}`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    }
  }, 30000);

  it("returns all zeros for a budget with no expenses at all (CR3-7)", async () => {
    const { client } = await registerUser(ctx.baseUrl);
    const res = await client.request("/insights?months=2026-09");
    expect(res.status).toBe(200);
    const { insights } = await res.json();
    expect(insights.months[0].totalMinor).toBe(0);
    expect(insights.combinedTotalMinor).toBe(0);
    expect(insights.categories.every((category) => category.sharePercent === 0)).toBe(
      true,
    );
  }, 30000);

  it("never lets another user's transactions enter the aggregation (REG-3)", async () => {
    const userA = await registerUser(ctx.baseUrl);
    const userB = await registerUser(ctx.baseUrl);
    await seedComparisonPair(userA.userId, "2026-07", "2026-06");
    await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount_minor, occurred_on)
         VALUES ($1, 'fun', 999999, '2026-07-09')`,
      [userB.userId],
    );

    const resA = await userA.client.request("/insights?months=2026-07");
    const { insights: insightsA } = await resA.json();
    expect(insightsA.months[0].totalMinor).toBe(842000);

    const resB = await userB.client.request("/insights?months=2026-07");
    const { insights: insightsB } = await resB.json();
    expect(insightsB.months[0].totalMinor).toBe(999999);
  }, 30000);

  it("answers the defensive 404 when the budget row is missing, 401 unauthenticated", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    await pool.query("DELETE FROM budgets WHERE user_id = $1", [userId]);

    const missing = await client.request("/insights?months=2026-09");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("NOT_FOUND");

    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const unauthenticated = await anonymous.request("/insights?months=2026-07");
    expect(unauthenticated.status).toBe(401);
    expect((await unauthenticated.json()).error.code).toBe("UNAUTHENTICATED");
  }, 30000);

  it("aggregates ~1,000 transactions across three months within the local performance budget", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);

    // 1,000 deterministic transactions spread across three months,
    // days, and all seven categories.
    const months = ["2026-04", "2026-03", "2026-02"];
    const values = [];
    const params = [];
    let index = 1;
    for (let i = 0; i < 1000; i += 1) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const month = months[i % 3];
      values.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3})`);
      params.push(
        userId,
        DEFAULT_CATEGORY_IDS[i % DEFAULT_CATEGORY_IDS.length],
        100 + i,
        `${month}-${day}`,
      );
      index += 4;
    }
    await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount_minor, occurred_on)
         VALUES ${values.join(", ")}`,
      params,
    );

    const startedAt = performance.now();
    const res = await client.request("/insights?months=2026-04,2026-03,2026-02");
    const durationMs = performance.now() - startedAt;

    expect(res.status).toBe(200);
    const { insights } = await res.json();
    const expectedTotal = Array.from({ length: 1000 }, (_, i) => 100 + i).reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(insights.combinedTotalMinor).toBe(expectedTotal);

    // Soft budget (<500 ms locally) is logged; remote Neon latency makes it
    // noisy. The delivery-1 hard bound (2 s) covered a single month; this
    // request aggregates THREE months (six parallel SQL aggregations over a
    // remote pool), so the hard bound scales to 4 s.
    if (durationMs >= 500) {
      console.warn(
        `[perf] 3-month insights aggregation over 1,000 tx took ${Math.round(durationMs)} ms (soft budget 500 ms)`,
      );
    }
    expect(durationMs).toBeLessThan(4000);
  }, 60000);
});
