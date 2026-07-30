import pinoHttp from "pino-http";

// Metadata-only HTTP request logging: no request/response bodies, no headers
// (so no cookies or authorization tokens can ever be captured here).
export function createHttpLogger(requestLogger) {
  return pinoHttp({
    logger: requestLogger,
    genReqId: (req) => req.id,
    customAttributeKeys: { responseTime: "durationMs" },
    customProps: (req, res) => ({
      requestId: req.id,
      userId: req.user?.id,
      method: req.method,
      route: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl,
      status: res.statusCode,
    }),
    serializers: {
      req: () => undefined,
      res: () => undefined,
    },
  });
}
