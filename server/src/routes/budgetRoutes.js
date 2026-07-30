import { Router } from "express";
import {
  monthParamsSchema,
  createBudgetSchema,
  patchBudgetSchema,
} from "../validation/schemas.js";
import { validate, validateParams } from "../middleware/validate.js";
import { createBudgetController } from "../controllers/budgetController.js";

export function createBudgetRoutes({ budgetService, requireAuth }) {
  const router = Router();
  const controller = createBudgetController({ budgetService });

  router.post("/", requireAuth, validate(createBudgetSchema), controller.createBudget);
  router.get("/:month", requireAuth, validateParams(monthParamsSchema), controller.getBudget);
  router.patch(
    "/:month",
    requireAuth,
    validateParams(monthParamsSchema),
    validate(patchBudgetSchema),
    controller.updateBudget,
  );

  return router;
}
