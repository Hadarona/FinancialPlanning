import { AppError } from "../errors.js";

export function createErrorHandler(errorLogger) {
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    const requestId = req.id;

    // Map body-parser failures onto the documented envelope instead of
    // letting them fall through as opaque 500s: an oversized body is the
    // documented 413 (32 kb limit), and unparseable JSON is a plain
    // validation failure, not a server error.
    if (err?.type === "entity.too.large") {
      err = new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");
    } else if (err?.type === "entity.parse.failed") {
      err = new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
    }

    if (err instanceof AppError) {
      if (err.status >= 500) {
        errorLogger.error(
          {
            requestId,
            method: req.method,
            route: req.originalUrl,
            status: err.status,
            err: err.message,
          },
          "internal error",
        );
      }
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
          requestId,
        },
      });
      return;
    }

    // Unknown/unexpected error: never leak details or stack traces to the client.
    errorLogger.error(
      {
        requestId,
        method: req.method,
        route: req.originalUrl,
        status: 500,
        err: err?.stack ?? String(err),
      },
      "unhandled error",
    );
    res.status(500).json({
      error: {
        code: "INTERNAL",
        message: "Something went wrong. Please try again.",
        requestId,
      },
    });
  };
}
