import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(currentDir, "..", "..");

dotenv.config({ path: path.join(repoRoot, ".env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "required"),
  JWT_SECRET: z.string().min(1, "required"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_DIR: z.string().min(1).default(path.join(repoRoot, "logs")),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  DB_SCHEMA: z.string().min(1).default("public"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  ALLOW_DEMO_SEED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  SERVE_CLIENT: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

function loadConfig(rawEnv = process.env) {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const missingOrInvalid = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    // Never print values, only the names of the offending variables.
    console.error(
      `Configuration error: invalid or missing environment variable(s): ${missingOrInvalid.join(", ")}`,
    );
    process.exit(1);
  }
  const env = result.data;
  return {
    repoRoot,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    logDir: env.LOG_DIR,
    corsOrigin: env.CORS_ORIGIN,
    dbSchema: env.DB_SCHEMA,
    bcryptRounds: env.BCRYPT_ROUNDS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
    allowDemoSeed: env.ALLOW_DEMO_SEED === true,
    serveClient: env.SERVE_CLIENT === true,
  };
}

// Intentionally no eagerly-created singleton here: every consumer (index.js
// for the real process, test helpers for isolated runs) must call
// `loadConfig()` itself, after any environment overrides are in place. A
// module-level singleton created as an import side effect would lock in
// whatever `process.env` looked like at first import — before per-test
// overrides (DB_SCHEMA, LOG_DIR, ...) are set — and silently defeat test
// isolation (e.g. tests would touch the real `public` schema).
export { loadConfig };
