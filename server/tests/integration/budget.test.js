import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";

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

const SEVEN_IDS = [
  "housing",
  "groceries",
  "transport",
  "fun",
  "savings",
  "subscriptions",
  "utilities",
];

describe("single recurring budget (CR-001): /budget and /months/:month", () => {
  let ctx;
  let pool;

  async function insertTransaction({ userId, categoryId, amountMinor, occurredOn }) {
    await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount_minor, occurred_on)
       VALUES ($1, $2, $3, $4)`,
      [userId, categoryId, amountMinor, occurredOn],
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

  it("GET /budget returns the default plan model provisioned at registration (CR1-2/CR1-9)", async () => {
    const { client } = await registerUser(ctx.baseUrl);

    const res = await client.request("/budget");
    expect(res.status).toBe(200);
    const { budget } = await res.json();

    expect(budget.currencyCode).toBe("USD");
    expect(budget.incomeMinor).toBe(1250000);
    expect(budget.plannedMinor).toBe(1200000);
    expect(budget.availableMinor).toBe(50000);
    // No month, no actuals: the single budget applies to every month.
    expect(budget).not.toHaveProperty("month");
    expect(budget).not.toHaveProperty("actualMinor");
    expect(budget.categories.map((category) => category.id)).toEqual(SEVEN_IDS);
    expect(
      budget.categories.find((category) => category.id === "subscriptions"),
    ).toMatchObject({ name: "Subscriptions", icon: "Repeat", color: "coral" });
    expect(
      budget.categories.find((category) => category.id === "utilities"),
    ).toMatchObject({ name: "Utilities", icon: "Plug", color: "green" });
  }, 30000);

  it("GET /months/:month returns plans + that month's actuals with progress (CR1-3)", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    // Housing actual 2,520 of 4,000 planned -> 63% (kit example), split into
    // two rows so the SUM(...) aggregation itself is exercised.
    await insertTransaction({
      userId,
      categoryId: "housing",
      amountMinor: 200000,
      occurredOn: "2026-07-05",
    });
    await insertTransaction({
      userId,
      categoryId: "housing",
      amountMinor: 52000,
      occurredOn: "2026-07-14",
    });

    const res = await client.request("/months/2026-07");
    expect(res.status).toBe(200);
    const { budget } = await res.json();

    expect(budget.month).toBe("2026-07");
    expect(budget.plannedMinor).toBe(1200000);
    expect(budget.availableMinor).toBe(50000);
    expect(budget.actualMinor).toBe(252000);
    const housing = budget.categories[0];
    expect(housing).toMatchObject({
      id: "housing",
      name: "Housing",
      icon: "House",
      color: "blue",
      plannedMinor: 400000,
      actualMinor: 252000,
      progressPercent: 63,
      state: "normal",
    });
  }, 30000);

  it("two months share identical plans with independent actuals (CR1-11)", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    await insertTransaction({
      userId,
      categoryId: "utilities",
      amountMinor: 72100,
      occurredOn: "2026-07-18",
    });

    const julyRes = await client.request("/months/2026-07");
    const mayRes = await client.request("/months/2026-05");
    expect(julyRes.status).toBe(200);
    expect(mayRes.status).toBe(200);
    const july = (await julyRes.json()).budget;
    const may = (await mayRes.json()).budget;

    expect(july.categories.map((c) => c.plannedMinor)).toEqual(
      may.categories.map((c) => c.plannedMinor),
    );
    expect(july.actualMinor).toBe(72100);
    // A month with zero expenses is a normal zero month, never a 404.
    expect(may.actualMinor).toBe(0);
    for (const category of may.categories) {
      expect(category.actualMinor).toBe(0);
    }
  }, 30000);

  it("includes first/last-day-of-month transactions and excludes adjacent months", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    await insertTransaction({
      userId,
      categoryId: "groceries",
      amountMinor: 1000,
      occurredOn: "2026-07-01",
    });
    await insertTransaction({
      userId,
      categoryId: "groceries",
      amountMinor: 2000,
      occurredOn: "2026-07-31",
    });
    await insertTransaction({
      userId,
      categoryId: "groceries",
      amountMinor: 40000,
      occurredOn: "2026-06-30",
    });

    const res = await client.request("/months/2026-07");
    const { budget } = await res.json();
    const groceries = budget.categories.find((category) => category.id === "groceries");
    expect(groceries.actualMinor).toBe(3000);
    expect(budget.actualMinor).toBe(3000);
  }, 30000);

  it("handles a zero-plan category with spending: no NaN/Infinity/500, state 'unplanned'", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    const patch = await client.request("/budget", {
      method: "PATCH",
      body: JSON.stringify({ categories: [{ id: "fun", plannedMinor: 0 }] }),
    });
    expect(patch.status).toBe(200);
    await insertTransaction({
      userId,
      categoryId: "fun",
      amountMinor: 5000,
      occurredOn: "2026-07-10",
    });

    const res = await client.request("/months/2026-07");
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
      const res = await client.request(`/months/${bad}`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    }
  }, 30000);

  it("rejects unauthenticated reads with 401", async () => {
    const anonymous = createCookieJarFetch(ctx.baseUrl);
    for (const path of ["/budget", "/months/2026-07"]) {
      const res = await anonymous.request(path);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHENTICATED");
    }
  }, 30000);

  it("never leaks another user's actuals: each account sees only its own months", async () => {
    const userA = await registerUser(ctx.baseUrl);
    const userB = await registerUser(ctx.baseUrl);
    await insertTransaction({
      userId: userA.userId,
      categoryId: "savings",
      amountMinor: 313370,
      occurredOn: "2026-03-15",
    });

    const res = await userB.client.request("/months/2026-03");
    expect(res.status).toBe(200);
    const { budget } = await res.json();
    expect(budget.actualMinor).toBe(0);
    expect(JSON.stringify(budget)).not.toContain(userA.userId);
  }, 30000);

  it("defensive path (CR1-11): missing budget row answers 404 and POST /budget recovers", async () => {
    const { client, userId } = await registerUser(ctx.baseUrl);
    // Simulate the data anomaly directly (unreachable through the API).
    await pool.query("DELETE FROM budgets WHERE user_id = $1", [userId]);

    for (const path of ["/budget", "/months/2026-07"]) {
      const res = await client.request(path);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBeTruthy();
    }

    const recreate = await client.request("/budget", { method: "POST" });
    expect(recreate.status).toBe(201);
    const { budget } = await recreate.json();
    expect(budget.plannedMinor).toBe(1200000);
    const after = await client.request("/months/2026-07");
    expect(after.status).toBe(200);
  }, 30000);

  it("enforces one budget per user at the database level (unique user_id)", async () => {
    const { userId } = await registerUser(ctx.baseUrl);
    await expect(
      pool.query(
        `INSERT INTO budgets (user_id, income_minor, categories)
         VALUES ($1, 1, '[]'::jsonb)`,
        [userId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  }, 30000);
});
