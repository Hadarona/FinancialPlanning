import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
import { DEFAULT_CATEGORIES } from "../../src/domain/categories.js";

const PASSWORD = "supersecret1";

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

async function registerUser(baseUrl) {
  const client = createCookieJarFetch(baseUrl);
  const res = await client.request(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail("budget"), password: PASSWORD }),
    },
    30000,
  );
  expect(res.status).toBe(201);
  const body = await res.json();
  return { client, userId: body.user.id };
}

/** Kit fixture (content.json): income 12,500; plans totaling 10,200. */
function kitCategories(overrides = {}) {
  return DEFAULT_CATEGORIES.map((category) => ({
    ...category,
    plannedMinor: overrides[category.id] ?? category.plannedMinor,
  }));
}

describe("GET /budgets/:month", () => {
  let ctx;
  let pool;

  async function insertBudget({
    userId,
    month,
    incomeMinor = 1250000,
    categories = kitCategories(),
  }) {
    const result = await pool.query(
      `INSERT INTO budget_periods (user_id, month, income_minor, categories)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [userId, month, incomeMinor, JSON.stringify(categories)],
    );
    return result.rows[0].id;
  }

  async function insertTransaction({
    userId,
    budgetPeriodId,
    categoryId,
    amountMinor,
    occurredOn,
  }) {
    await pool.query(
      `INSERT INTO transactions (user_id, budget_period_id, category_id, amount_minor, occurred_on)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, budgetPeriodId, categoryId, amountMinor, occurredOn],
    );
  }

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000 });
    // Dynamic import per the harness isolation rule (see testServer.js).
    const { createPool } = await import("../../src/db/pool.js");
    pool = createPool(ctx.config);
  }, 30000);

  afterAll(async () => {
    await pool.end();
    await ctx.close();
  }, 30000);

  it("returns the kit fixture read model: income 12,500 / planned 10,200 / available 2,300", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    const budgetId = await insertBudget({ userId, month: "2026-07" });
    // Housing actual 2,520 of 4,000 planned -> 63% (kit example), split into
    // two rows so the SUM(...) aggregation itself is exercised.
    await insertTransaction({
      userId,
      budgetPeriodId: budgetId,
      categoryId: "housing",
      amountMinor: 200000,
      occurredOn: "2026-07-05",
    });
    await insertTransaction({
      userId,
      budgetPeriodId: budgetId,
      categoryId: "housing",
      amountMinor: 52000,
      occurredOn: "2026-07-14",
    });

    const res = await client.request("/budgets/2026-07");
    expect(res.status).toBe(200);
    const { budget } = await res.json();

    expect(budget.month).toBe("2026-07");
    expect(budget.currencyCode).toBe("USD");
    expect(budget.incomeMinor).toBe(1250000);
    expect(budget.plannedMinor).toBe(1020000);
    expect(budget.availableMinor).toBe(230000);
    expect(budget.actualMinor).toBe(252000);

    expect(budget.categories.map((category) => category.id)).toEqual([
      "housing",
      "groceries",
      "transport",
      "fun",
      "savings",
    ]);
    const housing = budget.categories[0];
    expect(housing).toMatchObject({
      name: "Housing",
      icon: "House",
      color: "blue",
      plannedMinor: 400000,
      actualMinor: 252000,
      progressPercent: 63,
      state: "normal",
    });
  }, 30000);

  it("includes first/last-day-of-month transactions and excludes adjacent months", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    const julyId = await insertBudget({ userId, month: "2026-07" });
    const juneId = await insertBudget({ userId, month: "2026-06" });

    await insertTransaction({
      userId,
      budgetPeriodId: julyId,
      categoryId: "groceries",
      amountMinor: 1000,
      occurredOn: "2026-07-01",
    });
    await insertTransaction({
      userId,
      budgetPeriodId: julyId,
      categoryId: "groceries",
      amountMinor: 2000,
      occurredOn: "2026-07-31",
    });
    await insertTransaction({
      userId,
      budgetPeriodId: juneId,
      categoryId: "groceries",
      amountMinor: 40000,
      occurredOn: "2026-06-30",
    });

    const res = await client.request("/budgets/2026-07");
    const { budget } = await res.json();
    const groceries = budget.categories.find((category) => category.id === "groceries");
    expect(groceries.actualMinor).toBe(3000);
    expect(budget.actualMinor).toBe(3000);
  }, 30000);

  it("handles a zero-plan category with spending: no NaN/Infinity/500, state 'unplanned'", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    const budgetId = await insertBudget({
      userId,
      month: "2026-07",
      categories: kitCategories({ fun: 0 }),
    });
    await insertTransaction({
      userId,
      budgetPeriodId: budgetId,
      categoryId: "fun",
      amountMinor: 5000,
      occurredOn: "2026-07-10",
    });

    const res = await client.request("/budgets/2026-07");
    expect(res.status).toBe(200);
    const { budget } = await res.json();
    const fun = budget.categories.find((category) => category.id === "fun");
    expect(fun.state).toBe("unplanned");
    expect(fun.progressPercent).toBeNull();
    expect(JSON.stringify(budget)).not.toMatch(/NaN|Infinity/);
  }, 30000);

  it("strictly validates the :month segment (D-BUD-B1)", async () => {
    const { client } = await registerUser(ctx.baseUrl);
    for (const bad of ["2026-7", "2026-13", "202607", "2026-07-01", "july"]) {
      const res = await client.request(`/budgets/${bad}`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    }
  }, 30000);

  it("rejects unauthenticated reads with 401", async () => {
    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const res = await anonymous.request("/budgets/2026-07");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  }, 30000);

  it("returns 404 (not data) when another user owns a budget for that month (D-BUD-B4)", async () => {
    const userA = await registerUser(ctx.baseUrl);
    const userB = await registerUser(ctx.baseUrl);
    await insertBudget({ userId: userA.userId, month: "2026-03" });

    const res = await userB.client.request("/budgets/2026-03");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(body)).not.toContain(userA.userId);
  }, 30000);

  it("enforces the unique (user_id, month) index at the database level (D-BUD-B5)", async () => {
    const { userId } = await registerUser(ctx.baseUrl);
    await insertBudget({ userId, month: "2026-05" });
    await expect(insertBudget({ userId, month: "2026-05" })).rejects.toMatchObject({
      code: "23505",
    });
  }, 30000);
});
