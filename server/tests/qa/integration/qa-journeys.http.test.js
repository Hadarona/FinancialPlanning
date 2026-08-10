// QA-RJ-01..09: roadmap §7.2 regression journeys as sequential real-HTTP
// scenarios, one fresh user per journey, sharing one server.
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
import { kitBudgetPayload, expensePayload } from "../helpers/qaFixtures.js";

// Remote Neon round-trips make multi-request journeys slower than vitest's
// 5s default test timeout.
const SLOW_TEST_TIMEOUT = 30000;

describe("QA-RJ: roadmap regression journeys", () => {
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

  it(
    "QA-RJ-01: register -> me -> logout -> me follows the documented auth lifecycle",
    async () => {
      const session = createSession(ctx.baseUrl);
      const email = `qa-rj01-${randomUUID().slice(0, 8)}@example.com`;
      const registerRes = await session.request("/auth/register", {
        method: "POST",
        body: { email, password: "QaPassword1!" },
      });
      await mustJson(registerRes, 201);

      const meRes = await session.request("/auth/me");
      const meBody = await mustJson(meRes, 200);
      expect(meBody.user.email).toBe(email);

      const logoutRes = await session.request("/auth/logout", { method: "POST" });
      expect(logoutRes.status).toBe(204);

      const meAfterRes = await session.request("/auth/me");
      expect(meAfterRes.status).toBe(401);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-02: a fresh user's first budget requires no seed data and reads back correctly",
    async () => {
      const session = await freshUserSession();
      const missingRes = await session.request("/budgets/2026-07");
      expect(missingRes.status).toBe(404);

      const createRes = await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const createBody = await mustJson(createRes, 201);
      expect(createBody.budget.plannedMinor).toBe(1020000);
      expect(createBody.budget.availableMinor).toBe(230000);

      const getRes = await session.request("/budgets/2026-07");
      const getBody = await mustJson(getRes, 200);
      expect(getBody).toEqual(createBody);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-03: editing income then one plan recalculates the totals both times",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });

      const incomeRes = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: { incomeMinor: 1500000 },
      });
      const incomeBody = await mustJson(incomeRes, 200);
      expect(incomeBody.budget.incomeMinor).toBe(1500000);
      expect(incomeBody.budget.availableMinor).toBe(1500000 - 1020000);

      const planRes = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: { categories: [{ id: "savings", plannedMinor: 400000 }] },
      });
      const planBody = await mustJson(planRes, 200);
      const expectedPlanned = 400000 + 150000 + 80000 + 90000 + 400000;
      expect(planBody.budget.plannedMinor).toBe(expectedPlanned);
      expect(planBody.budget.availableMinor).toBe(1500000 - expectedPlanned);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-04 + QA-RJ-05: add expense updates progress + total, delete restores the exact pre-add snapshot",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const snapshot = await mustJson(await session.request("/budgets/2026-07"), 200);

      const createRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "housing",
          amountMinor: 100000,
        }),
      });
      const { transaction } = await mustJson(createRes, 201);

      const afterAdd = await mustJson(await session.request("/budgets/2026-07"), 200);
      const housingAfterAdd = afterAdd.budget.categories.find((c) => c.id === "housing");
      expect(housingAfterAdd.actualMinor).toBe(100000);
      expect(housingAfterAdd.progressPercent).toBe(Math.round((100000 / 400000) * 100));
      expect(afterAdd.budget.actualMinor).toBe(100000);

      const deleteRes = await session.request(
        `/budgets/2026-07/transactions/${transaction.id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(204);

      const afterDelete = await mustJson(await session.request("/budgets/2026-07"), 200);
      expect(afterDelete).toEqual(snapshot);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-06: switching from an existing month to an empty adjacent month is a clear 200 then 404",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });

      const existingRes = await session.request("/budgets/2026-07");
      expect(existingRes.status).toBe(200);

      const emptyRes = await session.request("/budgets/2026-08");
      expect(emptyRes.status).toBe(404);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-07: insights reconcile fully across totals, category sums, cumulative ends, and shares",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-06"),
      });
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "housing",
          amountMinor: 200000,
          occurredOn: "2026-07-05",
        }),
      });
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "groceries",
          amountMinor: 50000,
          occurredOn: "2026-07-20",
        }),
      });

      const body = await mustJson(await session.request("/insights/2026-07"), 200);
      const { insights } = body;
      const sumCategories = insights.categories.reduce(
        (sum, c) => sum + c.currentMinor,
        0,
      );
      expect(sumCategories).toBe(insights.currentTotalMinor);
      expect(insights.cashFlow.currentCumulativeMinor.at(-1)).toBe(
        insights.currentTotalMinor,
      );
      const shareSum = insights.categories.reduce((sum, c) => sum + c.sharePercent, 0);
      expect(shareSum).toBe(100);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-08: a second user's every private attempt against the first user's data is rejected, with zero mutation",
    async () => {
      const userA = await freshUserSession();
      await userA.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const txRes = await userA.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07" }),
      });
      const { transaction } = await mustJson(txRes, 201);
      const beforeA = await mustJson(await userA.request("/budgets/2026-07"), 200);

      const userB = await freshUserSession();
      const matrix = [
        { method: "GET", path: "/budgets/2026-07" },
        { method: "PATCH", path: "/budgets/2026-07", body: { incomeMinor: 1 } },
        { method: "GET", path: "/budgets/2026-07/transactions" },
        {
          method: "POST",
          path: "/budgets/2026-07/transactions",
          body: expensePayload({ month: "2026-07" }),
        },
        { method: "DELETE", path: `/budgets/2026-07/transactions/${transaction.id}` },
        { method: "GET", path: "/insights/2026-07" },
      ];
      for (const { method, path, body } of matrix) {
        const res = await userB.request(path, { method, body });
        expect(res.status, `${method} ${path}`).toBe(404);
      }

      const afterA = await mustJson(await userA.request("/budgets/2026-07"), 200);
      expect(afterA).toEqual(beforeA);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-RJ-09: an invalid expense stores nothing, and retrying a failed create with the same key ends in exactly one row",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });

      const clientRequestId = randomUUID();
      const invalidRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", amountMinor: -5, clientRequestId }),
      });
      expect(invalidRes.status).toBe(400);
      const afterInvalid = await mustJson(
        await session.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(afterInvalid.total).toBe(0);

      // Simulated client retry: same clientRequestId, now with a valid amount.
      const retryRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", amountMinor: 5000, clientRequestId }),
      });
      const retryBody = await mustJson(retryRes, 201);

      const secondRetryRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", amountMinor: 5000, clientRequestId }),
      });
      const secondRetryBody = await mustJson(secondRetryRes, 200);
      expect(secondRetryBody.transaction.id).toBe(retryBody.transaction.id);

      const finalList = await mustJson(
        await session.request("/budgets/2026-07/transactions"),
        200,
      );
      expect(finalList.total).toBe(1);
      const budget = await mustJson(await session.request("/budgets/2026-07"), 200);
      expect(budget.budget.actualMinor).toBe(5000);
    },
    SLOW_TEST_TIMEOUT,
  );
});
