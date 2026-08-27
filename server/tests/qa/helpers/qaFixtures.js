// QA-owned fixture builders and independent expected-value calculators.
// Expected values here are computed straight from the roadmap §2.2 formulas,
// never by importing server/src/services/calc.js into an integration
// assertion (that would let a broken calc.js pass its own check).

/** Kit reference numbers (roadmap §2.2 / docs/workflow/source-of-truth.md):
 * income 1,250,000 minor; planned 1,020,000 minor (400000+150000+80000+90000+300000);
 * available 230,000 minor. */
export const KIT_INCOME_MINOR = 1250000;
export const KIT_PLANS = {
  housing: 400000,
  groceries: 150000,
  transport: 80000,
  fun: 90000,
  savings: 300000,
};
export const KIT_PLANNED_MINOR = Object.values(KIT_PLANS).reduce((a, b) => a + b, 0);
export const KIT_AVAILABLE_MINOR = KIT_INCOME_MINOR - KIT_PLANNED_MINOR;

export function kitCategoriesPayload(overridesById = {}) {
  return Object.entries(KIT_PLANS).map(([id, plannedMinor]) => ({
    id,
    plannedMinor: overridesById[id] ?? plannedMinor,
  }));
}

/** Full create-budget request body for `month` using kit numbers, optionally
 * overriding income and/or specific category plans. */
export function kitBudgetPayload(
  month,
  { incomeMinor = KIT_INCOME_MINOR, plans = {} } = {},
) {
  return {
    month,
    incomeMinor,
    categories: kitCategoriesPayload(plans),
  };
}

/** One valid create-transaction body, category `groceries` by default.
 * `month` is a convenience input only (used to build the default
 * `occurredOn`) — it is destructured out and never leaks into the returned
 * body, which must match createTransactionSchema's `.strict()` shape
 * exactly. */
export function expensePayload({ month = "2026-07", ...overrides } = {}) {
  return {
    categoryId: "groceries",
    amountMinor: 4250,
    occurredOn: `${month}-15`,
    note: "QA fixture expense",
    ...overrides,
  };
}

/** Creates a budget (kit numbers by default) then POSTs every expense in
 * `expenses` (each a partial `expensePayload` override) in order. Returns the
 * create-budget response body plus the array of created transaction bodies. */
export async function seedMonth(session, month, expenses = [], budgetOverrides = {}) {
  const budgetResponse = await session.request("/budgets", {
    method: "POST",
    body: kitBudgetPayload(month, budgetOverrides),
  });
  const budgetText = await budgetResponse.text();
  const budgetBody = budgetText ? JSON.parse(budgetText) : null;
  if (budgetResponse.status !== 201) {
    throw new Error(
      `seedMonth: failed to create budget for ${month}: ${budgetResponse.status} ${budgetText}`,
    );
  }
  const transactions = [];
  for (const expenseOverrides of expenses) {
    const response = await session.request(`/budgets/${month}/transactions`, {
      method: "POST",
      body: expensePayload({ month, ...expenseOverrides }),
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (response.status !== 201 && response.status !== 200) {
      throw new Error(
        `seedMonth: failed to create expense for ${month}: ${response.status} ${text}`,
      );
    }
    transactions.push(body.transaction);
  }
  return { budget: budgetBody.budget, transactions };
}

/** Independent recomputation of the budget read model's aggregate numbers
 * from raw inputs (roadmap §2.2), for cross-checking API responses. */
export function expectedPlannedMinor(plans) {
  return Object.values(plans).reduce((sum, value) => sum + value, 0);
}

export function expectedAvailableMinor(incomeMinor, plannedMinor) {
  return incomeMinor - plannedMinor;
}

export function expectedActualMinor(actualsByCategory) {
  return Object.values(actualsByCategory).reduce((sum, value) => sum + value, 0);
}

/** Independent per-category progress computation (roadmap §2.2): mirrors the
 * documented rule without importing server/src/services/calc.js. */
export function expectedCategoryProgress(plannedMinor, actualMinor) {
  if (plannedMinor === 0) {
    return {
      progressPercent: null,
      state: actualMinor > 0 ? "unplanned" : "normal",
    };
  }
  const progressPercent = Math.round((actualMinor / plannedMinor) * 100);
  return {
    progressPercent,
    state: actualMinor > plannedMinor ? "overspent" : "normal",
  };
}

/** Independent largest-remainder share computation (decision #10), used to
 * cross-check insights `sharePercent` values without importing calc.js. */
export function expectedLargestRemainderShares(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return values.map(() => 0);
  }
  const exact = values.map((value) => (value / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const shares = [...floors];
  for (let i = 0; i < byRemainder.length && remaining > 0; i += 1) {
    shares[byRemainder[i].index] += 1;
    remaining -= 1;
  }
  return shares;
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value) {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}
