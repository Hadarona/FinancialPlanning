// QA-owned client fixtures for the budget read model
// (`GET /api/v1/months/:month` shape: `{ budget: {...} }`) and its
// matching transactions list (`GET /api/v1/months/:month/transactions`).
// Every number here is picked independently of client/src so a hard-coded
// component value would show up as a mismatch, not a coincidental match.

const BASE_CATEGORY_META = {
  housing: { name: "Housing", icon: "House", color: "blue", displayOrder: 1 },
  groceries: { name: "Groceries", icon: "ShoppingCart", color: "green", displayOrder: 2 },
  transport: { name: "Transport", icon: "CarFront", color: "yellow", displayOrder: 3 },
  fun: { name: "Fun", icon: "PartyPopper", color: "coral", displayOrder: 4 },
  savings: { name: "Savings", icon: "PiggyBank", color: "blue", displayOrder: 5 },
  subscriptions: { name: "Subscriptions", icon: "Repeat", color: "coral", displayOrder: 6 },
  utilities: { name: "Utilities", icon: "Plug", color: "green", displayOrder: 7 },
};

function categoryProgress(plannedMinor, actualMinor) {
  if (plannedMinor === 0) {
    return { progressPercent: null, state: actualMinor > 0 ? "unplanned" : "normal" };
  }
  const progressPercent = Math.round((actualMinor / plannedMinor) * 100);
  return { progressPercent, state: actualMinor > plannedMinor ? "overspent" : "normal" };
}

function buildCategories(plans) {
  return Object.entries(plans).map(([id, { plannedMinor, actualMinor }]) => ({
    id,
    ...BASE_CATEGORY_META[id],
    plannedMinor,
    actualMinor,
    ...categoryProgress(plannedMinor, actualMinor),
  }));
}

function buildBudget({ id, month, incomeMinor, plans }) {
  const categories = buildCategories(plans);
  const plannedMinor = categories.reduce((sum, c) => sum + c.plannedMinor, 0);
  const actualMinor = categories.reduce((sum, c) => sum + c.actualMinor, 0);
  return {
    budget: {
      id,
      month,
      currencyCode: "USD",
      incomeMinor,
      plannedMinor,
      availableMinor: incomeMinor - plannedMinor,
      actualMinor,
      categories,
    },
  };
}

/** Kit reference numbers: income 12,500 / planned 12,000 / available 500.
 * Housing: 2,520 spent of 4,000 planned -> 63%, "normal"
 * (matches the exact screen-reader sentence check, D-BUD-F6). */
export function kitBudget() {
  return buildBudget({
    id: "kit-budget-2026-07",
    month: "2026-07",
    incomeMinor: 1250000,
    plans: {
      housing: { plannedMinor: 400000, actualMinor: 252000 },
      groceries: { plannedMinor: 150000, actualMinor: 0 },
      transport: { plannedMinor: 80000, actualMinor: 0 },
      fun: { plannedMinor: 90000, actualMinor: 0 },
      savings: { plannedMinor: 300000, actualMinor: 0 },
      subscriptions: { plannedMinor: 60000, actualMinor: 0 },
      utilities: { plannedMinor: 120000, actualMinor: 0 },
    },
  });
}

/** Every number differs from the kit fixture — proves a re-render reflects
 * fresh data instead of hard-coded totals (QA-CC-21, D-BUD-F1). */
export function variantBudget() {
  return buildBudget({
    id: "variant-budget-2026-11",
    month: "2026-11",
    incomeMinor: 2000000,
    plans: {
      housing: { plannedMinor: 500000, actualMinor: 100000 },
      groceries: { plannedMinor: 220000, actualMinor: 60000 },
      transport: { plannedMinor: 60000, actualMinor: 15000 },
      fun: { plannedMinor: 75000, actualMinor: 5000 },
      savings: { plannedMinor: 245000, actualMinor: 0 },
      subscriptions: { plannedMinor: 90000, actualMinor: 10000 },
      utilities: { plannedMinor: 135000, actualMinor: 20000 },
    },
  });
}

/** Groceries planned 150,000 / actual 200,000 -> 133% overspent (progress
 * preserved above 100, not capped or hidden). */
export function overspentBudget() {
  return buildBudget({
    id: "overspent-budget-2026-07",
    month: "2026-07",
    incomeMinor: 1250000,
    plans: {
      housing: { plannedMinor: 400000, actualMinor: 0 },
      groceries: { plannedMinor: 150000, actualMinor: 200000 },
      transport: { plannedMinor: 80000, actualMinor: 0 },
      fun: { plannedMinor: 90000, actualMinor: 0 },
      savings: { plannedMinor: 300000, actualMinor: 0 },
      subscriptions: { plannedMinor: 60000, actualMinor: 0 },
      utilities: { plannedMinor: 120000, actualMinor: 0 },
    },
  });
}

/** Fun planned 0, actual 5,000 spent -> "unplanned spending" (never a
 * division-by-zero / false "overspent" flag). */
export function unplannedBudget() {
  return buildBudget({
    id: "unplanned-budget-2026-07",
    month: "2026-07",
    incomeMinor: 1250000,
    plans: {
      housing: { plannedMinor: 400000, actualMinor: 0 },
      groceries: { plannedMinor: 150000, actualMinor: 0 },
      transport: { plannedMinor: 80000, actualMinor: 0 },
      fun: { plannedMinor: 0, actualMinor: 5000 },
      savings: { plannedMinor: 300000, actualMinor: 0 },
      subscriptions: { plannedMinor: 60000, actualMinor: 0 },
      utilities: { plannedMinor: 120000, actualMinor: 0 },
    },
  });
}

/** Matching transactions-list payload for `kitBudget()`: one housing expense
 * accounting for its 252,000 actual. */
export function kitTransactions() {
  return {
    transactions: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        categoryId: "housing",
        amountMinor: 252000,
        occurredOn: "2026-07-10",
        note: "Rent",
        createdAt: "2026-07-10T12:00:00.000Z",
      },
    ],
    total: 1,
    limit: 50,
    offset: 0,
  };
}

export function emptyTransactions() {
  return { transactions: [], total: 0, limit: 50, offset: 0 };
}
