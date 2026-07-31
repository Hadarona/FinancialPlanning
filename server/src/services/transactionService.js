import { AppError } from "../errors.js";
import { monthRange } from "./calc.js";

// Malformed transaction ids resolve to the same 404 as missing/unowned ones
// (single code path, no existence or ownership leak — D-EXP-B4) instead of
// surfacing a Postgres uuid cast error.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Expense service. Every method resolves the authenticated user's single
 * budget FIRST (CR-001) — another user's data is indistinguishable from a
 * missing one (404, never a data leak). Expenses stay per-month: month
 * membership is a pure date-range comparison on occurred_on (decision #6).
 */
export function createTransactionService({ budgetRepo, transactionRepo }) {
  async function resolveBudget(userId) {
    const budget = await budgetRepo.findByUser(userId);
    if (!budget) {
      // Defensive "expenses but no budget" anomaly path (see budgetService).
      throw new AppError("NOT_FOUND", "No budget yet.");
    }
    return budget;
  }

  async function createTransaction(userId, month, payload) {
    const budget = await resolveBudget(userId);

    // Category must exist inside the fixed category set (now seven).
    const category = budget.categories.find((entry) => entry.id === payload.categoryId);
    if (!category) {
      throw new AppError("VALIDATION_ERROR", "Please check the highlighted fields.", {
        fieldErrors: { categoryId: "Choose a valid category." },
      });
    }

    // Month membership is a pure string comparison against the calendar
    // bounds (decision #6). This also rejects impossible days ("…-00",
    // "…-32") since they fall outside the range lexicographically.
    const { firstDay, lastDay } = monthRange(month);
    if (payload.occurredOn < firstDay || payload.occurredOn > lastDay) {
      throw new AppError("VALIDATION_ERROR", "Please check the highlighted fields.", {
        fieldErrors: { occurredOn: `Date must be within ${month}.` },
      });
    }

    return transactionRepo.insert({
      userId,
      categoryId: payload.categoryId,
      amountMinor: payload.amountMinor,
      occurredOn: payload.occurredOn,
      note: payload.note,
      clientRequestId: payload.clientRequestId,
    });
  }

  async function deleteTransaction(userId, month, transactionId) {
    await resolveBudget(userId);
    const { firstDay, lastDay } = monthRange(month);
    const deleted = UUID_PATTERN.test(transactionId)
      ? await transactionRepo.deleteByIdAndUser({
          userId,
          transactionId,
          firstDay,
          lastDay,
        })
      : false;
    if (!deleted) {
      throw new AppError("NOT_FOUND", "Transaction not found.");
    }
  }

  async function listTransactions(userId, month, { limit, offset }) {
    await resolveBudget(userId);
    const { firstDay, lastDay } = monthRange(month);
    const [transactions, total] = await Promise.all([
      transactionRepo.listByRange({ userId, firstDay, lastDay, limit, offset }),
      transactionRepo.countByRange({ userId, firstDay, lastDay }),
    ]);
    return { transactions, total, limit, offset };
  }

  return { createTransaction, deleteTransaction, listTransactions };
}
