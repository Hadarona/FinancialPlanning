import { Router } from "express";
import { monthParamsSchema } from "../validation/schemas.js";
import { validateParams } from "../middleware/validate.js";
import { createBudgetController } from "../controllers/budgetController.js";

/** Mounted at /months — per-month read models over the single budget
 * (CR1-3): the same plans for every month, that month's actuals. */
export function createMonthRoutes({ budgetService, requireAuth }) {
  const router = Router();
  const controller = createBudgetController({ budgetService });

  router.get(
    "/:month",
    requireAuth,
    validateParams(monthParamsSchema),
    controller.getMonth,
  );

  return router;
}
