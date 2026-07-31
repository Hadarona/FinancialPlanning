// QA-SI-80..88: real-HTTP error-contract, security, and logging coverage.
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
import { kitBudgetPayload, expensePayload } from "../helpers/qaFixtures.js";

// Remote Neon round-trips make multi-request journeys slower than vitest's
// 5s default test timeout.
const SLOW_TEST_TIMEOUT = 30000;

const ALLOWED_ERROR_KEYS = ["code", "message", "fieldErrors", "requestId"];

async function expectErrorEnvelope(response, { status, code }) {
  expect(response.status).toBe(status);
  const body = await mustJson(response, status);
  expect(Object.keys(body)).toEqual(["error"]);
  expect(Object.keys(body.error).every((key) => ALLOWED_ERROR_KEYS.includes(key))).toBe(
    true,
  );
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  expect(body.error.message.length).toBeGreaterThan(0);
  expect(typeof body.error.requestId).toBe("string");
  expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/\n\s+at |\/src\/|node_modules|postgres|pg_|ECONN|Error:/i);
  return body;
}

describe("QA-SI: error contract / security / logging http", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  it(
    "QA-SI-80: /health returns the documented shape and an unknown route is the 404 envelope, both carrying X-Request-Id",
    async () => {
      const healthRes = await fetch(`${ctx.baseUrl}/health`);
      expect(healthRes.status).toBe(200);
      const healthBody = await healthRes.json();
      expect(healthBody.status).toBe("ok");
      expect(typeof healthBody.uptimeSeconds).toBe("number");
      expect(healthRes.headers.get("x-request-id")).toBeTruthy();

      const nopeRes = await fetch(`${ctx.baseUrl}/nope`);
      await expectErrorEnvelope(nopeRes, { status: 404, code: "NOT_FOUND" });
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-81: unparseable JSON is a safe 400 VALIDATION_ERROR, never a parser-internal 500",
    async () => {
      const res = await fetch(`${ctx.baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not json",
      });
      await expectErrorEnvelope(res, { status: 400, code: "VALIDATION_ERROR" });
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-82: a body over the documented 32kb limit is rejected with the 413 envelope",
    async () => {
      const oversized = JSON.stringify({
        email: "big@example.com",
        password: `x${"y".repeat(40 * 1024)}`,
      });
      const res = await fetch(`${ctx.baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: oversized,
      });
      await expectErrorEnvelope(res, { status: 413, code: "PAYLOAD_TOO_LARGE" });
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-83: the forced test-only error route returns a safe 500 correlated to an error-log entry",
    async () => {
      const res = await fetch(`${ctx.baseUrl}/__test/error`);
      const body = await expectErrorEnvelope(res, { status: 500, code: "INTERNAL" });
      const { requestId } = body.error;

      let logged = null;
      for (let attempt = 0; attempt < 20 && !logged; attempt += 1) {
        const entries = await ctx.readLogEntries("error.log");
        logged = entries.find((entry) => entry.requestId === requestId) ?? null;
        if (!logged) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      expect(logged).not.toBeNull();
      expect(logged.status).toBe(500);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-84: standard security headers are present and a foreign Origin gets no CORS allowance",
    async () => {
      const res = await fetch(`${ctx.baseUrl}/health`, {
        headers: { Origin: "https://evil.example" },
      });
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-powered-by")).toBeNull();
      expect(res.headers.get("access-control-allow-origin")).toBeNull();

      const preflight = await fetch(`${ctx.baseUrl}/auth/login`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-85: the general rate limit returns 429 once exceeded on a dedicated low-limit server",
    async () => {
      const limitedCtx = await startQaServer({ RATE_LIMIT_MAX: 5 });
      try {
        let lastStatus;
        for (let i = 0; i < 6; i += 1) {
          const res = await fetch(`${limitedCtx.baseUrl}/health`);
          lastStatus = res.status;
        }
        expect(lastStatus).toBe(429);
      } finally {
        await limitedCtx.close();
      }
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-86: an injection-shaped corpus is rejected or stored inertly, and the schema survives intact",
    async () => {
      const injectionEmail = "qa'or1=1--@example.com";
      const registerRes = await fetch(`${ctx.baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: injectionEmail, password: "QaPassword1!" }),
      });
      expect(registerRes.status).toBe(400);

      const session = await (async () => {
        const s = createSession(ctx.baseUrl);
        await registerUser(s);
        return s;
      })();

      const monthRes = await session.request(
        `/budgets/${encodeURIComponent("2026-07'--")}`,
      );
      expect(monthRes.status).toBe(400);

      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      const injectionNote = "'; DROP TABLE transactions; --";
      const txRes = await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", note: injectionNote }),
      });
      const txBody = await mustJson(txRes, 201);
      expect(txBody.transaction.note).toBe(injectionNote);

      const deleteRes = await session.request(
        `/budgets/2026-07/transactions/${encodeURIComponent("1 OR 1=1")}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(404);

      // The schema survives: a fresh register + budget + expense still works.
      const survivorSession = createSession(ctx.baseUrl);
      await registerUser(survivorSession);
      const survivorBudget = await survivorSession.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-08"),
      });
      expect(survivorBudget.status).toBe(201);
      const survivorTx = await survivorSession.request("/budgets/2026-08/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-08" }),
      });
      expect(survivorTx.status).toBe(201);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-87: a mixed request sequence is fully logged with no secret/PII leakage",
    async () => {
      const session = createSession(ctx.baseUrl);
      const email = `qa-logsweep-${randomUUID().slice(0, 8)}@example.com`;
      const password = "QaPassword1!";
      const marker = `QA-NOTE-${randomUUID().slice(0, 8)}`;

      await session.request("/auth/register", {
        method: "POST",
        body: { email, password },
      });
      await session.request("/budgets", {
        method: "POST",
        body: kitBudgetPayload("2026-07"),
      });
      await session.request("/budgets/2026-07/transactions", {
        method: "POST",
        body: expensePayload({ month: "2026-07", amountMinor: 654321, note: marker }),
      });
      await fetch(`${ctx.baseUrl}/__test/error`); // the deliberate error entry
      await session.request("/budgets/2026-99"); // a 400

      const requestEntries = await ctx.readLogEntries("requests.log");
      expect(requestEntries.length).toBeGreaterThanOrEqual(5);
      for (const entry of requestEntries) {
        expect(entry.method).toBeTruthy();
        expect(entry.route ?? entry.url).toBeTruthy();
        expect(entry.status).toBeTruthy();
        expect(entry.durationMs ?? entry.responseTime).not.toBeUndefined();
        expect(entry.requestId).toBeTruthy();
        expect(entry.time ?? entry.timestamp).not.toBeUndefined();
      }
      const errorEntries = await ctx.readLogEntries("error.log");
      expect(errorEntries.length).toBeGreaterThan(0);

      const serialized = JSON.stringify([...requestEntries, ...errorEntries]);
      expect(serialized).not.toContain(password);
      expect(serialized).not.toContain(marker);
      expect(serialized).not.toContain("654321");
      expect(serialized.toLowerCase()).not.toMatch(/"cookie":"[^"]/);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "QA-SI-88: every observed failure class matches the documented envelope, and shutdown never hangs",
    async () => {
      const dedicatedCtx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
      try {
        const session = createSession(dedicatedCtx.baseUrl);
        const { password } = await registerUser(session);

        const badRegister = await fetch(`${dedicatedCtx.baseUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "not-an-email", password }),
        });
        await expectErrorEnvelope(badRegister, { status: 400, code: "VALIDATION_ERROR" });

        const anonymous = createSession(dedicatedCtx.baseUrl);
        const unauth = await anonymous.request("/budgets/2026-07");
        await expectErrorEnvelope(unauth, { status: 401, code: "UNAUTHENTICATED" });

        const missing = await session.request("/budgets/2026-05");
        await expectErrorEnvelope(missing, { status: 404, code: "NOT_FOUND" });

        await session.request("/budgets", {
          method: "POST",
          body: kitBudgetPayload("2026-07"),
        });
        const conflict = await session.request("/budgets", {
          method: "POST",
          body: kitBudgetPayload("2026-07"),
        });
        await expectErrorEnvelope(conflict, { status: 409, code: "CONFLICT" });

        const oversized = await fetch(`${dedicatedCtx.baseUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "big@example.com",
            password: `x${"y".repeat(40 * 1024)}`,
          }),
        });
        await expectErrorEnvelope(oversized, { status: 413, code: "PAYLOAD_TOO_LARGE" });

        const internal = await fetch(`${dedicatedCtx.baseUrl}/__test/error`);
        await expectErrorEnvelope(internal, { status: 500, code: "INTERNAL" });

        // A dedicated tiny general limit produces one 429 specimen.
        const rateLimitedCtx = await startQaServer({ RATE_LIMIT_MAX: 2 });
        try {
          let rateLimited;
          for (let i = 0; i < 3; i += 1) {
            rateLimited = await fetch(`${rateLimitedCtx.baseUrl}/health`);
          }
          await expectErrorEnvelope(rateLimited, { status: 429, code: "RATE_LIMITED" });
        } finally {
          await rateLimitedCtx.close();
        }
      } finally {
        const closeGuard = new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("close() did not resolve within 5000ms")),
            5000,
          );
          dedicatedCtx.close().then(() => {
            clearTimeout(timer);
            resolve();
          }, reject);
        });
        await expect(closeGuard).resolves.toBeUndefined();
      }
    },
    SLOW_TEST_TIMEOUT,
  );
});
