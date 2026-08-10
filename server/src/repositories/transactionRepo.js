// Transaction repository. Factory-created from a pg Pool. Every query
// filters by user_id (ownership at the data-access layer). All money values
// are integer minor units; bigints come back from pg as strings and are
// converted with Number() (safely below 2^53 for any realistic budget).
//
// CR-001: transactions no longer link to a budget period — month membership
// is derived from occurred_on, so every monthly query takes a
// { firstDay, lastDay } calendar range (pure date comparison, decision #6).

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
    /** Per-category actual spending for one user-owned calendar month:
     * `{ [categoryId]: integer minor units }`. */
    async sumByCategory(userId, { firstDay, lastDay }) {
      const result = await pool.query(
        `SELECT category_id, SUM(amount_minor) AS total_minor
         FROM transactions
         WHERE user_id = $1 AND occurred_on >= $2 AND occurred_on <= $3
         GROUP BY category_id`,
        [userId, firstDay, lastDay],
      );
      const totals = {};
      for (const row of result.rows) {
        totals[row.category_id] = Number(row.total_minor);
      }
      return totals;
    },

    /** Per-day actual spending for one user-owned calendar month:
     * `{ "YYYY-MM-DD": integer minor units }`. `occurred_on::text` keeps the
     * key a plain calendar string (decision #6 — pg date parsing bypassed). */
    async sumByDay(userId, { firstDay, lastDay }) {
      const result = await pool.query(
        `SELECT occurred_on::text AS occurred_on, SUM(amount_minor) AS total_minor
         FROM transactions
         WHERE user_id = $1 AND occurred_on >= $2 AND occurred_on <= $3
         GROUP BY occurred_on`,
        [userId, firstDay, lastDay],
      );
      const totals = {};
      for (const row of result.rows) {
        totals[row.occurred_on] = Number(row.total_minor);
      }
      return totals;
    },

    /**
     * Inserts one expense. When `clientRequestId` collides with an existing
     * row of the same user (the partial unique index, re-scoped by CR-001
     * to (user_id, client_request_id)), the existing row is returned with
     * `existed: true` — retries are idempotent (decision #8).
     */
    async insert({ userId, categoryId, amountMinor, occurredOn, note, clientRequestId }) {
      try {
        const result = await pool.query(
          `INSERT INTO transactions
             (user_id, category_id, amount_minor, occurred_on, note, client_request_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${RETURNING}`,
          [
            userId,
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
             WHERE user_id = $1 AND client_request_id = $2`,
            [userId, clientRequestId],
          );
          if (existing.rows[0]) {
            return { transaction: mapTransactionRow(existing.rows[0]), existed: true };
          }
        }
        throw err;
      }
    },

    /** Deletes one user-owned transaction inside one calendar month (the
     * range keeps DELETE /months/:month/... 404ing for an id outside the
     * month). Returns true when a row was removed. */
    async deleteByIdAndUser({ userId, transactionId, firstDay, lastDay }) {
      const result = await pool.query(
        `DELETE FROM transactions
         WHERE id = $1 AND user_id = $2 AND occurred_on >= $3 AND occurred_on <= $4`,
        [transactionId, userId, firstDay, lastDay],
      );
      return result.rowCount > 0;
    },

    /** Deterministic history ordering: occurred_on DESC, created_at DESC,
     * id DESC (documented in the REST contract). */
    async listByRange({ userId, firstDay, lastDay, limit, offset }) {
      const result = await pool.query(
        `SELECT ${RETURNING} FROM transactions
         WHERE user_id = $1 AND occurred_on >= $2 AND occurred_on <= $3
         ORDER BY occurred_on DESC, created_at DESC, id DESC
         LIMIT $4 OFFSET $5`,
        [userId, firstDay, lastDay, limit, offset],
      );
      return result.rows.map(mapTransactionRow);
    },

    async countByRange({ userId, firstDay, lastDay }) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS total FROM transactions
         WHERE user_id = $1 AND occurred_on >= $2 AND occurred_on <= $3`,
        [userId, firstDay, lastDay],
      );
      return result.rows[0].total;
    },
  };
}
