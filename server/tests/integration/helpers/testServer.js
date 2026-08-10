import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { dropSchema } from "../../../src/db/migrate.js";
import { generateSchemaName } from "./testDb.js";

/**
 * Boots a real listening HTTP server against an isolated DB schema and a
 * temporary log directory. Every product module (config/app/pool/loggers) is
 * built from a *local* env object, never by mutating the shared global
 * `process.env` — mutating it would race with any other test file whose
 * `beforeAll` happens to interleave (e.g. `npm run coverage` runs unit and
 * integration files without `--no-file-parallelism`), since two files could
 * end up reading each other's DB_SCHEMA/LOG_DIR overrides.
 */
export async function startTestServer(envOverrides = {}) {
  const schema = envOverrides.schema ?? generateSchemaName();
  const logDir = path.join(os.tmpdir(), `budgeting-app-test-logs-${randomUUID()}`);

  // Importing config.js runs its one-time dotenv.config() side effect
  // (populating process.env.DATABASE_URL etc. the first time only), which
  // this local testEnv object then reads — without ever writing back to
  // the shared process.env.
  const { loadConfig } = await import("../../../src/config.js");
  const testEnv = {
    ...process.env,
    // NODE_ENV is overridable so e.g. the production cookie-flag test can
    // boot a production-mode app against an isolated test schema.
    NODE_ENV: envOverrides.NODE_ENV ?? "test",
    DB_SCHEMA: schema,
    LOG_DIR: logDir,
  };
  if (envOverrides.RATE_LIMIT_AUTH_MAX) {
    testEnv.RATE_LIMIT_AUTH_MAX = String(envOverrides.RATE_LIMIT_AUTH_MAX);
  }
  if (envOverrides.RATE_LIMIT_MAX) {
    testEnv.RATE_LIMIT_MAX = String(envOverrides.RATE_LIMIT_MAX);
  }
  const config = loadConfig(testEnv);

  const { migrate } = await import("../../../src/db/migrate.js");
  await migrate({ databaseUrl: config.databaseUrl, schema: config.dbSchema });

  const { createApp } = await import("../../../src/app.js");
  const app = createApp(config);

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  return {
    baseUrl,
    config,
    schema: config.dbSchema,
    logDir,
    // pino-roll always appends a rotation number to the configured file name
    // (e.g. "requests.log" -> "requests.log.1", "requests.log.2", ...), so
    // this reads and merges every file in the rotation family, in order.
    async readLogFile(fileName) {
      let entries = [];
      let dirEntries;
      try {
        dirEntries = await fs.readdir(logDir);
      } catch (err) {
        if (err.code === "ENOENT") {
          return [];
        }
        throw err;
      }
      const family = dirEntries
        .filter((name) => name === fileName || name.startsWith(`${fileName}.`))
        .sort((a, b) => {
          const numA = Number(a.split(".").pop());
          const numB = Number(b.split(".").pop());
          return (Number.isNaN(numA) ? 0 : numA) - (Number.isNaN(numB) ? 0 : numB);
        });
      for (const name of family) {
        const content = await fs.readFile(path.join(logDir, name), "utf8");
        entries = entries.concat(
          content
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
        );
      }
      return entries;
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await app.locals.cleanup();
      await dropSchema({ databaseUrl: config.databaseUrl, schema: config.dbSchema });
      await fs.rm(logDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** Minimal manual cookie jar so integration tests can preserve the session cookie across requests. */
export function createCookieJarFetch(baseUrl) {
  let cookies = {};

  function applySetCookie(response) {
    const raw =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const entry of raw) {
      const [pair] = entry.split(";");
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) continue;
      const name = pair.slice(0, eqIndex).trim();
      const value = pair.slice(eqIndex + 1).trim();
      cookies[name] = value;
    }
  }

  function cookieHeader() {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function request(pathName, init = {}) {
    const headers = new Headers(init.headers || {});
    const cookieStr = cookieHeader();
    if (cookieStr) {
      headers.set("Cookie", cookieStr);
    }
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${baseUrl}${pathName}`, { ...init, headers });
    applySetCookie(response);
    return response;
  }

  return {
    request,
    get cookies() {
      return { ...cookies };
    },
    clear() {
      cookies = {};
    },
  };
}
