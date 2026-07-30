import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
import { dropSchema } from "../../src/db/migrate.js";
import { DEFAULT_CATEGORIES } from "../../src/domain/categories.js";

const PASSWORD = "supersecret1";

function kitBudgetBody(month) {
  return {
    month,
    incomeMinor: 1250000,
    categories: DEFAULT_CATEGORIES.map(({ id, plannedMinor }) => ({ id, plannedMinor })),
  };
}

async function registerUser(baseUrl) {
  const client = createCookieJarFetch(baseUrl);
  const res = await client.request("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: `contract-${randomUUID()}@example.com`,
      password: PASSWORD,
    }),
  });
  expect(res.status).toBe(201);
  return client;
}

/** Every error response must be exactly the documented envelope:
 * `{ error: { code, message, requestId, fieldErrors? } }`, with a matching
 * X-Request-Id header, a safe human message, and no leaked internals. */
async function expectErrorEnvelope(res, { status, code, fieldErrors = false }) {
  expect(res.status).toBe(status);
  const body = await res.json();

  expect(Object.keys(body)).toEqual(["error"]);
  const allowedKeys = ["code", "message", "fieldErrors", "requestId"];
  expect(Object.keys(body.error).every((key) => allowedKeys.includes(key))).toBe(true);

  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  expect(body.error.message.length).toBeGreaterThan(0);
  expect(typeof body.error.requestId).toBe("string");
  expect(res.headers.get("x-request-id")).toBe(body.error.requestId);

  if (fieldErrors) {
    expect(typeof body.error.fieldErrors).toBe("object");
    expect(Object.keys(body.error.fieldErrors).length).toBeGreaterThan(0);
  } else {
    expect(body.error.fieldErrors).toBeUndefined();
  }

  // No stack traces, file paths, or driver errors ever reach a client.
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/\n\s+at |\/src\/|node_modules|postgres|pg_|ECONN/i);
  return body;
}

describe("error contract (D-RESP-B1/B2): one envelope for every failure class", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  it("unknown route -> 404 NOT_FOUND", async () => {
    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const res = await anonymous.request("/no-such-resource");
    await expectErrorEnvelope(res, { status: 404, code: "NOT_FOUND" });
  }, 30000);

  it("malformed :month path -> 400 VALIDATION_ERROR with fieldErrors", async () => {
    const client = await registerUser(ctx.baseUrl);
    const res = await client.request("/budgets/not-a-month");
    await expectErrorEnvelope(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      fieldErrors: true,
    });
  }, 30000);

  it("missing session -> 401 UNAUTHENTICATED", async () => {
    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const res = await anonymous.request("/budgets/2026-07");
    await expectErrorEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
  }, 30000);

  it("duplicate budget month -> 409 CONFLICT", async () => {
    const client = await registerUser(ctx.baseUrl);
    const first = await client.request("/budgets", {
      method: "POST",
      body: JSON.stringify(kitBudgetBody("2026-07")),
    });
    expect(first.status).toBe(201);
    const second = await client.request("/budgets", {
      method: "POST",
      body: JSON.stringify(kitBudgetBody("2026-07")),
    });
    await expectErrorEnvelope(second, { status: 409, code: "CONFLICT" });
  }, 30000);

  it("invalid body -> 400 VALIDATION_ERROR with per-field messages", async () => {
    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const res = await anonymous.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
    });
    const body = await expectErrorEnvelope(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      fieldErrors: true,
    });
    expect(Object.keys(body.error.fieldErrors)).toEqual(
      expect.arrayContaining(["email", "password"]),
    );
  }, 30000);

  it("malformed transaction id -> the same 404 body as a missing one", async () => {
    const client = await registerUser(ctx.baseUrl);
    const create = await client.request("/budgets", {
      method: "POST",
      body: JSON.stringify(kitBudgetBody("2026-08")),
    });
    expect(create.status).toBe(201);
    const res = await client.request(
      "/budgets/2026-08/transactions/definitely-not-a-uuid",
      {
        method: "DELETE",
      },
    );
    await expectErrorEnvelope(res, { status: 404, code: "NOT_FOUND" });
  }, 30000);

  it("unhandled internal error -> 500 INTERNAL with a safe message", async () => {
    const anonymous = createCookieJarFetch(ctx.baseUrl);
    const res = await anonymous.request("/__test/error");
    const body = await expectErrorEnvelope(res, { status: 500, code: "INTERNAL" });
    expect(body.error.message).toBe("Something went wrong. Please try again.");
  }, 30000);
});

describe("database failure path (D-RESP-B4)", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);

  afterAll(async () => {
    // ctx.close() drops the schema again — dropSchema is IF EXISTS, so the
    // early drop below does not break teardown.
    await ctx.close();
  });

  it("a broken database yields a correlated 500 + error log, and the server keeps serving", async () => {
    const client = await registerUser(ctx.baseUrl);

    // Break the backing schema out from under the running server.
    await dropSchema({ databaseUrl: ctx.config.databaseUrl, schema: ctx.schema });

    const res = await client.request("/budgets/2026-07");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBe("Something went wrong. Please try again.");
    const { requestId } = body.error;
    expect(JSON.stringify(body)).not.toMatch(/relation|schema|postgres/i);

    // The process did not crash: DB-free endpoints still respond.
    const health = await client.request("/health");
    expect(health.status).toBe(200);

    // The failure is correlated in the external error log.
    let logged = null;
    for (let attempt = 0; attempt < 20 && !logged; attempt += 1) {
      const entries = await ctx.readLogFile("error.log");
      logged = entries.find((entry) => entry.requestId === requestId) ?? null;
      if (!logged) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    expect(logged).not.toBeNull();
    expect(logged.status).toBe(500);
  }, 60000);
});
