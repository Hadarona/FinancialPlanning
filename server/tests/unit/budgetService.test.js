import { describe, expect, it, vi } from "vitest";
import { createBudgetService } from "../../src/services/budgetService.js";

const budgetRow = {
  id: "budget-1",
  userId: "user-1",
  currencyCode: "USD",
  incomeMinor: 100000,
  categories: [
    {
      id: "housing",
      name: "Housing",
      icon: "House",
      color: "blue",
      displayOrder: 1,
      plannedMinor: 50000,
    },
  ],
};

describe("budgetService.patchBudget", () => {
  it("returns NOT_FOUND if the budget disappears between read and update", async () => {
    const budgetRepo = {
      findByUser: vi.fn(async () => budgetRow),
      updateBudget: vi.fn(async () => null),
    };
    const service = createBudgetService({
      budgetRepo,
      transactionRepo: {},
    });

    await expect(
      service.patchBudget("user-1", { incomeMinor: 120000 }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
