// Deterministic, guarded demo seed (D-DOC-B2). Refuses to run unless
// `ALLOW_DEMO_SEED=true` AND `NODE_ENV !== 'production'`. Idempotent: it
// deletes and re-creates ONLY the demo user's data (cascade removes the demo
// budget; transactions are keyed by the demo user id), never touching any
// other account.
//
// CR-001 rework: ONE budgets row (income 12,500; the seven default plans
// totalling 12,000) instead of two budget_periods rows. The expense lists
// include the two new categories (Subscriptions, Utilities) while preserving
// every per-day sum, so the monthly totals (current 8,420, previous 9,180)
// and the sampled cumulative cash-flow series stay byte-identical to the
// delivery-1 evidence (kit content.json cashFlow, D-DES-012).

import bcrypt from "bcryptjs";
import { createPool } from "../db/pool.js";
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_MINOR } from "../domain/categories.js";
import { previousMonth } from "../services/calc.js";

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "DemoPass123!";

// Fixed per-category expense lists (minor units). Days are all <= 28 so every
// calendar month is valid (in a 28-day month the final sample window covers
// days 27-28 and still matches the kit's last value). Current-month category
// totals: housing 323,600 / groceries 136,600 / transport 84,200 /
// fun 92,600 / savings 117,900 / subscriptions 15,000 / utilities 72,100
// (sum 842,000). Previous month: 350,000 / 155,000 / 90,000 / 100,000 /
// 128,000 / 15,000 / 80,000 (sum 918,000). The per-day distribution makes
// the sampled cumulative sums equal content.json's cashFlow series exactly
// (D-DES-012); demoSeedData.test.js locks both guarantees. Exported for that
// data test only.
export const CURRENT_MONTH_EXPENSES = [
  { categoryId: "savings", day: 1, amountMinor: 60000, note: "Transfer to savings" },
  { categoryId: "housing", day: 2, amountMinor: 82000, note: "Rent installment" },
  { categoryId: "groceries", day: 4, amountMinor: 23000, note: "Supermarket" },
  { categoryId: "subscriptions", day: 4, amountMinor: 15000, note: "Streaming services" },
  { categoryId: "groceries", day: 8, amountMinor: 40000, note: "Supermarket" },
  { categoryId: "housing", day: 9, amountMinor: 90000, note: "Rent installment" },
  { categoryId: "housing", day: 13, amountMinor: 100000, note: "Rent installment" },
  { categoryId: "transport", day: 14, amountMinor: 30000, note: "Transit pass" },
  { categoryId: "groceries", day: 15, amountMinor: 20000, note: "Market" },
  { categoryId: "savings", day: 17, amountMinor: 57900, note: "Transfer to savings" },
  { categoryId: "utilities", day: 18, amountMinor: 72100, note: "Electricity and water" },
  { categoryId: "fun", day: 22, amountMinor: 50000, note: "Concert" },
  { categoryId: "housing", day: 23, amountMinor: 51600, note: "Repairs" },
  { categoryId: "transport", day: 25, amountMinor: 38400, note: "Fuel" },
  { categoryId: "groceries", day: 27, amountMinor: 53600, note: "Supermarket" },
  { categoryId: "fun", day: 27, amountMinor: 42600, note: "Dinner out" },
  { categoryId: "transport", day: 28, amountMinor: 15800, note: "Fuel" },
];

export const PREVIOUS_MONTH_EXPENSES = [
  { categoryId: "savings", day: 1, amountMinor: 80000, note: "Transfer to savings" },
  { categoryId: "housing", day: 2, amountMinor: 90000, note: "Rent installment" },
  { categoryId: "groceries", day: 4, amountMinor: 25000, note: "Supermarket" },
  { categoryId: "subscriptions", day: 4, amountMinor: 15000, note: "Streaming services" },
  { categoryId: "groceries", day: 8, amountMinor: 45000, note: "Supermarket" },
  { categoryId: "housing", day: 9, amountMinor: 95000, note: "Rent installment" },
  { categoryId: "housing", day: 13, amountMinor: 117000, note: "Rent installment" },
  { categoryId: "transport", day: 14, amountMinor: 33000, note: "Transit pass" },
  { categoryId: "savings", day: 17, amountMinor: 48000, note: "Transfer to savings" },
  { categoryId: "utilities", day: 18, amountMinor: 80000, note: "Electricity and water" },
  { categoryId: "groceries", day: 20, amountMinor: 22000, note: "Market" },
  { categoryId: "fun", day: 22, amountMinor: 60000, note: "Concert" },
  { categoryId: "housing", day: 23, amountMinor: 48000, note: "Repairs" },
  { categoryId: "transport", day: 25, amountMinor: 32000, note: "Fuel" },
  { categoryId: "groceries", day: 27, amountMinor: 63000, note: "Supermarket" },
  { categoryId: "fun", day: 27, amountMinor: 40000, note: "Dinner out" },
  { categoryId: "transport", day: 28, amountMinor: 25000, note: "Fuel" },
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

      // Idempotency: remove ONLY the demo user; budget/transactions cascade.
      await client.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);

      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.bcryptRounds);
      const userResult = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [DEMO_EMAIL, passwordHash],
      );
      const userId = userResult.rows[0].id;

      // ONE budget per user (CR-001), applied identically to every month.
      await client.query(
        `INSERT INTO budgets (user_id, income_minor, categories)
         VALUES ($1, $2, $3::jsonb)`,
        [userId, DEFAULT_INCOME_MINOR, JSON.stringify(DEFAULT_CATEGORIES)],
      );

      const months = [
        { month, expenses: CURRENT_MONTH_EXPENSES },
        { month: prevMonth, expenses: PREVIOUS_MONTH_EXPENSES },
      ];

      for (const entry of months) {
        for (const expense of entry.expenses) {
          await client.query(
            `INSERT INTO transactions
               (user_id, category_id, amount_minor, occurred_on, note)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
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
