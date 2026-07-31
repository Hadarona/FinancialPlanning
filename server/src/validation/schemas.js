import { z } from "zod";
import { DEFAULT_CATEGORY_IDS } from "../domain/categories.js";

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

/** One planned allocation. Only `id` + `plannedMinor` are accepted from the
 * client — names/icons/colors/order are server constants (decision #7). */
const plannedCategorySchema = z
  .object({
    id: z.enum(DEFAULT_CATEGORY_IDS, {
      errorMap: () => ({ message: "Unknown category." }),
    }),
    plannedMinor: z
      .number({ invalid_type_error: "Enter a planned amount." })
      .int("Planned amounts must be whole cents.")
      .min(0, "Planned amounts cannot be negative."),
  })
  .strict();

function requireUniqueIds(categories, ctx) {
  const ids = categories.map((category) => category.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each category may appear only once.",
    });
  }
}

/** `POST /budget` takes NO body (CR-001: the default budget is built from
 * server constants). Absent bodies pass; any supplied key is rejected. */
export const emptyBodySchema = z.object({}).strict().optional();

/** Budget update body: income and/or a subset of category plans. */
export const patchBudgetSchema = z
  .object({
    incomeMinor: z
      .number({ invalid_type_error: "Enter your income." })
      .int("Income must be whole cents.")
      .min(0, "Income cannot be negative.")
      .optional(),
    categories: z
      .array(plannedCategorySchema)
      .min(1, "Provide at least one category plan.")
      .max(7, "There are only seven categories.")
      .superRefine(requireUniqueIds)
      .optional(),
  })
  .strict()
  .refine((body) => body.incomeMinor !== undefined || body.categories !== undefined, {
    message: "Provide income or category plans to update.",
  });

function requireUniqueMonths(months, ctx) {
  if (new Set(months).size !== months.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each month may appear only once.",
    });
  }
}

/** `GET /insights` query (CR3-3): `months` is required — 1–3 unique
 * comma-separated `YYYY-MM` values. 0, 4+, duplicates, or malformed values
 * answer 400 VALIDATION_ERROR. */
export const insightsQuerySchema = z
  .object({
    months: z
      .string({ required_error: "Select at least one month." })
      .transform((value) => value.split(","))
      .pipe(
        z
          .array(monthSchema)
          .min(1, "Select at least one month.")
          .max(3, "Select at most three months.")
          .superRefine(requireUniqueMonths),
      ),
  })
  .strict();

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
