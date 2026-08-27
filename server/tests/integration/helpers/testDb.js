import { randomUUID } from "node:crypto";
import { migrate, dropSchema } from "../../../src/db/migrate.js";

export function generateSchemaName() {
  return `test_${Date.now()}_${process.pid}_${randomUUID().slice(0, 8)}`;
}

/**
 * Creates a fresh, isolated Postgres schema on the same Neon database, runs
 * every migration into it, and returns a teardown that drops the schema.
 * Never touches the `public` schema.
 */
export async function createTestSchema(databaseUrl, schema = generateSchemaName()) {
  await migrate({ databaseUrl, schema });
  return {
    schema,
    async teardown() {
      await dropSchema({ databaseUrl, schema });
    },
  };
}
