import { Router } from "express";
import { monthParamsSchema } from "../validation/schemas.js";
import { validateParams } from "../middleware/validate.js";
import { createInsightsController } from "../controllers/insightsController.js";

export function createInsightsRoutes({ insightsService, requireAuth }) {
  const router = Router();
  const controller = createInsightsController({ insightsService });

  router.get(
    "/:month",
    requireAuth,
    validateParams(monthParamsSchema),
    controller.getInsights,
  );

  return router;
}
