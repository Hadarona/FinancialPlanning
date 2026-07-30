// Deterministic, guarded demo seed (D-DOC-B2). Refuses to run unless
// `ALLOW_DEMO_SEED=true` AND `NODE_ENV !== 'production'`. Idempotent: it
// deletes and re-creates ONLY the demo user's data (cascade removes the demo
// budgets/transactions), never touching any other account.
//
// The dataset follows the authoritative kit numbers (source-of-truth §3 /
// plan risk #1): income 12,500 with plans 4,000/1,500/800/900/3,000 for both
// months; per-category actuals equal the kit insights data — current month
// totals 8,420, previous month totals 9,180.

import bcrypt from "bcryptjs";
import { createPool } from "../db/pool.js";
import { DEFAULT_CATEGORIES } from "../domain/categories.js";
import { previousMonth } from "../services/calc.js";

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "DemoPass123!";

const DEMO_INCOME_MINOR = 1250000;

// Fixed per-category expense lists (minor units). Days are all <= 28 so every
// calendar month is valid. Current-month category totals: housing 395,700 /
// groceries 151,600 / transport 84,200 / fun 92,600 / savings 117,900
// (sum 842,000). Previous month: 430,000 / 170,000 / 90,000 / 100,000 /
// 128,000 (sum 918,000).
const CURRENT_MONTH_EXPENSES = [
  { categoryId: "housing", day: 1, amountMinor: 350000, note: "Rent" },
  { categoryId: "housing", day: 14, amountMinor: 30700, note: "Utilities" },
  { categoryId: "housing", day: 26, amountMinor: 15000, note: "Repairs" },
  { categoryId: "groceries", day: 3, amountMinor: 38200, note: "Supermarket" },
  { categoryId: "groceries", day: 8, amountMinor: 41900, note: "Supermarket" },
  { categoryId: "groceries", day: 17, amountMinor: 35600, note: "Market" },
  { categoryId: "groceries", day: 26, amountMinor: 35900, note: "Supermarket" },
  { categoryId: "transport", day: 5, amountMinor: 24200, note: "Fuel" },
  { categoryId: "transport", day: 14, amountMinor: 30000, note: "Transit pass" },
  { categoryId: "transport", day: 23, amountMinor: 30000, note: "Car service" },
  { categoryId: "fun", day: 8, amountMinor: 32600, note: "Concert" },
  { categoryId: "fun", day: 20, amountMinor: 35000, note: "Dinner out" },
  { categoryId: "fun", day: 28, amountMinor: 25000, note: "Streaming" },
  { categoryId: "savings", day: 1, amountMinor: 60000, note: "Transfer" },
  { categoryId: "savings", day: 17, amountMinor: 57900, note: "Transfer" },
];

const PREVIOUS_MONTH_EXPENSES = [
  { categoryId: "housing", day: 1, amountMinor: 350000, note: "Rent" },
  { categoryId: "housing", day: 14, amountMinor: 50000, note: "Utilities" },
  { categoryId: "housing", day: 26, amountMinor: 30000, note: "Repairs" },
  { categoryId: "groceries", day: 3, amountMinor: 42500, note: "Supermarket" },
  { categoryId: "groceries", day: 8, amountMinor: 45000, note: "Supermarket" },
  { categoryId: "groceries", day: 17, amountMinor: 40000, note: "Market" },
  { categoryId: "groceries", day: 26, amountMinor: 42500, note: "Supermarket" },
  { categoryId: "transport", day: 5, amountMinor: 27000, note: "Fuel" },
  { categoryId: "transport", day: 14, amountMinor: 33000, note: "Transit pass" },
  { categoryId: "transport", day: 23, amountMinor: 30000, note: "Car service" },
  { categoryId: "fun", day: 8, amountMinor: 35000, note: "Concert" },
  { categoryId: "fun", day: 20, amountMinor: 40000, note: "Dinner out" },
  { categoryId: "fun", day: 28, amountMinor: 25000, note: "Streaming" },
  { categoryId: "savings", day: 1, amountMinor: 65000, note: "Transfer" },
  { categoryId: "savings", day: 17, amountMinor: 63000, note: "Transfer" },
];

function currentCalendarMonth() {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sumMinor(expenses) {
  return expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
}

/**
 * Seeds (or fully refreshes) the demo account. Throws unless explicitly
 * allowed by config. Returns a deterministic summary for logging/tests.
 */
export async function runDemoSeed(config) {
  if (!config.allowDemoSeed) {
    throw new Error("Demo seed refused: set ALLOW_DEMO_SEED=true to run it.");
  }
  if (config.isProduction) {
    throw new Error("Demo seed refused: it never runs when NODE_ENV is 'production'.");
  }

  const month = currentCalendarMonth();
  const prevMonth = previousMonth(month);
  const pool = createPool(config);

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Idempotency: remove ONLY the demo user; budgets/transactions cascade.
      await client.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);

      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.bcryptRounds);
      const userResult = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [DEMO_EMAIL, passwordHash],
      );
      const userId = userResult.rows[0].id;

      const months = [
        { month, expenses: CURRENT_MONTH_EXPENSES },
        { month: prevMonth, expenses: PREVIOUS_MONTH_EXPENSES },
      ];

      for (const entry of months) {
        const budgetResult = await client.query(
          `INSERT INTO budget_periods (user_id, month, income_minor, categories)
           VALUES ($1, $2, $3, $4::jsonb)
           RETURNING id`,
          [userId, entry.month, DEMO_INCOME_MINOR, JSON.stringify(DEFAULT_CATEGORIES)],
        );
        const budgetPeriodId = budgetResult.rows[0].id;

        for (const expense of entry.expenses) {
          await client.query(
            `INSERT INTO transactions
               (user_id, budget_period_id, category_id, amount_minor, occurred_on, note)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              userId,
              budgetPeriodId,
              expense.categoryId,
              expense.amountMinor,
              `${entry.month}-${String(expense.day).padStart(2, "0")}`,
              expense.note,
            ],
          );
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  return {
    email: DEMO_EMAIL,
    months: [month, prevMonth],
    currentTotalMinor: sumMinor(CURRENT_MONTH_EXPENSES),
    previousTotalMinor: sumMinor(PREVIOUS_MONTH_EXPENSES),
  };
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  // Deferred import so loadConfig() only runs for the real CLI invocation
  // (same pattern as migrate.js).
  const { loadConfig } = await import("../config.js");
  const config = loadConfig();
  runDemoSeed(config)
    .then((summary) => {
      console.log(
        `Demo data seeded for ${summary.email}: months ${summary.months.join(", ")} ` +
          `(current total ${summary.currentTotalMinor}, previous total ${summary.previousTotalMinor}).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(`Demo seed failed: ${err.message}`);
      process.exit(1);
    });
}
