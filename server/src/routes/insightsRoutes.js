import { Router } from "express";
import { insightsQuerySchema } from "../validation/schemas.js";
import { validateQuery } from "../middleware/validate.js";
import { createInsightsController } from "../controllers/insightsController.js";

/** Mounted at /insights — multi-month comparison (CR-001 item 3):
 * `GET /?months=YYYY-MM[,YYYY-MM[,YYYY-MM]]`, 1–3 unique months. */
export function createInsightsRoutes({ insightsService, requireAuth }) {
  const router = Router();
  const controller = createInsightsController({ insightsService });

  router.get(
    "/",
    requireAuth,
    validateQuery(insightsQuerySchema),
    controller.getInsights,
  );

  return router;
}
