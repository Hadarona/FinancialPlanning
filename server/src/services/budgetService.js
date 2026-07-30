import { AppError } from "../errors.js";
import { summarizeBudget } from "./calc.js";

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

  return { getBudgetReadModel, readModelFor };
}
