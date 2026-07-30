import { Router } from "express";
import { monthParamsSchema } from "../validation/schemas.js";
import { validateParams } from "../middleware/validate.js";
import { createBudgetController } from "../controllers/budgetController.js";

export function createBudgetRoutes({ budgetService, requireAuth }) {
  const router = Router();
  const controller = createBudgetController({ budgetService });

  router.get("/:month", requireAuth, validateParams(monthParamsSchema), controller.getBudget);

  return router;
}
