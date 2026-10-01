import { AppError } from "../errors.js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keep the authenticated identity intact. Only budget controllers use budgetOwnerId.
export function createBudgetAccess(pool) {
  return async (req, res, next) => {
    try {
      const selected = req.get("X-Budget-Id");
      if (selected && !uuid.test(selected))
        throw new AppError("NOT_FOUND", "Budget not found.");
      const result = await pool.query(
        `SELECT b.id,b.user_id,
        CASE WHEN b.user_id=$1 THEN 'owner' ELSE m.role END AS role
        FROM budgets b LEFT JOIN budget_members m ON m.budget_id=b.id AND m.user_id=$1
        WHERE ${selected ? "b.id=$2" : "b.user_id=$1"} AND (b.user_id=$1 OR m.user_id=$1)`,
        selected ? [req.user.id, selected] : [req.user.id],
      );
      const budget = result.rows[0];
      if (!budget) throw new AppError("NOT_FOUND", "Budget not found.");
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && budget.role === "viewer")
        throw new AppError("FORBIDDEN", "This budget is read-only.");
      req.budgetId = budget.id;
      req.budgetOwnerId = budget.user_id;
      req.budgetRole = budget.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
