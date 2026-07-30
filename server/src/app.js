import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestId } from "./middleware/requestId.js";
import { createHttpLogger } from "./logging/httpLogger.js";
import { createLoggers } from "./logging/logger.js";
import { notFound } from "./middleware/notFound.js";
import { createErrorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routes/index.js";

/**
 * Builds one fully-wired Express app instance. Loggers are created here,
 * scoped to the given `config`, and exposed via `app.locals.cleanup()` —
 * there is no shared module-level singleton, so a real process and any
 * number of isolated test servers can coexist safely in the same Node
 * process.
 */
export function createApp(config) {
  const app = express();
  const allowedOrigins = config.corsOrigin.split(",").map((origin) => origin.trim());

  const loggers = createLoggers(config);
  app.locals.config = config;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / non-browser requests (no Origin header) are allowed.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(createHttpLogger(loggers.requestLogger));

  if (config.nodeEnv === "test") {
    app.get("/api/v1/__test/error", () => {
      throw new Error("forced test error");
    });
  }

  app.use("/api/v1", apiRouter);

  if (config.serveClient) {
    const clientDist = path.join(config.repoRoot ?? process.cwd(), "client", "dist");
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(notFound);
  app.use(createErrorHandler(loggers.errorLogger));

  app.locals.cleanup = async () => {
    await loggers.close();
  };

  return app;
}
