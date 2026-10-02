import { AppError } from "../errors.js";
function map(row) {
  return row
    ? {
        id: row.id,
        userId: row.user_id,
        currencyCode: row.currency_code,
        revision: row.revision,
        effectiveMonth: row.effective_month,
        incomeMinor: Number(row.income_minor),
        categories: row.categories,
      }
    : null;
}
export function createBudgetRepo(pool) {
  return {
    async findByUser(
      userId,
      month = new Date().toISOString().slice(0, 7),
      queryable = pool,
    ) {
      const result = await queryable.query(
        `SELECT b.id,b.user_id,b.currency_code,b.revision,v.*
        FROM budgets b JOIN LATERAL (SELECT income_minor,categories,effective_month FROM budget_versions
        WHERE budget_id=b.id AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1) v ON true
        WHERE b.user_id=$1`,
        [userId, month],
      );
      return map(result.rows[0]);
    },
    async createBudget(
      { userId, currencyCode = "ILS", incomeMinor, categories },
      queryable = pool,
    ) {
      const result = await queryable.query(
        `INSERT INTO budgets(user_id,currency_code,income_minor,categories)
        VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
        [userId, currencyCode, incomeMinor, JSON.stringify(categories)],
      );
      return map(result.rows[0]);
    },
    async updateBudget({ userId, incomeMinor, categories, effectiveMonth, revision }) {
      return pool.withTransaction(async (db) => {
        const locked = await db.query(
          "SELECT * FROM budgets WHERE user_id=$1 FOR UPDATE",
          [userId],
        );
        const row = locked.rows[0];
        if (!row) return null;
        if (revision !== undefined && revision !== row.revision)
          throw new AppError("CONFLICT", "The budget changed. Refresh before saving.");
        // Replacing a scheduled plan must never hide expenses in categories introduced later.
        const future = await db.query(
          "SELECT categories FROM budget_versions WHERE budget_id=$1 AND effective_month>$2 ORDER BY effective_month",
          [row.id, effectiveMonth],
        );
        const known = new Set(categories.map((c) => c.id));
        for (const version of future.rows)
          for (const category of version.categories) {
            if (!known.has(category.id)) {
              categories.push({ ...category, plannedMinor: 0, archived: true });
              known.add(category.id);
            }
          }
        await db.query(
          "DELETE FROM budget_versions WHERE budget_id=$1 AND effective_month >= $2",
          [row.id, effectiveMonth],
        );
        await db.query("INSERT INTO budget_versions VALUES ($1,$2,$3,$4::jsonb)", [
          row.id,
          effectiveMonth,
          incomeMinor,
          JSON.stringify(categories),
        ]);
        await db.query(
          "UPDATE budgets SET revision=revision+1,updated_at=now() WHERE id=$1",
          [row.id],
        );
        return map({
          ...row,
          revision: row.revision + 1,
          income_minor: incomeMinor,
          categories,
          effective_month: effectiveMonth,
        });
      });
    },
  };
}
