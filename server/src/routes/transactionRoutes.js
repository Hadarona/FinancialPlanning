import { Router } from "express";
import {
  monthParamsSchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "../validation/schemas.js";
import { validate, validateParams, validateQuery } from "../middleware/validate.js";
import { createTransactionController } from "../controllers/transactionController.js";

/** Mounted at /budgets/:month/transactions — mergeParams exposes :month. */
export function createTransactionRoutes({ transactionService, requireAuth }) {
  const router = Router({ mergeParams: true });
  const controller = createTransactionController({ transactionService });

  router.use(requireAuth, validateParams(monthParamsSchema));

  router.get("/", validateQuery(listTransactionsQuerySchema), controller.list);
  router.post("/", validate(createTransactionSchema), controller.create);
  // `:id` is deliberately NOT schema-validated to 400: a malformed id takes
  // the same 404 path as a missing/unowned transaction (no leak, D-EXP-B4).
  router.delete("/:id", controller.remove);

  return router;
}
