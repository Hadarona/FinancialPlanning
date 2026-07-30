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
 * Schema selection (non-`public` schemas, i.e. isolated test schemas) wraps
 * every `pool.query` in its own transaction with `SET LOCAL search_path`:
 *
 * - Neon's pooled connection endpoint rejects the `options=-c
 *   search_path=...` startup parameter outright ("unsupported startup
 *   parameter in options").
 * - A session-level `SET search_path` on the pool's `connect` event is
 *   silently unreliable there too: the pooled endpoint is pgbouncer in
 *   transaction-pooling mode, so consecutive autocommit queries from one
 *   client can run on different server backends — a later query can land on
 *   a backend that never saw the SET and read the wrong (default) schema.
 *   Observed as intermittent empty aggregates during Stage F.
 * - A transaction pins one backend from BEGIN to COMMIT, and `SET LOCAL`
 *   scopes the search_path to exactly that transaction, so every query is
 *   deterministically schema-scoped regardless of backend assignment.
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
    // "BEGIN; SET LOCAL ..." goes out as one simple-protocol round trip.
    const beginScoped = `BEGIN; SET LOCAL search_path TO "${config.dbSchema}", public`;
    pool.query = async function schemaScopedQuery(text, params) {
      const client = await pool.connect();
      try {
        await client.query(beginScoped);
        const result = await client.query(text, params);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The original error is the one worth surfacing.
        }
        throw err;
      } finally {
        client.release();
      }
    };
  }

  return pool;
}
