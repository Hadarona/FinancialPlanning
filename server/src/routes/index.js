import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import { createAuthRoutes } from "./authRoutes.js";
import { createBudgetRoutes } from "./budgetRoutes.js";

export function createApiRouter({
  config,
  authService,
  budgetService,
  requireAuth,
  authRateLimit,
}) {
  const router = Router();
  router.use(healthRoutes);
  router.use("/auth", createAuthRoutes({ authService, config, requireAuth, authRateLimit }));
  router.use("/budgets", createBudgetRoutes({ budgetService, requireAuth }));
  return router;
}
