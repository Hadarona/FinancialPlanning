import { AppError } from "../errors.js";

export function notFound(req, res, next) {
  next(new AppError("NOT_FOUND", "The requested resource was not found."));
}
