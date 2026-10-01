import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import { createAuthRoutes } from "./authRoutes.js";
import { createBudgetRoutes } from "./budgetRoutes.js";
import { createMonthRoutes } from "./monthRoutes.js";
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
  budgetAccess,
}) {
  const router = Router();
  router.use(healthRoutes);
  router.use(
    "/auth",
    createAuthRoutes({ authService, config, requireAuth, authRateLimit }),
  );
  const budgetAuth = budgetAccess ? [requireAuth, budgetAccess] : requireAuth;
  router.use(
    "/insights",
    createInsightsRoutes({ insightsService, requireAuth: budgetAuth }),
  );
  router.use(
    "/budget",
    createBudgetRoutes({
      budgetService,
      requireAuth: budgetAuth,
      provisionAuth: requireAuth,
    }),
  );
  // Nested transaction routes stay mounted BEFORE /months so the
  // mergeParams router wins on the shared prefix.
  router.use(
    "/months/:month/transactions",
    createTransactionRoutes({ transactionService, requireAuth: budgetAuth }),
  );
  router.use("/months", createMonthRoutes({ budgetService, requireAuth: budgetAuth }));
  return router;
}
