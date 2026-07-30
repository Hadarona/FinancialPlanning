import { AppError } from "../errors.js";

export function createErrorHandler(errorLogger) {
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    const requestId = req.id;

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
