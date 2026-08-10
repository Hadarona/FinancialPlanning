import { Router } from "express";
import { registerSchema, loginSchema } from "../validation/schemas.js";
import { validate } from "../middleware/validate.js";
import { createAuthController } from "../controllers/authController.js";

export function createAuthRoutes({ authService, config, requireAuth, authRateLimit }) {
  const router = Router();
  const controller = createAuthController({ authService, config });

  router.post("/register", authRateLimit, validate(registerSchema), controller.register);
  router.post("/login", authRateLimit, validate(loginSchema), controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);

  return router;
}
