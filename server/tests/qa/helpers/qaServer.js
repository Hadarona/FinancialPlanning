import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { dropSchema } from "../../../src/db/migrate.js";

/** QA-owned schema name generator: distinct prefix from the developer's own
 * `test_<timestamp>_<pid>_<rand8>` helper so a run of both suites can never
 * collide, and always satisfies `SAFE_SCHEMA_NAME` (never "public"). */
export function generateQaSchemaName() {
  return `test_qa_${Date.now()}_${process.pid}_${randomUUID().slice(0, 8)}`;
}

/**
 * Boots one real listening Express server against a fresh, isolated Postgres
 * schema and a temporary log directory — independent of the developer's own
 * `tests/integration/helpers/testServer.js` (QA never imports developer test
 * code). Every product module is built from a *local* env object; `process.env`
 * is never mutated, so this is safe to run alongside any other suite.
 */
export async function startQaServer(overrides = {}) {
  const schema = overrides.schema ?? generateQaSchemaName();
  const logDir = path.join(os.tmpdir(), `qa-logs-${randomUUID()}`);

  const { loadConfig } = await import("../../../src/config.js");
  const envObject = {
    ...process.env,
    NODE_ENV: overrides.NODE_ENV ?? "test",
    DB_SCHEMA: schema,
    LOG_DIR: logDir,
  };
  if (overrides.RATE_LIMIT_AUTH_MAX !== undefined) {
    envObject.RATE_LIMIT_AUTH_MAX = String(overrides.RATE_LIMIT_AUTH_MAX);
  }
  if (overrides.RATE_LIMIT_MAX !== undefined) {
    envObject.RATE_LIMIT_MAX = String(overrides.RATE_LIMIT_MAX);
  }
  const config = loadConfig(envObject);

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
    /** Merges the pino-roll rotation family (`<fileName>`, `<fileName>.1`, …)
     * into one array of parsed JSON log lines, oldest rotation first. */
    async readLogEntries(fileName) {
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
      let entries = [];
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
