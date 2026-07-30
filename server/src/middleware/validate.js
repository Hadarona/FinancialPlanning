import { AppError } from "../errors.js";

function collectFieldErrors(issues) {
  const fieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Express middleware factory: validates `req.body` against a zod schema. */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError("VALIDATION_ERROR", "Please check the highlighted fields.", {
          fieldErrors: collectFieldErrors(result.error.issues),
        }),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Express middleware factory: validates `req.params` against a zod schema
 * (e.g. the strict `YYYY-MM` month segment). Parsed values are merged back
 * so later handlers read normalized params. */
export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(
        new AppError("VALIDATION_ERROR", "Invalid request path.", {
          fieldErrors: collectFieldErrors(result.error.issues),
        }),
      );
      return;
    }
    Object.assign(req.params, result.data);
    next();
  };
}

/** Express middleware factory: validates `req.query` against a zod schema
 * (limits/offsets with documented bounds and defaults). */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        new AppError("VALIDATION_ERROR", "Invalid query parameters.", {
          fieldErrors: collectFieldErrors(result.error.issues),
        }),
      );
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
