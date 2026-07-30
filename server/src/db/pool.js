import pg from "pg";

const { Pool } = pg;
const SAFE_SCHEMA_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function isLocalHost(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Creates a new connection pool scoped to `config`. Deliberately not a
 * module-level singleton: each server instance (real process or isolated
 * test server) builds its own pool from its own resolved config, so
 * `DB_SCHEMA` overrides in tests are honored instead of silently defaulting
 * to `public` on the real database.
 *
 * Schema selection is applied via a `SET search_path` query on every new
 * physical connection rather than the `options=-c search_path=...` startup
 * parameter: Neon's pooled connection endpoint rejects that startup
 * parameter outright ("unsupported startup parameter in options").
 */
export function createPool(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    ssl: isLocalHost(config.databaseUrl) ? undefined : { rejectUnauthorized: false },
  });

  if (config.dbSchema && config.dbSchema !== "public") {
    if (!SAFE_SCHEMA_NAME.test(config.dbSchema)) {
      throw new Error(`Invalid DB_SCHEMA: ${config.dbSchema}`);
    }
    pool.on("connect", (client) => {
      client.query(`SET search_path TO "${config.dbSchema}", public`).catch((err) => {
        // Surface connection-setup failures on the client itself so the
        // caller's query rejects instead of silently using the wrong schema.
        client.emit("error", err);
      });
    });
  }

  return pool;
}
