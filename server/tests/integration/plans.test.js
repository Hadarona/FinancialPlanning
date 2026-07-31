import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";

const PASSWORD = "supersecret1";
const SLOW_TEST_TIMEOUT = 30000;

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

// CR-001: the per-month create/duplicate-month/month-concurrency semantics
// are superseded by the single-budget lifecycle: registration provisions the
// default budget, POST /budget is the defensive re-create (409 when one
// exists), and PATCH /budget edits income/plans in place.
describe("single-budget lifecycle (CR-001)", () => {
  let ctx;
  let pool;

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

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000, RATE_LIMIT_MAX: 5000 });
    const { createPool } = await import("../../src/db/pool.js");
    pool = createPool(ctx.config);
  }, 30000);

  afterAll(async () => {
    await pool.end();
    await ctx.close();
  });

  it(
    "POST /budget answers 409 CONFLICT while a budget exists (CR1-2)",
    async () => {
      const { client } = await registerUser();
      const res = await client.request("/budget", { method: "POST" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("CONFLICT");
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "resolves concurrent defensive re-creates as one 201 + one 409 (unique user_id)",
    async () => {
      const { client, userId } = await registerUser();
      await pool.query("DELETE FROM budgets WHERE user_id = $1", [userId]);

      const [first, second] = await Promise.all([
        client.request("/budget", { method: "POST" }),
        client.request("/budget", { method: "POST" }),
      ]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([201, 409]);

      const count = await pool.query(
        "SELECT COUNT(*)::int AS total FROM budgets WHERE user_id = $1",
        [userId],
      );
      expect(count.rows[0].total).toBe(1);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "POST /budget strictly rejects any body (defaults are server constants)",
    async () => {
      const { client } = await registerUser();
      const res = await client.request("/budget", {
        method: "POST",
        body: JSON.stringify({ incomeMinor: 999999 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "recalculates the summary from stored fields after a patch (CR1-5/6)",
    async () => {
      const { client } = await registerUser();

      const patchRes = await client.request("/budget", {
        method: "PATCH",
        body: JSON.stringify({
          incomeMinor: 1300000,
          categories: [{ id: "fun", plannedMinor: 120000 }],
        }),
      });
      expect(patchRes.status).toBe(200);
      const { budget } = await patchRes.json();
      expect(budget.incomeMinor).toBe(1300000);
      // 12,000 - 900 + 1,200 = 12,300 planned; 13,000 - 12,300 = 700.
      expect(budget.plannedMinor).toBe(1230000);
      expect(budget.availableMinor).toBe(70000);
      // Untouched categories keep their plans; the set never shrinks.
      expect(budget.categories).toHaveLength(7);
      expect(budget.categories.find((c) => c.id === "housing").plannedMinor).toBe(400000);
      expect(budget.categories.find((c) => c.id === "utilities").plannedMinor).toBe(
        120000,
      );

      const getRes = await client.request("/budget");
      const fetched = await getRes.json();
      expect(fetched.budget.plannedMinor).toBe(1230000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "accepts a patch across all seven categories, including the new ones (CR2-3)",
    async () => {
      const { client } = await registerUser();
      const seven = [
        { id: "housing", plannedMinor: 100000 },
        { id: "groceries", plannedMinor: 100000 },
        { id: "transport", plannedMinor: 100000 },
        { id: "fun", plannedMinor: 100000 },
        { id: "savings", plannedMinor: 100000 },
        { id: "subscriptions", plannedMinor: 100000 },
        { id: "utilities", plannedMinor: 100000 },
      ];
      const res = await client.request("/budget", {
        method: "PATCH",
        body: JSON.stringify({ categories: seven }),
      });
      expect(res.status).toBe(200);
      const { budget } = await res.json();
      expect(budget.plannedMinor).toBe(700000);
      expect(budget.categories.every((c) => c.plannedMinor === 100000)).toBe(true);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "concurrent patches both succeed and leave a consistent stored budget",
    async () => {
      const { client, userId } = await registerUser();
      const [first, second] = await Promise.all([
        client.request("/budget", {
          method: "PATCH",
          body: JSON.stringify({ categories: [{ id: "housing", plannedMinor: 111100 }] }),
        }),
        client.request("/budget", {
          method: "PATCH",
          body: JSON.stringify({ categories: [{ id: "savings", plannedMinor: 222200 }] }),
        }),
      ]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const stored = await pool.query(
        "SELECT categories FROM budgets WHERE user_id = $1",
        [userId],
      );
      const categories = stored.rows[0].categories;
      // Exactly one budgets row, still seven well-formed categories; each
      // patched value is one of the two submitted outcomes (last write wins
      // per full-row update, but the row can never interleave into an
      // invalid shape).
      expect(categories).toHaveLength(7);
      const byId = Object.fromEntries(categories.map((c) => [c.id, c.plannedMinor]));
      expect([111100, 400000]).toContain(byId.housing);
      expect([222200, 300000]).toContain(byId.savings);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "rejects invalid patches without mutation (D-PLN-B4 semantics kept)",
    async () => {
      const { client } = await registerUser();

      const badBodies = [
        // Unknown category id.
        { categories: [{ id: "yachts", plannedMinor: 1 }] },
        // Duplicate ids.
        {
          categories: [
            { id: "housing", plannedMinor: 1 },
            { id: "housing", plannedMinor: 2 },
          ],
        },
        // Eight entries can never be unique over seven ids.
        {
          categories: [
            "housing",
            "groceries",
            "transport",
            "fun",
            "savings",
            "subscriptions",
            "utilities",
            "housing",
          ].map((id) => ({ id, plannedMinor: 1 })),
        },
        // Negative and non-integer amounts.
        { categories: [{ id: "fun", plannedMinor: -100 }] },
        { categories: [{ id: "fun", plannedMinor: 10.5 }] },
        // Negative / non-integer income.
        { incomeMinor: -1 },
        { incomeMinor: 100.5 },
        // Client-supplied metadata is rejected outright (strict schema).
        { categories: [{ id: "fun", plannedMinor: 1, name: "Hacked" }] },
        // The old per-month field no longer exists.
        { month: "2026-07", incomeMinor: 1 },
        // Empty patch.
        {},
      ];

      for (const body of badBodies) {
        const res = await client.request("/budget", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
        const parsed = await res.json();
        expect(parsed.error.code).toBe("VALIDATION_ERROR");
      }

      // Nothing was mutated: the defaults are intact.
      const getRes = await client.request("/budget");
      const fetched = await getRes.json();
      expect(fetched.budget.incomeMinor).toBe(1250000);
      expect(fetched.budget.plannedMinor).toBe(1200000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "cannot update another user's budget (ownership by session, REG-3)",
    async () => {
      const userA = await registerUser();
      const userB = await registerUser();

      // The PATCH is bound to the session user by construction; B's patch
      // touches only B's budget.
      const patchB = await userB.client.request("/budget", {
        method: "PATCH",
        body: JSON.stringify({ incomeMinor: 1 }),
      });
      expect(patchB.status).toBe(200);

      const getA = await userA.client.request("/budget");
      const bodyA = await getA.json();
      expect(bodyA.budget.incomeMinor).toBe(1250000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "accepts over-allocation: planned > income yields a negative available (decision #2)",
    async () => {
      const { client } = await registerUser();
      const res = await client.request("/budget", {
        method: "PATCH",
        body: JSON.stringify({ incomeMinor: 900000 }),
      });
      expect(res.status).toBe(200);
      const { budget } = await res.json();
      expect(budget.plannedMinor).toBe(1200000);
      expect(budget.availableMinor).toBe(-300000);
    },
    SLOW_TEST_TIMEOUT,
  );
});
