import { describe, expect, it, vi } from "vitest";
import { runInTransaction } from "../../src/db/pool.js";

function makePool() {
  const client = {
    query: vi.fn(async () => undefined),
    release: vi.fn(),
  };
  return {
    client,
    pool: { connect: vi.fn(async () => client) },
  };
}

describe("runInTransaction", () => {
  it("commits successful work on the same client", async () => {
    const { pool, client } = makePool();
    const work = vi.fn(async (queryable) => {
      expect(queryable).toBe(client);
      return "created";
    });

    await expect(runInTransaction(pool, "BEGIN", work)).resolves.toBe("created");
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(["BEGIN", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back failed work and preserves the original error", async () => {
    const { pool, client } = makePool();
    const failure = new Error("budget insert failed");

    await expect(
      runInTransaction(pool, "BEGIN", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(["BEGIN", "ROLLBACK"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
