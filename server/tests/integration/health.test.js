import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";

async function waitForLogEntry(readLogFile, fileName, predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const entries = await readLogFile(fileName);
    const match = entries.find(predicate);
    if (match) {
      return { match, entries };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return { match: null, entries: await readLogFile(fileName) };
}

describe("health and error handling", () => {
  let ctx;
  let client;

  beforeAll(async () => {
    ctx = await startTestServer();
    client = createCookieJarFetch(ctx.baseUrl);
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  it("GET /health returns the documented shape and a request id header", async () => {
    const response = await client.request("/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBeTruthy();

    const body = await response.json();
    expect(body).toMatchObject({ status: "ok" });
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("writes a structured request log entry for the health request", async () => {
    const { match } = await waitForLogEntry(
      ctx.readLogFile,
      "requests.log",
      (entry) => entry.route === "/api/v1/health",
    );
    expect(match).toBeTruthy();
    expect(match).toMatchObject({ method: "GET", status: 200 });
    expect(match.requestId).toBeTruthy();
    expect(typeof match.durationMs).toBe("number");
    expect(match.time ?? match.ts).toBeTruthy();
  });

  it("a forced internal error returns the safe error envelope and writes an error log entry", async () => {
    const response = await client.request("/__test/error");
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).not.toMatch(/forced test error/i);
    expect(body.error).not.toHaveProperty("stack");
    expect(body.error.requestId).toBeTruthy();

    const { match, entries } = await waitForLogEntry(
      ctx.readLogFile,
      "error.log",
      (entry) => entry.requestId === body.error.requestId,
    );
    expect(match).toBeTruthy();

    // Logs must never contain secrets or request bodies.
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(ctx.config.databaseUrl);
    expect(serialized).not.toContain(ctx.config.jwtSecret);
  });
});
