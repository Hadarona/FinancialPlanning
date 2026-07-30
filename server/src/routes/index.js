import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import { createAuthRoutes } from "./authRoutes.js";
import { createBudgetRoutes } from "./budgetRoutes.js";
import { createTransactionRoutes } from "./transactionRoutes.js";
import { createInsightsRoutes } from "./insightsRoutes.js";

export function createApiRouter({
  config,
  authService,
  budgetService,
  transactionService,
  insightsService,
  requireAuth,
  authRateLimit,
}) {
  const router = Router();
  router.use(healthRoutes);
  router.use(
    "/auth",
    createAuthRoutes({ authService, config, requireAuth, authRateLimit }),
  );
  router.use("/insights", createInsightsRoutes({ insightsService, requireAuth }));
  // Nested transaction routes stay mounted BEFORE /budgets so the
  // mergeParams router wins on the shared prefix.
  router.use(
    "/budgets/:month/transactions",
    createTransactionRoutes({ transactionService, requireAuth }),
  );
  router.use("/budgets", createBudgetRoutes({ budgetService, requireAuth }));
  return router;
}
