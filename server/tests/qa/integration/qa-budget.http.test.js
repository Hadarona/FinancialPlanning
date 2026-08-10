// QA-SI-20..31: real-HTTP budget read/write coverage against an isolated schema.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
import {
  kitBudgetPayload,
  KIT_INCOME_MINOR,
  KIT_PLANNED_MINOR,
  KIT_AVAILABLE_MINOR,
  expensePayload,
  expectedCategoryProgress,
} from "../helpers/qaFixtures.js";
import { DEFAULT_CATEGORIES } from "../../../src/domain/categories.js";

// Remote Neon round-trips make multi-request journeys slower than vitest's
// 5s default test timeout.
const SLOW_TEST_TIMEOUT = 30000;

describe("QA-SI: budget http", () => {
  let ctx;

  beforeAll(async () => {
    // A generous auth-rate-limit override: this file registers many fresh
    // users across its tests, well above the default 10/15min limit.
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
    "QA-SI-20: create + read the kit budget recomputes the documented read model exactly",
    async () => {
      const session = await freshUserSession();
      const createRes = await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const createBody = await mustJson(createRes, 201);

      const getRes = await session.request("/budgets/2026-07");
      const getBody = await mustJson(getRes, 200);

      for (const body of [createBody, getBody]) {
        const { budget } = body;
        expect(budget.plannedMinor).toBe(KIT_PLANNED_MINOR);
        expect(budget.plannedMinor).toBe(1020000);
        expect(budget.availableMinor).toBe(KIT_AVAILABLE_MINOR);
        expect(budget.availableMinor).toBe(230000);
        expect(budget.actualMinor).toBe(0);
        expect(budget.incomeMinor).toBe(KIT_INCOME_MINOR);
        expect(budget.categories).toHaveLength(5);

        const sortedDefaults = [...DEFAULT_CATEGORIES].sort(
          (a, b) => a.displayOrder - b.displayOrder,
        );
        budget.categories.forEach((category, index) => {
          const expected = sortedDefaults[index];
          expect(category.id).toBe(expected.id);
          expect(category.name).toBe(expected.name);
          expect(category.icon).toBe(expected.icon);
          expect(category.color).toBe(expected.color);
          expect(category.displayOrder).toBe(expected.displayOrder);
          expect(Number.isInteger(category.plannedMinor)).toBe(true);
          expect(Number.isInteger(category.actualMinor)).toBe(true);
        });
        expect(Number.isInteger(budget.plannedMinor)).toBe(true);
        expect(Number.isInteger(budget.availableMinor)).toBe(true);
        expect(Number.isInteger(budget.actualMinor)).toBe(true);
        expect(Number.isInteger(budget.incomeMinor)).toBe(true);
      }
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-21: a missing month is 404, a malformed month is 400 (never conflated)",
    async () => {
      const session = await freshUserSession();
      const missingRes = await session.request("/budgets/2026-05");
      const missingBody = await mustJson(missingRes, 404);
      expect(missingBody.error.code).toBe("NOT_FOUND");

      const badMonthRes = await session.request("/budgets/2026-13");
      expect(badMonthRes.status).toBe(400);

      const badFormatRes = await session.request("/budgets/202607");
      expect(badFormatRes.status).toBe(400);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-22: duplicate-month creation is arbitrated to exactly one winner, sequentially and under a race",
    async () => {
      const session = await freshUserSession();
      const first = await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-08"),
      });
      expect(first.status).toBe(201);
      const second = await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-08"),
      });
      const secondBody = await mustJson(second, 409);
      expect(secondBody.error.code).toBe("CONFLICT");

      const raceSession = await freshUserSession();
      const [raceA, raceB] = await Promise.all([
        raceSession.request("/budgets", {
          method: "POST",
          body: kitBudgetPayload("2026-09"),
        }),
        raceSession.request("/budgets", {
          method: "POST",
          body: kitBudgetPayload("2026-09"),
        }),
      ]);
      const statuses = [raceA.status, raceB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const getRes = await raceSession.request("/budgets/2026-09");
      const getBody = await mustJson(getRes, 200);
      expect(getBody.budget.month).toBe("2026-09");
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-23: patch merges income-only or a single category, always keeping all five categories",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });

      const incomeOnlyRes = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: { incomeMinor: 2000000 },
      });
      const incomeOnlyBody = await mustJson(incomeOnlyRes, 200);
      expect(incomeOnlyBody.budget.incomeMinor).toBe(2000000);
      expect(incomeOnlyBody.budget.plannedMinor).toBe(KIT_PLANNED_MINOR);
      expect(incomeOnlyBody.budget.availableMinor).toBe(2000000 - KIT_PLANNED_MINOR);
      expect(incomeOnlyBody.budget.categories).toHaveLength(5);

      const oneCategoryRes = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: { categories: [{ id: "housing", plannedMinor: 500000 }] },
      });
      const oneCategoryBody = await mustJson(oneCategoryRes, 200);
      expect(oneCategoryBody.budget.categories).toHaveLength(5);
      const housing = oneCategoryBody.budget.categories.find((c) => c.id === "housing");
      expect(housing.plannedMinor).toBe(500000);
      // Untouched categories keep their previous plans (groceries/transport/fun/savings).
      const groceries = oneCategoryBody.budget.categories.find(
        (c) => c.id === "groceries",
      );
      expect(groceries.plannedMinor).toBe(150000);
      const expectedPlanned = 500000 + 150000 + 80000 + 90000 + 300000;
      expect(oneCategoryBody.budget.plannedMinor).toBe(expectedPlanned);
      // Income from the previous patch is preserved (patch is a partial merge).
      expect(oneCategoryBody.budget.incomeMinor).toBe(2000000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-24: rejected patches never mutate the stored budget",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const before = await mustJson(await session.request("/budgets/2026-07"), 200);

      const emptyPatch = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: {},
      });
      expect(emptyPatch.status).toBe(400);

      const negativeIncome = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: { incomeMinor: -1 },
      });
      expect(negativeIncome.status).toBe(400);

      const duplicateCategories = await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: {
          categories: [
            { id: "housing", plannedMinor: 1 },
            { id: "housing", plannedMinor: 2 },
          ],
        },
      });
      expect(duplicateCategories.status).toBe(400);

      const unknownMonth = await session.request("/budgets/2026-05", {
        method: "PATCH",
        body: { incomeMinor: 1 },
      });
      expect(unknownMonth.status).toBe(404);

      const after = await mustJson(await session.request("/budgets/2026-07"), 200);
      expect(after).toEqual(before);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-25: over-allocated income (planned > income) is accepted with an exact negative available",
    async () => {
      const session = await freshUserSession();
      const res = await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07", { incomeMinor: 100000 }),
      });
      const body = await mustJson(res, 201);
      expect(body.budget.plannedMinor).toBe(1020000);
      expect(body.budget.availableMinor).toBe(100000 - 1020000);
      expect(body.budget.availableMinor).toBe(-920000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-26: a zero-planned category with spending is 'unplanned', never a division-by-zero crash",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07", { plans: { fun: 0 } }),
      });
      await session.request(`/budgets/2026-07/transactions`, {
        method: "POST",
        body: expensePayload({ month: "2026-07", categoryId: "fun", amountMinor: 2500 }),
      });
      const res = await session.request("/budgets/2026-07");
      const body = await mustJson(res, 200);
      const fun = body.budget.categories.find((c) => c.id === "fun");
      expect(fun.plannedMinor).toBe(0);
      expect(fun.actualMinor).toBe(2500);
      expect(fun.progressPercent).toBeNull();
      expect(fun.state).toBe("unplanned");
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-27: spending beyond a category's plan is 'overspent' with the exact rounded percent",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      // groceries planned 150000; spend 200000 -> 133% overspent.
      await session.request(`/budgets/2026-07/transactions`, {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "groceries",
          amountMinor: 200000,
        }),
      });
      const res = await session.request("/budgets/2026-07");
      const body = await mustJson(res, 200);
      const groceries = body.budget.categories.find((c) => c.id === "groceries");
      const expected = expectedCategoryProgress(150000, 200000);
      expect(groceries.progressPercent).toBe(expected.progressPercent);
      expect(groceries.progressPercent).toBe(133);
      expect(groceries.state).toBe("overspent");
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-28: expenses at calendar edges never bleed into a neighboring month",
    async () => {
      const session = await freshUserSession();
      for (const month of ["2026-06", "2026-07", "2026-08"]) {
        await session.request("/budgets", {
          method: "POST",
          body: kitBudgetPayload(month),
        });
      }
      await session.request("/budgets/2026-06/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-06",
          categoryId: "housing",
          occurredOn: "2026-06-30",
          amountMinor: 1000,
        }),
      });
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "housing",
          occurredOn: "2026-07-01",
          amountMinor: 2000,
        }),
      });
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "housing",
          occurredOn: "2026-07-31",
          amountMinor: 3000,
        }),
      });
      await session.request("/budgets/2026-08/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-08",
          categoryId: "housing",
          occurredOn: "2026-08-01",
          amountMinor: 4000,
        }),
      });

      const june = await mustJson(await session.request("/budgets/2026-06"), 200);
      const july = await mustJson(await session.request("/budgets/2026-07"), 200);
      const august = await mustJson(await session.request("/budgets/2026-08"), 200);

      expect(june.budget.actualMinor).toBe(1000);
      expect(july.budget.actualMinor).toBe(2000 + 3000);
      expect(august.budget.actualMinor).toBe(4000);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-29: another user's budget is a 404 for both read and write, and stays unchanged",
    async () => {
      const userA = await freshUserSession();
      await userA.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const beforeA = await mustJson(await userA.request("/budgets/2026-07"), 200);

      const userB = await freshUserSession();
      const readAsB = await userB.request("/budgets/2026-07");
      const readAsBBody = await mustJson(readAsB, 404);

      const missingRes = await userB.request("/budgets/2099-01");
      const missingBody = await mustJson(missingRes, 404);
      delete readAsBBody.error.requestId;
      delete missingBody.error.requestId;
      expect(readAsBBody).toEqual(missingBody);

      const patchAsB = await userB.request("/budgets/2026-07", {
        method: "PATCH",
        body: { incomeMinor: 1 },
      });
      expect(patchAsB.status).toBe(404);

      const afterA = await mustJson(await userA.request("/budgets/2026-07"), 200);
      expect(afterA).toEqual(beforeA);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-30: a zero income and a zero-planned category are both accepted with exact math",
    async () => {
      const session = await freshUserSession();
      const res = await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07", { incomeMinor: 0, plans: { housing: 0 } }),
      });
      const body = await mustJson(res, 201);
      const expectedPlanned = 0 + 150000 + 80000 + 90000 + 300000;
      expect(body.budget.plannedMinor).toBe(expectedPlanned);
      expect(body.budget.availableMinor).toBe(0 - expectedPlanned);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-31: editing a plan after the fact changes progress but never the recorded actuals",
    async () => {
      const session = await freshUserSession();
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({
          month: "2026-07",
          categoryId: "housing",
          amountMinor: 252000,
        }),
      });
      const before = await mustJson(await session.request("/budgets/2026-07"), 200);
      const housingBefore = before.budget.categories.find((c) => c.id === "housing");
      expect(housingBefore.progressPercent).toBe(63);
      expect(housingBefore.actualMinor).toBe(252000);

      await session.request("/budgets/2026-07", {
        method: "PATCH",
        body: { categories: [{ id: "housing", plannedMinor: 200000 }] },
      });
      const after = await mustJson(await session.request("/budgets/2026-07"), 200);
      const housingAfter = after.budget.categories.find((c) => c.id === "housing");
      expect(housingAfter.progressPercent).toBe(126);
      expect(housingAfter.actualMinor).toBe(252000);
    },
    SLOW_TEST_TIMEOUT,
  );
});
