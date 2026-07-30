import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters."),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
  })
  .strict();

/** Calendar month route segment, strictly `YYYY-MM` (D-BUD-B1). */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format.");

export const monthParamsSchema = z.object({ month: monthSchema });

/** Expense creation body (D-EXP-B1/B2). Money is an integer number of minor
 * units; the date is a plain calendar string (decision #6) whose membership
 * in `:month` is enforced by the service. */
export const createTransactionSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Choose a category."),
    amountMinor: z
      .number({ invalid_type_error: "Enter an amount." })
      .int("Amount must be a whole number of cents.")
      .positive("Amount must be greater than zero."),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD."),
    note: z
      .string()
      .trim()
      .max(200, "Note must be at most 200 characters.")
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
    clientRequestId: z.string().uuid("Invalid request id.").optional(),
  })
  .strict();

/** Transaction list query: documented bounds, deterministic defaults. */
export const listTransactionsQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int("Limit must be an integer.")
      .min(1, "Limit must be at least 1.")
      .max(200, "Limit must be at most 200.")
      .default(50),
    offset: z.coerce
      .number()
      .int("Offset must be an integer.")
      .min(0, "Offset must be zero or greater.")
      .default(0),
  })
  .strict();
