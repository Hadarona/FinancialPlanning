import { AppError } from "../errors.js";
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_MINOR } from "../domain/categories.js";
import { budgetPlanModel, monthReadModel, monthRange } from "./calc.js";

const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Budget read/write service (CR-001: exactly ONE budget per user, applied
 * identically to every month). All methods take the authenticated user id as
 * their first argument — controllers must only ever pass `req.user.id`, so
 * another user's budget is indistinguishable from a missing one (404, never
 * a data leak).
 */
export function createBudgetService({ budgetRepo, transactionRepo }) {
  async function requireBudget(userId) {
    const budgetRow = await budgetRepo.findByUser(userId);
    if (!budgetRow) {
      // Defensive: unreachable after migration 002's backfill plus
      // registration auto-provisioning (CR1-9), but kept as the honest
      // answer for a data anomaly — the client renders a recovery path.
      throw new AppError("NOT_FOUND", "No budget yet.");
    }
    return budgetRow;
  }

  /** `GET /budget`: the single budget's plans (no actuals, no month). */
  async function getBudget(userId) {
    const budgetRow = await requireBudget(userId);
    return { budget: budgetPlanModel(budgetRow) };
  }

  /**
   * `POST /budget` and registration (CR1-9): creates the default budget
   * from the server-side constants — the client supplies nothing. A
   * concurrent duplicate is decided by the DB unique(user_id) constraint.
   */
  async function createDefaultBudget(userId, queryable) {
    try {
      const budgetRow = await budgetRepo.createBudget(
        {
          userId,
          incomeMinor: DEFAULT_INCOME_MINOR,
          categories: DEFAULT_CATEGORIES,
        },
        queryable,
      );
      return { budget: budgetPlanModel(budgetRow) };
    } catch (err) {
      if (err?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new AppError("CONFLICT", "You already have a budget.");
      }
      throw err;
    }
  }

  /**
   * `PATCH /budget`: updates income and/or planned amounts. The fixed
   * category set can never shrink: patches merge planned amounts into the
   * existing seven categories, never remove or add one (decision #7).
   */
  async function patchBudget(userId, patch) {
    const existing = await requireBudget(userId);

    const plannedById = new Map(
      (patch.categories ?? []).map((category) => [category.id, category.plannedMinor]),
    );
    const mergedCategories = existing.categories.map((category) => ({
      ...category,
      plannedMinor: plannedById.get(category.id) ?? category.plannedMinor,
    }));

    const budgetRow = await budgetRepo.updateBudget({
      userId,
      incomeMinor: patch.incomeMinor ?? existing.incomeMinor,
      categories: mergedCategories,
    });
    if (!budgetRow) {
      throw new AppError("NOT_FOUND", "No budget yet.");
    }
    return { budget: budgetPlanModel(budgetRow) };
  }

  /** `GET /months/:month`: the single budget's plans + THAT month's actuals. */
  async function getMonthReadModel(userId, month) {
    const budgetRow = await requireBudget(userId);
    const actuals = await transactionRepo.sumByCategory(userId, monthRange(month));
    return { budget: monthReadModel(budgetRow, month, actuals) };
  }

  return { getBudget, createDefaultBudget, patchBudget, getMonthReadModel };
}
