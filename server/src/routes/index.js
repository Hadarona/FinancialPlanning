import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import { createAuthRoutes } from "./authRoutes.js";

export function createApiRouter({ config, authService, requireAuth, authRateLimit }) {
  const router = Router();
  router.use(healthRoutes);
  router.use("/auth", createAuthRoutes({ authService, config, requireAuth, authRateLimit }));
  return router;
}
