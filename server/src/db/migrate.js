import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(currentDir, "migrations");
const SAFE_SCHEMA_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function isLocalHost(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function migrate({ databaseUrl, schema = "public" } = {}) {
  if (!SAFE_SCHEMA_NAME.test(schema)) {
    throw new Error(`Invalid schema name: ${schema}`);
  }
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocalHost(databaseUrl) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    if (schema !== "public") {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const entries = await fs.readdir(migrationsDir);
    const files = entries.filter((name) => name.endsWith(".sql")).sort();

    const applied = [];
    for (const file of files) {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [file],
      );
      if (existing.rowCount > 0) {
        continue;
      }
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    return { schema, applied };
  } finally {
    await client.end();
  }
}

export async function dropSchema({ databaseUrl, schema }) {
  if (!SAFE_SCHEMA_NAME.test(schema) || schema === "public") {
    throw new Error(`Refusing to drop schema: ${schema}`);
  }
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocalHost(databaseUrl) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  // Deferred import: loadConfig() must only run for the real CLI invocation,
  // never as a side effect of another module statically importing `migrate`
  // (e.g. test helpers), or it would lock in the wrong environment.
  const { loadConfig } = await import("../config.js");
  const config = loadConfig();
  migrate({ databaseUrl: config.databaseUrl, schema: config.dbSchema })
    .then(({ schema, applied }) => {
      console.log(
        applied.length > 0
          ? `Applied ${applied.length} migration(s) to schema "${schema}": ${applied.join(", ")}`
          : `No pending migrations for schema "${schema}".`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err.message);
      process.exit(1);
    });
}
