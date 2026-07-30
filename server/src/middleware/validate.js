import { AppError } from "../errors.js";

/** Express middleware factory: validates `req.body` against a zod schema. */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      next(
        new AppError("VALIDATION_ERROR", "Please check the highlighted fields.", {
          fieldErrors,
        }),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}
