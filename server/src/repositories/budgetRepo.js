// Budget repository (CR-001: ONE budget per user, applied to every month).
// Factory-created from a pg Pool (no module-level singletons). Every query
// filters by user_id — ownership is enforced at the data-access layer, not
// just in controllers.

/** Maps a budgets row to camelCase with numeric money fields.
 * `income_minor` is a Postgres bigint, which pg returns as a string. */
function mapBudgetRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    currencyCode: row.currency_code,
    incomeMinor: Number(row.income_minor),
    categories: row.categories,
  };
}

const RETURNING = "id, user_id, currency_code, income_minor, categories";

export function createBudgetRepo(pool) {
  return {
    async findByUser(userId) {
      const result = await pool.query(
        `SELECT ${RETURNING} FROM budgets WHERE user_id = $1`,
        [userId],
      );
      return mapBudgetRow(result.rows[0]);
    },

    /** Inserts the user's single budget. A duplicate user_id surfaces as a
     * pg unique-violation error (code 23505) for the service to translate —
     * the DB constraint is the concurrency arbiter. */
    async createBudget({ userId, currencyCode = "USD", incomeMinor, categories }) {
      const result = await pool.query(
        `INSERT INTO budgets (user_id, currency_code, income_minor, categories)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING ${RETURNING}`,
        [userId, currencyCode, incomeMinor, JSON.stringify(categories)],
      );
      return mapBudgetRow(result.rows[0]);
    },

    /** Updates income/plans of the user-owned budget. Returns null when the
     * user has no budget row (same 404 path as absent). */
    async updateBudget({ userId, incomeMinor, categories }) {
      const result = await pool.query(
        `UPDATE budgets
         SET income_minor = $2, categories = $3::jsonb, updated_at = now()
         WHERE user_id = $1
         RETURNING ${RETURNING}`,
        [userId, incomeMinor, JSON.stringify(categories)],
      );
      return mapBudgetRow(result.rows[0]);
    },
  };
}
