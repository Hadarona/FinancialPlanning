import { AppError } from "../errors.js";
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_MINOR } from "../domain/categories.js";
import { budgetPlanModel, monthReadModel, monthRange } from "./calc.js";
export function createBudgetService({ budgetRepo, transactionRepo }) {
  async function requireBudget(userId, month) {
    const row = await budgetRepo.findByUser(userId, month);
    if (!row) throw new AppError("NOT_FOUND", "No budget yet.");
    return row;
  }
  async function getBudget(userId, month) {
    return { budget: budgetPlanModel(await requireBudget(userId, month)) };
  }
  async function createDefaultBudget(userId, queryable) {
    try {
      return {
        budget: budgetPlanModel(
          await budgetRepo.createBudget(
            { userId, incomeMinor: DEFAULT_INCOME_MINOR, categories: DEFAULT_CATEGORIES },
            queryable,
          ),
        ),
      };
    } catch (err) {
      if (err?.code === "23505")
        throw new AppError("CONFLICT", "You already have a budget.");
      throw err;
    }
  }
  async function patchBudget(userId, patch) {
    const effectiveMonth = patch.effectiveMonth;
    const existing = await requireBudget(userId, effectiveMonth);
    const byId = new Map(existing.categories.map((c) => [c.id, c]));
    for (const change of patch.categories ?? []) {
      const old = byId.get(change.id);
      if (!old && !change.name)
        throw new AppError("VALIDATION_ERROR", "New categories need a name.");
      byId.set(change.id, {
        icon: "Tag",
        color: "blue",
        displayOrder: byId.size + 1,
        plannedMinor: 0,
        ...old,
        ...change,
      });
    }
    const categories = [...byId.values()];
    const oneOff = categories.find((c) => c.id === "one-off");
    if (oneOff) {
      oneOff.plannedMinor = 0;
      oneOff.archived = false;
    }
    if (categories.length > 50)
      throw new AppError("VALIDATION_ERROR", "Use at most 50 categories.");
    const updated = await budgetRepo.updateBudget({
      userId,
      incomeMinor: patch.incomeMinor ?? existing.incomeMinor,
      categories,
      effectiveMonth,
      revision: patch.revision,
    });
    if (!updated) throw new AppError("NOT_FOUND", "No budget yet.");
    return { budget: budgetPlanModel(updated) };
  }
  async function getMonthReadModel(userId, month) {
    const row = await requireBudget(userId, month);
    const actuals = await transactionRepo.sumByCategory(userId, monthRange(month));
    return { budget: monthReadModel(row, month, actuals) };
  }
  return { getBudget, createDefaultBudget, patchBudget, getMonthReadModel };
}
