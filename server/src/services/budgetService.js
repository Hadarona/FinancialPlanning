import { AppError } from "../errors.js";
import { DEFAULT_CATEGORIES } from "../domain/categories.js";
import { summarizeBudget } from "./calc.js";

const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Budget read/write service. All methods take the authenticated user id as
 * their first argument — controllers must only ever pass `req.user.id`, so
 * another user's budget is indistinguishable from a missing one (404, never
 * a data leak).
 */
export function createBudgetService({ budgetRepo, transactionRepo }) {
  async function readModelFor(budgetRow) {
    const actuals = await transactionRepo.sumByCategory(budgetRow.userId, budgetRow.id);
    return { budget: summarizeBudget(budgetRow, actuals) };
  }

  async function getBudgetReadModel(userId, month) {
    const budgetRow = await budgetRepo.findByUserAndMonth(userId, month);
    if (!budgetRow) {
      throw new AppError("NOT_FOUND", "No budget for this month.");
    }
    return readModelFor(budgetRow);
  }

  /**
   * Creates a budget for the authenticated user. The stored categories are
   * rebuilt from the server-side constants — the client only ever supplies
   * `{id, plannedMinor}` pairs, so names/icons/colors/order cannot be
   * altered (decision #7). A duplicate month is decided by the DB unique
   * constraint, which stays correct under concurrency (D-PLN-B2).
   */
  async function createBudget(userId, { month, incomeMinor, categories }) {
    const plannedById = new Map(
      categories.map((category) => [category.id, category.plannedMinor]),
    );
    const storedCategories = DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      plannedMinor: plannedById.get(category.id),
    }));

    try {
      const budgetRow = await budgetRepo.createBudget({
        userId,
        month,
        incomeMinor,
        categories: storedCategories,
      });
      return readModelFor(budgetRow);
    } catch (err) {
      if (err?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new AppError("CONFLICT", "You already have a budget for this month.");
      }
      throw err;
    }
  }

  /**
   * Updates income and/or planned amounts of an owned budget. The fixed
   * category set can never shrink (D-PLN-B5/F6): patches merge planned
   * amounts into the existing five categories, never remove or add one.
   */
  async function updateBudget(userId, month, patch) {
    const existing = await budgetRepo.findByUserAndMonth(userId, month);
    if (!existing) {
      throw new AppError("NOT_FOUND", "No budget for this month.");
    }

    const plannedById = new Map(
      (patch.categories ?? []).map((category) => [category.id, category.plannedMinor]),
    );
    const mergedCategories = existing.categories.map((category) => ({
      ...category,
      plannedMinor: plannedById.get(category.id) ?? category.plannedMinor,
    }));

    const budgetRow = await budgetRepo.updateBudget({
      userId,
      month,
      incomeMinor: patch.incomeMinor ?? existing.incomeMinor,
      categories: mergedCategories,
    });
    return readModelFor(budgetRow);
  }

  return { getBudgetReadModel, readModelFor, createBudget, updateBudget };
}
