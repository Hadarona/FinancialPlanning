// Transaction repository. Factory-created from a pg Pool. Every query
// filters by user_id (ownership at the data-access layer). All money values
// are integer minor units; bigints come back from pg as strings and are
// converted with Number() (safely below 2^53 for any realistic budget).
// Stage D extends this module with insert/delete/list for the expenses API.

export function createTransactionRepo(pool) {
  return {
    /** Per-category actual spending for one user-owned budget period:
     * `{ [categoryId]: integer minor units }`. */
    async sumByCategory(userId, budgetPeriodId) {
      const result = await pool.query(
        `SELECT category_id, SUM(amount_minor) AS total_minor
         FROM transactions
         WHERE user_id = $1 AND budget_period_id = $2
         GROUP BY category_id`,
        [userId, budgetPeriodId],
      );
      const totals = {};
      for (const row of result.rows) {
        totals[row.category_id] = Number(row.total_minor);
      }
      return totals;
    },
  };
}
