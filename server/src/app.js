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
import { createApiRouter } from "./routes/index.js";
import { createPool } from "./db/pool.js";
import { createUserRepo } from "./repositories/userRepo.js";
import { createBudgetRepo } from "./repositories/budgetRepo.js";
import { createTransactionRepo } from "./repositories/transactionRepo.js";
import { createAuthService } from "./services/authService.js";
import { createBudgetService } from "./services/budgetService.js";
import { createTransactionService } from "./services/transactionService.js";
import { createInsightsService } from "./services/insightsService.js";
import { createRequireAuth } from "./middleware/auth.js";
import { createGeneralRateLimit, createAuthRateLimit } from "./middleware/rateLimit.js";

/**
 * Builds one fully-wired Express app instance. Every stateful resource
 * (DB pool, loggers) is created here, scoped to the given `config`, and
 * exposed via `app.locals.cleanup()` — there are no shared module-level
 * singletons, so a real process and any number of isolated test servers can
 * coexist safely in the same Node process.
 */
export function createApp(config) {
  const app = express();
  const allowedOrigins = config.corsOrigin.split(",").map((origin) => origin.trim());

  const pool = createPool(config);
  const loggers = createLoggers(config);
  const userRepo = createUserRepo(pool);
  const budgetRepo = createBudgetRepo(pool);
  const transactionRepo = createTransactionRepo(pool);
  // budgetService is wired before authService: registration provisions the
  // default budget (CR1-9).
  const budgetService = createBudgetService({ budgetRepo, transactionRepo });
  const authService = createAuthService({ userRepo, budgetService, config });
  const transactionService = createTransactionService({ budgetRepo, transactionRepo });
  const insightsService = createInsightsService({ budgetRepo, transactionRepo });
  const requireAuth = createRequireAuth({ authService, userRepo });

  app.locals.config = config;
  app.locals.pool = pool;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / non-browser requests (no Origin header) are allowed.
        // A foreign Origin gets `false`: no Access-Control-Allow-* headers
        // are emitted, so browsers refuse to share the response and every
        // preflighted (credentialed JSON) request never leaves the browser.
        // `callback(new Error(...))` would instead surface as an opaque 500.
        callback(null, !origin || allowedOrigins.includes(origin));
      },
      credentials: true,
    }),
  );
  // requestId comes before the body parser so even a request rejected while
  // parsing (413 oversized / malformed JSON) is correlated by an id.
  app.use(requestId);
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use(createHttpLogger(loggers.requestLogger));
  app.use(createGeneralRateLimit(config));

  if (config.nodeEnv === "test") {
    app.get("/api/v1/__test/error", () => {
      throw new Error("forced test error");
    });
  }

  app.use(
    "/api/v1",
    createApiRouter({
      config,
      authService,
      budgetService,
      transactionService,
      insightsService,
      requireAuth,
      authRateLimit: createAuthRateLimit(config),
    }),
  );

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
    await pool.end();
    await loggers.close();
  };

  return app;
}
