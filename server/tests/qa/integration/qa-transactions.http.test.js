// QA-SI-40..51: real-HTTP expense (transaction) coverage against an isolated schema.
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
import {
  kitBudgetPayload,
  expensePayload,
  looksLikeUuid,
} from "../helpers/qaFixtures.js";

// Remote Neon round-trips make multi-request journeys slower than vitest's
// 5s default test timeout.
const SLOW_TEST_TIMEOUT = 30000;

describe("QA-SI: transactions http", () => {
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

  async function seedBudget(session, month = "2026-07") {
    const res = await session.request("/budgets", {
      method: "POST",
      body: kitBudgetPayload(month),
    });
    return mustJson(res, 201);
  }

  it(
    "QA-SI-40: a created expense has the documented shape and is reflected in the budget + list totals",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      const before = await mustJson(await session.request("/budgets/2026-07"), 200);

      const createRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "groceries",
          amountMinor: 4250,
          occurredOn: "2026-07-10",
          note: "weekly shop",
        }),
      });
      const createBody = await mustJson(createRes, 201);
      const { transaction } = createBody;
      expect(Object.keys(transaction).sort()).toEqual(
        ["amountMinor", "categoryId", "createdAt", "id", "note", "occurredOn"].sort(),
      );
      expect(looksLikeUuid(transaction.id)).toBe(true);
      expect(transaction.categoryId).toBe("groceries");
      expect(transaction.amountMinor).toBe(4250);
      expect(transaction.occurredOn).toBe("2026-07-10");
      expect(transaction.note).toBe("weekly shop");

      const after = await mustJson(await session.request("/budgets/2026-07"), 200);
      const groceriesBefore = before.budget.categories.find((c) => c.id === "groceries");
      const groceriesAfter = after.budget.categories.find((c) => c.id === "groceries");
      expect(groceriesAfter.actualMinor).toBe(groceriesBefore.actualMinor + 4250);
      expect(after.budget.actualMinor).toBe(before.budget.actualMinor + 4250);
      const expectedProgress = Math.round(
        (groceriesAfter.actualMinor / groceriesAfter.plannedMinor) * 100,
      );
      expect(groceriesAfter.progressPercent).toBe(expectedProgress);

      const listRes = await session.request("/budgets/2026-07/transactions");
      const listBody = await mustJson(listRes, 200);
      expect(listBody.total).toBe(1);
      expect(listBody.transactions).toHaveLength(1);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-41: deleting an expense restores the budget to its exact pre-add snapshot",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      const snapshot = await mustJson(await session.request("/budgets/2026-07"), 200);

      const createRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", amountMinor: 5000 }),
      });
      const { transaction } = await mustJson(createRes, 201);

      const deleteRes = await session.request(
        `/budgets/2026-07/transactions/${transaction.id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(204);

      const after = await mustJson(await session.request("/budgets/2026-07"), 200);
      expect(after).toEqual(snapshot);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-42: many small amounts sum exactly with no floating-point drift",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      let expectedTotal = 0;
      for (let i = 0; i < 10; i += 1) {
        await session.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: expensePayload({
            month: "2026-07",
            categoryId: "housing",
            amountMinor: 10,
          }),
        });
        expectedTotal += 10;
      }
      for (let i = 0; i < 3; i += 1) {
        await session.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: expensePayload({
            month: "2026-07",
            categoryId: "housing",
            amountMinor: 3333,
          }),
        });
        expectedTotal += 3333;
      }
      const bigRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "housing",
          amountMinor: 99999999,
        }),
      });
      expect(bigRes.status).toBe(201);
      expectedTotal += 99999999;

      expect(expectedTotal).toBe(100 + 9999 + 99999999);
      const body = await mustJson(await session.request("/budgets/2026-07"), 200);
      const housing = body.budget.categories.find((c) => c.id === "housing");
      expect(housing.actualMinor).toBe(expectedTotal);
      expect(Number.isInteger(housing.actualMinor)).toBe(true);
      expect(Number.isInteger(body.budget.actualMinor)).toBe(true);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-43: invalid expense bodies are all rejected with the right field and never stored",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");

      const cases = [
        [{ amountMinor: 0 }, "amountMinor"],
        [{ amountMinor: -5 }, "amountMinor"],
        [{ amountMinor: 10.5 }, "amountMinor"],
        [{ amountMinor: "10" }, "amountMinor"],
        [{ categoryId: "phones" }, "categoryId"],
        [{ note: "n".repeat(201) }, "note"],
      ];
      for (const [overrides] of cases) {
        const res = await session.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: expensePayload({ month: "2026-07", ...overrides }),
        });
        expect(res.status).toBe(400);
      }
      const unknownKeyRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: { ...expensePayload({ month: "2026-07" }), unknownKey: 1 },
      });
      expect(unknownKeyRes.status).toBe(400);

      const listBody = await mustJson(
        await session.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(listBody.total).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-44: occurredOn at the month's first/last day is accepted; outside the month is rejected",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");

      const firstDay = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", occurredOn: "2026-07-01" }),
      });
      expect(firstDay.status).toBe(201);
      const lastDay = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", occurredOn: "2026-07-31" }),
      });
      expect(lastDay.status).toBe(201);

      for (const occurredOn of ["2026-06-30", "2026-08-01", "2026-07-32"]) {
        const res = await session.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: expensePayload({ month: "2026-07", occurredOn }),
        });
        expect(res.status, occurredOn).toBe(400);
        const body = await mustJson(res, 400);
        expect(body.error.fieldErrors?.occurredOn, occurredOn).toBeTruthy();
      }
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-45: a repeated clientRequestId is idempotent (201 then 200, same row, one total)",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      const clientRequestId = randomUUID();
      const body = expensePayload({ month: "2026-07", clientRequestId });

      const firstRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body,
      });
      const firstBody = await mustJson(firstRes, 201);

      const secondRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body,
      });
      const secondBody = await mustJson(secondRes, 200);
      expect(secondBody.transaction.id).toBe(firstBody.transaction.id);

      const listBody = await mustJson(
        await session.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(listBody.total).toBe(1);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-46: two concurrent identical requests never create two rows",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      const clientRequestId = randomUUID();
      const body = expensePayload({
        month: "2026-07",
        clientRequestId,
        amountMinor: 777,
      });

      const [resA, resB] = await Promise.all([
        session.request("/budgets/2026-07/transactions", { method: "POST", body }),
        session.request("/budgets/2026-07/transactions", { method: "POST", body }),
      ]);
      const statuses = [resA.status, resB.status].sort();
      expect(statuses[0]).toBeLessThan(300);
      expect(statuses[1]).toBeLessThan(300);
      const bodyA = await mustJson(resA);
      const bodyB = await mustJson(resB);
      expect(bodyA.transaction.id).toBe(bodyB.transaction.id);

      const listBody = await mustJson(
        await session.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(listBody.total).toBe(1);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-47: pagination partitions a stable order and enforces documented bounds/defaults",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      const dates = [
        "2026-07-01",
        "2026-07-05",
        "2026-07-10",
        "2026-07-15",
        "2026-07-20",
      ];
      for (const occurredOn of dates) {
        await session.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: expensePayload({ month: "2026-07", occurredOn }),
        });
      }
      const full = await mustJson(
        await session.request("/budgets/2026-07/transactions?limit=200&offset=0"),
        200,
      );
      expect(full.total).toBe(5);
      const expectedOrder = [...full.transactions].sort((a, b) => {
        if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? 1 : -1;
        if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
      expect(full.transactions.map((t) => t.id)).toEqual(expectedOrder.map((t) => t.id));

      const window1 = await mustJson(
        await session.request("/budgets/2026-07/transactions?limit=2&offset=0"),
        200,
      );
      const window2 = await mustJson(
        await session.request("/budgets/2026-07/transactions?limit=2&offset=2"),
        200,
      );
      const window3 = await mustJson(
        await session.request("/budgets/2026-07/transactions?limit=2&offset=4"),
        200,
      );
      expect(window1.total).toBe(5);
      expect(window2.total).toBe(5);
      expect(window3.total).toBe(5);
      const partitioned = [
        ...window1.transactions,
        ...window2.transactions,
        ...window3.transactions,
      ];
      expect(partitioned.map((t) => t.id)).toEqual(full.transactions.map((t) => t.id));

      const tooLarge = await session.request("/budgets/2026-07/transactions?limit=201");
      expect(tooLarge.status).toBe(400);

      const defaults = await mustJson(
        await session.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(defaults.limit).toBe(50);
      expect(defaults.offset).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-48: deleting a missing UUID and a malformed id both resolve to the same 404 (no 500/400)",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");

      const missingRes = await session.request(
        `/budgets/2026-07/transactions/${randomUUID()}`,
        { method: "DELETE" },
      );
      const missingBody = await mustJson(missingRes, 404);

      const malformedRes = await session.request("/budgets/2026-07/transactions/abc", {
        method: "DELETE",
      });
      const malformedBody = await mustJson(malformedRes, 404);

      delete missingBody.error.requestId;
      delete malformedBody.error.requestId;
      expect(malformedBody).toEqual(missingBody);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-49: another user cannot create in, or delete from, my budget",
    async () => {
      const userA = await freshUserSession();
      await seedBudget(userA, "2026-07");
      const createRes = await userA.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07" }),
      });
      const { transaction } = await mustJson(createRes, 201);

      const userB = await freshUserSession();
      const createAsB = await userB.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07" }),
      });
      expect(createAsB.status).toBe(404);

      await seedBudget(userB, "2026-07");
      const deleteAsB = await userB.request(
        `/budgets/2026-07/transactions/${transaction.id}`,
        { method: "DELETE" },
      );
      expect(deleteAsB.status).toBe(404);

      const listAsA = await mustJson(
        await userA.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(listAsA.transactions.some((t) => t.id === transaction.id)).toBe(true);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-50: an expense for a month with no budget is rejected as not found",
    async () => {
      const session = await freshUserSession();
      const res = await session.request("/budgets/2026-05/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-05" }),
      });
      const body = await mustJson(res, 404);
      expect(body.error.code).toBe("NOT_FOUND");
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-51: expense notes and amounts never appear in the request/error logs",
    async () => {
      const session = await freshUserSession();
      await seedBudget(session, "2026-07");
      const marker = `QA-NOTE-${randomUUID().slice(0, 8)}`;
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", amountMinor: 123456, note: marker }),
      });

      const entries = await ctx.readLogEntries("requests.log");
      const serialized = JSON.stringify(entries);
      expect(serialized).not.toContain(marker);
      expect(serialized).not.toContain("123456");
      const matchingRoute = entries.find(
        (entry) =>
          typeof entry.route === "string" && entry.route.includes("/transactions"),
      );
      expect(matchingRoute).toBeTruthy();
    },
    SLOW_TEST_TIMEOUT,
  );
});
