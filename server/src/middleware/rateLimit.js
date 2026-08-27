import rateLimit from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

function rateLimitedHandler(message) {
  return (req, res) => {
    res.status(429).json({
      error: { code: "RATE_LIMITED", message, requestId: req.id },
    });
  };
}

export function createGeneralRateLimit(config) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler("Too many requests. Please try again later."),
  });
}

export function createAuthRateLimit(config) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max: config.rateLimitAuthMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler("Too many attempts. Please try again later."),
  });
}
