// Budget-period repository. Factory-created from a pg Pool (no module-level
// singletons). Every query filters by user_id — ownership is enforced at the
// data-access layer, not just in controllers.

/** Maps a budget_periods row to camelCase with numeric money fields.
 * `income_minor` is a Postgres bigint, which pg returns as a string. */
function mapBudgetRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    month: row.month,
    currencyCode: row.currency_code,
    incomeMinor: Number(row.income_minor),
    categories: row.categories,
  };
}

const RETURNING = "id, user_id, month, currency_code, income_minor, categories";

export function createBudgetRepo(pool) {
  return {
    async findByUserAndMonth(userId, month) {
      const result = await pool.query(
        `SELECT ${RETURNING} FROM budget_periods WHERE user_id = $1 AND month = $2`,
        [userId, month],
      );
      return mapBudgetRow(result.rows[0]);
    },

    /** Inserts a budget. A duplicate (user_id, month) surfaces as a pg
     * unique-violation error (code 23505) for the service to translate —
     * the DB constraint is the concurrency arbiter (D-PLN-B2). */
    async createBudget({ userId, month, currencyCode = "USD", incomeMinor, categories }) {
      const result = await pool.query(
        `INSERT INTO budget_periods (user_id, month, currency_code, income_minor, categories)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING ${RETURNING}`,
        [userId, month, currencyCode, incomeMinor, JSON.stringify(categories)],
      );
      return mapBudgetRow(result.rows[0]);
    },

    /** Updates income/plans of a user-owned budget. Returns null when the
     * user does not own a budget for that month (same 404 path as absent). */
    async updateBudget({ userId, month, incomeMinor, categories }) {
      const result = await pool.query(
        `UPDATE budget_periods
         SET income_minor = $3, categories = $4::jsonb, updated_at = now()
         WHERE user_id = $1 AND month = $2
         RETURNING ${RETURNING}`,
        [userId, month, incomeMinor, JSON.stringify(categories)],
      );
      return mapBudgetRow(result.rows[0]);
    },
  };
}
