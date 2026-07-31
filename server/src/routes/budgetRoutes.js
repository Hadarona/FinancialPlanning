import { Router } from "express";
import { emptyBodySchema, patchBudgetSchema } from "../validation/schemas.js";
import { validate } from "../middleware/validate.js";
import { createBudgetController } from "../controllers/budgetController.js";

/** Mounted at /budget — the user's single recurring budget (CR-001). */
export function createBudgetRoutes({ budgetService, requireAuth }) {
  const router = Router();
  const controller = createBudgetController({ budgetService });

  router.get("/", requireAuth, controller.getBudget);
  router.post("/", requireAuth, validate(emptyBodySchema), controller.createBudget);
  router.patch("/", requireAuth, validate(patchBudgetSchema), controller.patchBudget);

  return router;
}
