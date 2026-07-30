import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";

const PASSWORD = "supersecret1";
const SLOW_TEST_TIMEOUT = 30000;

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

/** Kit default plans (4,000/1,500/800/900/3,000 => planned 10,200). */
function defaultPlans(overrides = {}) {
  const base = {
    housing: 400000,
    groceries: 150000,
    transport: 80000,
    fun: 90000,
    savings: 300000,
  };
  return Object.entries({ ...base, ...overrides }).map(([id, plannedMinor]) => ({
    id,
    plannedMinor,
  }));
}

describe("budget create/update API", () => {
  let ctx;

  async function registerUser() {
    const client = createCookieJarFetch(ctx.baseUrl);
    const res = await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail("plan"), password: PASSWORD }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    return { client, userId: body.user.id };
  }

  async function createBudget(client, body) {
    return client.request("/budgets", { method: "POST", body: JSON.stringify(body) });
  }

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000, RATE_LIMIT_MAX: 5000 });
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  it(
    "creates exactly one owned budget and returns the read model (D-PLN-B1)",
    async () => {
      const { client } = await registerUser();
      const res = await createBudget(client, {
        month: "2026-07",
        incomeMinor: 1250000,
        categories: defaultPlans(),
      });
      expect(res.status).toBe(201);
      const { budget } = await res.json();
      expect(budget).toMatchObject({
        month: "2026-07",
        incomeMinor: 1250000,
        plannedMinor: 1020000,
        availableMinor: 230000,
        actualMinor: 0,
      });
      // Server-side constants fill the metadata; the client never sent them.
      expect(budget.categories[0]).toMatchObject({
        id: "housing",
        name: "Housing",
        icon: "House",
        color: "blue",
        displayOrder: 1,
        plannedMinor: 400000,
      });

      // Persisted: a follow-up GET returns the same read model.
      const getRes = await client.request("/budgets/2026-07");
      expect(getRes.status).toBe(200);
      const fetched = await getRes.json();
      expect(fetched.budget.id).toBe(budget.id);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "resolves concurrent duplicate creation as one 201 + one 409, no duplicates (D-PLN-B2)",
    async () => {
      const { client } = await registerUser();
      const body = { month: "2026-08", incomeMinor: 1000000, categories: defaultPlans() };

      const [first, second] = await Promise.all([
        createBudget(client, body),
        createBudget(client, body),
      ]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflict = first.status === 409 ? first : second;
      const conflictBody = await conflict.json();
      expect(conflictBody.error.code).toBe("CONFLICT");

      const getRes = await client.request("/budgets/2026-08");
      expect(getRes.status).toBe(200);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "recalculates the summary from stored fields after a patch (D-PLN-B3)",
    async () => {
      const { client } = await registerUser();
      await createBudget(client, {
        month: "2026-07",
        incomeMinor: 1250000,
        categories: defaultPlans(),
      });

      const patchRes = await client.request("/budgets/2026-07", {
        method: "PATCH",
        body: JSON.stringify({
          incomeMinor: 1300000,
          categories: [{ id: "fun", plannedMinor: 120000 }],
        }),
      });
      expect(patchRes.status).toBe(200);
      const { budget } = await patchRes.json();
      expect(budget.incomeMinor).toBe(1300000);
      // 10,200 - 900 + 1,200 = 10,500 planned; 13,000 - 10,500 = 2,500.
      expect(budget.plannedMinor).toBe(1050000);
      expect(budget.availableMinor).toBe(250000);
      // Untouched categories keep their plans; the set never shrinks.
      expect(budget.categories).toHaveLength(5);
      expect(budget.categories.find((c) => c.id === "housing").plannedMinor).toBe(400000);

      const getRes = await client.request("/budgets/2026-07");
      const fetched = await getRes.json();
      expect(fetched.budget.plannedMinor).toBe(1050000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "rejects invalid category sets and amounts without mutation (D-PLN-B4)",
    async () => {
      const { client } = await registerUser();

      const badBodies = [
        // Unknown category id.
        { month: "2026-07", incomeMinor: 1, categories: defaultPlans().map((c) => (c.id === "fun" ? { ...c, id: "yachts" } : c)) },
        // Duplicate ids (still 5 entries).
        {
          month: "2026-07",
          incomeMinor: 1,
          categories: [...defaultPlans().slice(0, 4), { id: "housing", plannedMinor: 1 }],
        },
        // Missing a category.
        { month: "2026-07", incomeMinor: 1, categories: defaultPlans().slice(0, 4) },
        // Negative and non-integer amounts.
        { month: "2026-07", incomeMinor: 1, categories: defaultPlans({ fun: -100 }) },
        { month: "2026-07", incomeMinor: 1, categories: defaultPlans({ fun: 10.5 }) },
        // Negative / non-integer income.
        { month: "2026-07", incomeMinor: -1, categories: defaultPlans() },
        { month: "2026-07", incomeMinor: 100.5, categories: defaultPlans() },
        // Client-supplied metadata is rejected outright (strict schema).
        {
          month: "2026-07",
          incomeMinor: 1,
          categories: defaultPlans().map((c) =>
            c.id === "fun" ? { ...c, name: "Hacked" } : c,
          ),
        },
        // Malformed month.
        { month: "2026-7", incomeMinor: 1, categories: defaultPlans() },
      ];

      for (const body of badBodies) {
        const res = await createBudget(client, body);
        expect(res.status).toBe(400);
        const parsed = await res.json();
        expect(parsed.error.code).toBe("VALIDATION_ERROR");
      }

      // Nothing was created.
      const getRes = await client.request("/budgets/2026-07");
      expect(getRes.status).toBe(404);

      // A patch with an empty body is also rejected.
      await createBudget(client, {
        month: "2026-07",
        incomeMinor: 1250000,
        categories: defaultPlans(),
      });
      const emptyPatch = await client.request("/budgets/2026-07", {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      expect(emptyPatch.status).toBe(400);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "cannot create or update another user's budget (D-PLN-B6)",
    async () => {
      const userA = await registerUser();
      const userB = await registerUser();

      // Creation is bound to the session user by construction: the body has
      // no user field, so A creating a month only ever creates A's budget.
      await createBudget(userA.client, {
        month: "2026-09",
        incomeMinor: 500000,
        categories: defaultPlans(),
      });

      // B patching a month only A owns -> 404, and A's budget is untouched.
      const crossPatch = await userB.client.request("/budgets/2026-09", {
        method: "PATCH",
        body: JSON.stringify({ incomeMinor: 1 }),
      });
      expect(crossPatch.status).toBe(404);

      const getA = await userA.client.request("/budgets/2026-09");
      const bodyA = await getA.json();
      expect(bodyA.budget.incomeMinor).toBe(500000);

      // B can still create its own budget for the same month.
      const createB = await createBudget(userB.client, {
        month: "2026-09",
        incomeMinor: 700000,
        categories: defaultPlans(),
      });
      expect(createB.status).toBe(201);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "accepts over-allocation: planned > income yields a negative available (decision #2)",
    async () => {
      const { client } = await registerUser();
      const res = await createBudget(client, {
        month: "2026-10",
        incomeMinor: 900000,
        categories: defaultPlans(),
      });
      expect(res.status).toBe(201);
      const { budget } = await res.json();
      expect(budget.plannedMinor).toBe(1020000);
      expect(budget.availableMinor).toBe(-120000);
    },
    SLOW_TEST_TIMEOUT,
  );
});
