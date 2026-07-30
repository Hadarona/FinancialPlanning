import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
import { DEFAULT_CATEGORIES } from "../../src/domain/categories.js";

const PASSWORD = "supersecret1";
const NOTE_MARKER = "never-log-this-grocery-note";

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

// Remote Neon round-trips make these journeys slower than vitest's 5s
// default; the multi-request tests get a generous explicit timeout.
const SLOW_TEST_TIMEOUT = 30000;

describe("transactions API", () => {
  let ctx;
  let pool;

  async function registerUser() {
    const client = createCookieJarFetch(ctx.baseUrl);
    const res = await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail("tx"), password: PASSWORD }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    return { client, userId: body.user.id };
  }

  async function insertBudget(userId, month) {
    const result = await pool.query(
      `INSERT INTO budget_periods (user_id, month, income_minor, categories)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [userId, month, 1250000, JSON.stringify(DEFAULT_CATEGORIES)],
    );
    return result.rows[0].id;
  }

  async function createExpense(client, month, payload) {
    return client.request(`/budgets/${month}/transactions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function categoryActual(client, month, categoryId) {
    const res = await client.request(`/budgets/${month}`);
    expect(res.status).toBe(200);
    const { budget } = await res.json();
    return budget.categories.find((category) => category.id === categoryId).actualMinor;
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
    "creates, recalculates, deletes, and rolls the aggregate back (D-EXP-B1, D-EXP-Q1 enabler)",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-07");

      expect(await categoryActual(client, "2026-07", "groceries")).toBe(0);

      const createRes = await createExpense(client, "2026-07", {
        categoryId: "groceries",
        amountMinor: 4250,
        occurredOn: "2026-07-15",
        note: "Weekly shop",
      });
      expect(createRes.status).toBe(201);
      const { transaction } = await createRes.json();
      expect(transaction).toMatchObject({
        id: expect.any(String),
        categoryId: "groceries",
        amountMinor: 4250,
        occurredOn: "2026-07-15",
        note: "Weekly shop",
      });

      expect(await categoryActual(client, "2026-07", "groceries")).toBe(4250);

      const listRes = await client.request("/budgets/2026-07/transactions");
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.total).toBe(1);
      expect(listBody.transactions[0].id).toBe(transaction.id);

      const deleteRes = await client.request(
        `/budgets/2026-07/transactions/${transaction.id}`,
        {
          method: "DELETE",
        },
      );
      expect(deleteRes.status).toBe(204);
      expect(await categoryActual(client, "2026-07", "groceries")).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "sums minor units exactly: 1099 + 2101 = 3200, no float drift",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-07");

      for (const amountMinor of [1099, 2101]) {
        const res = await createExpense(client, "2026-07", {
          categoryId: "fun",
          amountMinor,
          occurredOn: "2026-07-10",
        });
        expect(res.status).toBe(201);
      }
      expect(await categoryActual(client, "2026-07", "fun")).toBe(3200);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "rejects every invalid payload without mutating anything (D-EXP-B2)",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-07");

      const badPayloads = [
        // Unknown category.
        {
          payload: { categoryId: "yachts", amountMinor: 100, occurredOn: "2026-07-10" },
          field: "categoryId",
        },
        // Date outside the month (previous, next, impossible day).
        {
          payload: { categoryId: "fun", amountMinor: 100, occurredOn: "2026-06-30" },
          field: "occurredOn",
        },
        {
          payload: { categoryId: "fun", amountMinor: 100, occurredOn: "2026-08-01" },
          field: "occurredOn",
        },
        {
          payload: { categoryId: "fun", amountMinor: 100, occurredOn: "2026-07-32" },
          field: "occurredOn",
        },
        // Non-positive / non-integer / malformed amounts.
        {
          payload: { categoryId: "fun", amountMinor: 0, occurredOn: "2026-07-10" },
          field: "amountMinor",
        },
        {
          payload: { categoryId: "fun", amountMinor: -500, occurredOn: "2026-07-10" },
          field: "amountMinor",
        },
        {
          payload: { categoryId: "fun", amountMinor: 10.5, occurredOn: "2026-07-10" },
          field: "amountMinor",
        },
        {
          payload: { categoryId: "fun", amountMinor: "100", occurredOn: "2026-07-10" },
          field: "amountMinor",
        },
        // Oversized note.
        {
          payload: {
            categoryId: "fun",
            amountMinor: 100,
            occurredOn: "2026-07-10",
            note: "x".repeat(201),
          },
          field: "note",
        },
        // Unknown key (strict schema).
        {
          payload: {
            categoryId: "fun",
            amountMinor: 100,
            occurredOn: "2026-07-10",
            isAdmin: true,
          },
          field: null,
        },
      ];

      for (const { payload, field } of badPayloads) {
        const res = await createExpense(client, "2026-07", payload);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        if (field) {
          expect(body.error.fieldErrors[field]).toBeTruthy();
        }
      }

      const listRes = await client.request("/budgets/2026-07/transactions");
      const listBody = await listRes.json();
      expect(listBody.total).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "makes retries idempotent via clientRequestId: one row, 201 then 200 (D-EXP-B6)",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-07");
      const clientRequestId = randomUUID();
      const payload = {
        categoryId: "transport",
        amountMinor: 1500,
        occurredOn: "2026-07-12",
        clientRequestId,
      };

      const first = await createExpense(client, "2026-07", payload);
      expect(first.status).toBe(201);
      const firstBody = await first.json();

      const retry = await createExpense(client, "2026-07", payload);
      expect(retry.status).toBe(200);
      const retryBody = await retry.json();
      expect(retryBody.transaction.id).toBe(firstBody.transaction.id);

      const listRes = await client.request("/budgets/2026-07/transactions");
      const listBody = await listRes.json();
      expect(listBody.total).toBe(1);
      expect(await categoryActual(client, "2026-07", "transport")).toBe(1500);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "blocks cross-user add and delete: 404, nothing leaks or mutates (D-EXP-B3/B4)",
    async () => {
      const userA = await registerUser();
      const userB = await registerUser();
      await insertBudget(userA.userId, "2026-04");
      await insertBudget(userB.userId, "2026-04");

      const created = await createExpense(userA.client, "2026-04", {
        categoryId: "housing",
        amountMinor: 9999,
        occurredOn: "2026-04-02",
      });
      const { transaction } = await created.json();

      // B cannot delete A's transaction even though B owns a budget that month.
      const crossDelete = await userB.client.request(
        `/budgets/2026-04/transactions/${transaction.id}`,
        { method: "DELETE" },
      );
      expect(crossDelete.status).toBe(404);
      const crossBody = await crossDelete.json();
      expect(crossBody.error.code).toBe("NOT_FOUND");

      // A's data is untouched; B's own month stays empty.
      expect(await categoryActual(userA.client, "2026-04", "housing")).toBe(9999);
      expect(await categoryActual(userB.client, "2026-04", "housing")).toBe(0);

      // Adding to a month where the user has no budget is a plain 404.
      const noBudget = await createExpense(userB.client, "2026-03", {
        categoryId: "housing",
        amountMinor: 100,
        occurredOn: "2026-03-05",
      });
      expect(noBudget.status).toBe(404);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "returns the same 404 body for nonexistent and malformed transaction ids",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-07");

      const missing = await client.request(
        `/budgets/2026-07/transactions/${randomUUID()}`,
        {
          method: "DELETE",
        },
      );
      const malformed = await client.request("/budgets/2026-07/transactions/not-a-uuid", {
        method: "DELETE",
      });
      expect(missing.status).toBe(404);
      expect(malformed.status).toBe(404);
      const missingBody = await missing.json();
      const malformedBody = await malformed.json();
      delete missingBody.error.requestId;
      delete malformedBody.error.requestId;
      expect(malformedBody).toEqual(missingBody);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "paginates with enforced bounds and deterministic ordering",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-07");

      // Same-day rows exercise the created_at/id tiebreakers.
      const days = ["2026-07-03", "2026-07-03", "2026-07-05", "2026-07-01", "2026-07-05"];
      for (const [index, occurredOn] of days.entries()) {
        const res = await createExpense(client, "2026-07", {
          categoryId: "groceries",
          amountMinor: 100 + index,
          occurredOn,
        });
        expect(res.status).toBe(201);
      }

      const pageOne = await client.request(
        "/budgets/2026-07/transactions?limit=2&offset=0",
      );
      const pageOneBody = await pageOne.json();
      expect(pageOneBody.total).toBe(5);
      expect(pageOneBody.transactions).toHaveLength(2);
      expect(pageOneBody.limit).toBe(2);

      const pageAll = await client.request("/budgets/2026-07/transactions");
      const allBody = await pageAll.json();
      const dates = allBody.transactions.map((transaction) => transaction.occurredOn);
      expect(dates).toEqual([...dates].sort().reverse());
      // Page 1 is exactly the first two of the full deterministic ordering.
      expect(pageOneBody.transactions.map((t) => t.id)).toEqual(
        allBody.transactions.slice(0, 2).map((t) => t.id),
      );

      const tooBig = await client.request("/budgets/2026-07/transactions?limit=500");
      expect(tooBig.status).toBe(400);
      const negativeOffset = await client.request(
        "/budgets/2026-07/transactions?offset=-1",
      );
      expect(negativeOffset.status).toBe(400);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "never writes expense notes into the request/error logs (D-EXP-B5)",
    async () => {
      const { client, userId } = await registerUser();
      await insertBudget(userId, "2026-05");
      const res = await createExpense(client, "2026-05", {
        categoryId: "groceries",
        amountMinor: 777,
        occurredOn: "2026-05-05",
        note: NOTE_MARKER,
      });
      expect(res.status).toBe(201);

      const requestEntries = await ctx.readLogFile("requests.log");
      const errorEntries = await ctx.readLogFile("error.log");
      expect(JSON.stringify(requestEntries)).not.toContain(NOTE_MARKER);
      expect(JSON.stringify(errorEntries)).not.toContain(NOTE_MARKER);
      // The request itself was logged (metadata only).
      expect(
        requestEntries.some(
          (entry) =>
            entry.method === "POST" && String(entry.route).includes("/transactions"),
        ),
      ).toBe(true);
    },
    SLOW_TEST_TIMEOUT,
  );
});
