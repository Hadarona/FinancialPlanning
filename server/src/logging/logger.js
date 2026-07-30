import path from "node:path";
import fs from "node:fs";
import pino from "pino";

// Redact anything that could leak secrets or private financial content, even
// though our custom serializers already omit raw req/res objects.
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "note",
  "*.password",
  "*.note",
  'res.headers["set-cookie"]',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createRollingLogger(logDir, fileName, level, { size = "5m", keep = 5 } = {}) {
  ensureDir(logDir);
  const transport = pino.transport({
    target: "pino-roll",
    options: {
      file: path.join(logDir, fileName),
      size,
      limit: { count: keep },
      mkdir: true,
      // pino-roll always appends a rotation number to `file`, producing
      // LOG_DIR/requests.log.1, LOG_DIR/requests.log.2, etc. (its `symlink`
      // option collides across loggers because it always names the link
      // "current.log" in the same directory, so it is intentionally unused
      // here — callers glob for the `<fileName>.<n>` family instead.)
    },
  });
  const instance = pino(
    { level, redact: { paths: REDACT_PATHS, censor: "[redacted]" } },
    transport,
  );
  instance.transportStream = transport;
  return instance;
}

function closeTransport(instance, timeoutMs = 5000) {
  const stream = instance.transportStream;
  if (!stream?.end) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    stream.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    stream.end();
  });
}

/**
 * Creates a fresh pair of rotating loggers scoped to `config.logDir`.
 * Deliberately not a module-level singleton — each server instance (real
 * process or isolated test server) gets its own loggers writing to its own
 * log directory, so test isolation cannot leak into the real `logs/` dir.
 */
export function createLoggers(config) {
  // Rotation bounds are fixed in production (5 MB × 5 files); the optional
  // config fields exist so the log-rotation proof test can exercise the same
  // code path with tiny bounds instead of writing 25 MB per run.
  const rotation = {
    ...(config.logRotateSize ? { size: config.logRotateSize } : {}),
    ...(config.logRotateKeep ? { keep: config.logRotateKeep } : {}),
  };
  const requestLogger = createRollingLogger(config.logDir, "requests.log", "info", rotation);
  const errorLogger = createRollingLogger(config.logDir, "error.log", "error", rotation);

  async function close() {
    await Promise.allSettled([closeTransport(requestLogger), closeTransport(errorLogger)]);
  }

  return { requestLogger, errorLogger, close };
}
