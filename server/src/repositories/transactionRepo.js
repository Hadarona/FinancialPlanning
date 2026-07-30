// Transaction repository. Factory-created from a pg Pool. Every query
// filters by user_id (ownership at the data-access layer). All money values
// are integer minor units; bigints come back from pg as strings and are
// converted with Number() (safely below 2^53 for any realistic budget).

const POSTGRES_UNIQUE_VIOLATION = "23505";

/** `occurred_on::text` keeps dates as plain "YYYY-MM-DD" strings —
 * decision #6: no timezone math, so pg's Date parsing is bypassed. */
const RETURNING =
  "id, category_id, amount_minor, occurred_on::text AS occurred_on, note, created_at";

function mapTransactionRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    categoryId: row.category_id,
    amountMinor: Number(row.amount_minor),
    occurredOn: row.occurred_on,
    note: row.note,
    createdAt: row.created_at,
  };
}

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

    /**
     * Inserts one expense. When `clientRequestId` collides with an existing
     * row of the same budget period (the partial unique index), the existing
     * row is returned with `existed: true` — retries are idempotent
     * (decision #8, D-EXP-B6).
     */
    async insert({
      userId,
      budgetPeriodId,
      categoryId,
      amountMinor,
      occurredOn,
      note,
      clientRequestId,
    }) {
      try {
        const result = await pool.query(
          `INSERT INTO transactions
             (user_id, budget_period_id, category_id, amount_minor, occurred_on, note, client_request_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING ${RETURNING}`,
          [
            userId,
            budgetPeriodId,
            categoryId,
            amountMinor,
            occurredOn,
            note ?? null,
            clientRequestId ?? null,
          ],
        );
        return { transaction: mapTransactionRow(result.rows[0]), existed: false };
      } catch (err) {
        if (err?.code === POSTGRES_UNIQUE_VIOLATION && clientRequestId) {
          const existing = await pool.query(
            `SELECT ${RETURNING} FROM transactions
             WHERE user_id = $1 AND budget_period_id = $2 AND client_request_id = $3`,
            [userId, budgetPeriodId, clientRequestId],
          );
          if (existing.rows[0]) {
            return { transaction: mapTransactionRow(existing.rows[0]), existed: true };
          }
        }
        throw err;
      }
    },

    /** Deletes one user-owned transaction inside one budget period.
     * Returns true when a row was removed. */
    async deleteByIdAndUser({ userId, budgetPeriodId, transactionId }) {
      const result = await pool.query(
        `DELETE FROM transactions
         WHERE id = $1 AND user_id = $2 AND budget_period_id = $3`,
        [transactionId, userId, budgetPeriodId],
      );
      return result.rowCount > 0;
    },

    /** Deterministic history ordering: occurred_on DESC, created_at DESC,
     * id DESC (documented in the REST contract). */
    async listByBudget({ userId, budgetPeriodId, limit, offset }) {
      const result = await pool.query(
        `SELECT ${RETURNING} FROM transactions
         WHERE user_id = $1 AND budget_period_id = $2
         ORDER BY occurred_on DESC, created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [userId, budgetPeriodId, limit, offset],
      );
      return result.rows.map(mapTransactionRow);
    },

    async countByBudget({ userId, budgetPeriodId }) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS total FROM transactions
         WHERE user_id = $1 AND budget_period_id = $2`,
        [userId, budgetPeriodId],
      );
      return result.rows[0].total;
    },
  };
}
