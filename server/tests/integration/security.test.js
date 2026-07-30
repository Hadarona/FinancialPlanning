import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
import { DEFAULT_CATEGORIES } from "../../src/domain/categories.js";

const PASSWORD = "supersecret1";
const SLOW_TEST_TIMEOUT = 30000;

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

function kitBudgetBody(month) {
  return {
    month,
    incomeMinor: 1250000,
    categories: DEFAULT_CATEGORIES.map(({ id, plannedMinor }) => ({ id, plannedMinor })),
  };
}

async function registerUser(baseUrl, prefix = "sec") {
  const client = createCookieJarFetch(baseUrl);
  const res = await client.request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: uniqueEmail(prefix), password: PASSWORD }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  return { client, userId: body.user.id };
}

describe("security hardening (Stage H / D-SEC-*)", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  describe("security headers (helmet)", () => {
    it(
      "sets the standard helmet headers and hides x-powered-by",
      async () => {
        const res = await fetch(`${ctx.baseUrl}/health`);
        expect(res.status).toBe(200);
        expect(res.headers.get("x-powered-by")).toBeNull();
        expect(res.headers.get("x-content-type-options")).toBe("nosniff");
        expect(res.headers.get("x-frame-options")).toBeTruthy();
        expect(res.headers.get("content-security-policy")).toBeTruthy();
        expect(res.headers.get("referrer-policy")).toBeTruthy();
        expect(res.headers.get("cross-origin-resource-policy")).toBeTruthy();
      },
      SLOW_TEST_TIMEOUT,
    );
  });

  describe("CORS allowlist", () => {
    it(
      "grants the configured origin credentials and denies a foreign origin any CORS headers",
      async () => {
        const allowed = ctx.config.corsOrigin.split(",")[0].trim();

        const allowedRes = await fetch(`${ctx.baseUrl}/health`, {
          headers: { Origin: allowed },
        });
        expect(allowedRes.headers.get("access-control-allow-origin")).toBe(allowed);
        expect(allowedRes.headers.get("access-control-allow-credentials")).toBe("true");

        const foreignRes = await fetch(`${ctx.baseUrl}/health`, {
          headers: { Origin: "https://evil.example.com" },
        });
        expect(foreignRes.headers.get("access-control-allow-origin")).toBeNull();
        expect(foreignRes.headers.get("access-control-allow-credentials")).toBeNull();
      },
      SLOW_TEST_TIMEOUT,
    );

    it(
      "fails a foreign-origin preflight (no allow headers), so credentialed JSON requests never fire",
      async () => {
        const res = await fetch(`${ctx.baseUrl}/auth/login`, {
          method: "OPTIONS",
          headers: {
            Origin: "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
          },
        });
        expect(res.headers.get("access-control-allow-origin")).toBeNull();
        expect(res.headers.get("access-control-allow-methods")).toBeNull();
      },
      SLOW_TEST_TIMEOUT,
    );
  });

  describe("input limits (D-SEC-B3)", () => {
    it(
      "rejects a body over the documented 32kb limit with the 413 envelope",
      async () => {
        const oversized = JSON.stringify({
          email: "big@example.com",
          password: "x".repeat(40 * 1024),
        });
        const res = await fetch(`${ctx.baseUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: oversized,
        });
        expect(res.status).toBe(413);
        const body = await res.json();
        expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
        expect(typeof body.error.requestId).toBe("string");
        expect(JSON.stringify(body)).not.toMatch(/\n\s+at |node_modules/);
      },
      SLOW_TEST_TIMEOUT,
    );

    it(
      "rejects unparseable JSON with a 400 VALIDATION_ERROR, not a 500",
      async () => {
        const res = await fetch(`${ctx.baseUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"email": "broken"',
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
      },
      SLOW_TEST_TIMEOUT,
    );
  });

  describe("injection-shaped input is treated as data (D-SEC-B2)", () => {
    const CORPUS = [
      "' OR 1=1--",
      '"; DROP TABLE users; --',
      "1; SELECT pg_sleep(10)",
      '{ "$where": "sleep(100)" }',
      "Robert'); DROP TABLE budget_periods;--",
    ];

    it(
      "rejects injection strings in email/month/category as validation failures, never SQL errors",
      async () => {
        const { client } = await registerUser(ctx.baseUrl, "inject");
        for (const payload of CORPUS) {
          const register = await fetch(`${ctx.baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: payload, password: PASSWORD }),
          });
          expect(register.status).toBe(400);
          expect((await register.json()).error.code).toBe("VALIDATION_ERROR");

          const month = await client.request(`/budgets/${encodeURIComponent(payload)}`);
          expect(month.status).toBe(400);
          expect((await month.json()).error.code).toBe("VALIDATION_ERROR");
        }

        // Category id is validated against the fixed five-category set.
        await client.request("/budgets", {
          method: "POST",
          body: JSON.stringify(kitBudgetBody("2026-07")),
        });
        const tx = await client.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: JSON.stringify({
            categoryId: CORPUS[0],
            amountMinor: 1000,
            occurredOn: "2026-07-10",
          }),
        });
        expect(tx.status).toBe(400);
        expect((await tx.json()).error.code).toBe("VALIDATION_ERROR");
      },
      SLOW_TEST_TIMEOUT,
    );

    it(
      "stores an injection-shaped note verbatim as inert text (parameterized queries)",
      async () => {
        const { client } = await registerUser(ctx.baseUrl, "note-inject");
        const create = await client.request("/budgets", {
          method: "POST",
          body: JSON.stringify(kitBudgetBody("2026-07")),
        });
        expect(create.status).toBe(201);

        const note = "'; DROP TABLE transactions; --";
        const tx = await client.request("/budgets/2026-07/transactions", {
          method: "POST",
          body: JSON.stringify({
            categoryId: "groceries",
            amountMinor: 1234,
            occurredOn: "2026-07-05",
            note,
          }),
        });
        expect(tx.status).toBe(201);
        const { transaction } = await tx.json();
        expect(transaction.note).toBe(note);

        // The table survived and the row round-trips byte-for-byte.
        const list = await client.request("/budgets/2026-07/transactions");
        expect(list.status).toBe(200);
        const body = await list.json();
        expect(body.transactions.find((t) => t.id === transaction.id).note).toBe(note);
      },
      SLOW_TEST_TIMEOUT,
    );
  });

  describe("ownership matrix (D-SEC-B1): every private endpoint x anonymous + foreign session", () => {
    it("rejects every private endpoint for anonymous (401) and foreign (404, no mutation) callers", async () => {
      const MONTH = "2026-07";
      const owner = await registerUser(ctx.baseUrl, "owner");
      const foreign = await registerUser(ctx.baseUrl, "foreign");
      const anonymous = createCookieJarFetch(ctx.baseUrl);

      const createBudget = await owner.client.request("/budgets", {
        method: "POST",
        body: JSON.stringify(kitBudgetBody(MONTH)),
      });
      expect(createBudget.status).toBe(201);
      const txRes = await owner.client.request(`/budgets/${MONTH}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          categoryId: "housing",
          amountMinor: 5000,
          occurredOn: `${MONTH}-10`,
        }),
      });
      expect(txRes.status).toBe(201);
      const { transaction } = await txRes.json();

      const matrix = [
        { method: "GET", path: "/auth/me" },
        { method: "GET", path: `/budgets/${MONTH}` },
        { method: "PATCH", path: `/budgets/${MONTH}`, body: { incomeMinor: 999900 } },
        { method: "GET", path: `/budgets/${MONTH}/transactions` },
        {
          method: "POST",
          path: `/budgets/${MONTH}/transactions`,
          body: { categoryId: "fun", amountMinor: 100, occurredOn: `${MONTH}-11` },
        },
        { method: "DELETE", path: `/budgets/${MONTH}/transactions/${transaction.id}` },
        { method: "GET", path: `/insights/${MONTH}` },
      ];

      for (const { method, path, body } of matrix) {
        const anonRes = await anonymous.request(path, {
          method,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        expect(anonRes.status, `anonymous ${method} ${path}`).toBe(401);
        expect((await anonRes.json()).error.code).toBe("UNAUTHENTICATED");
      }

      // The foreign user is authenticated but owns nothing for MONTH:
      // reads and writes must resolve 404 through the same code path,
      // never leaking whether the owner's resources exist.
      // (/auth/me is the caller's own identity; POST /budgets can only
      // create for the session user by construction — both excluded.)
      for (const { method, path, body } of matrix.slice(1)) {
        const res = await foreign.client.request(path, {
          method,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        expect(res.status, `foreign ${method} ${path}`).toBe(404);
        expect((await res.json()).error.code).toBe("NOT_FOUND");
      }

      // Nothing about the owner's data changed under the foreign attempts.
      const after = await owner.client.request(`/budgets/${MONTH}`);
      const { budget } = await after.json();
      expect(budget.incomeMinor).toBe(1250000);
      expect(budget.actualMinor).toBe(5000);
      const list = await owner.client.request(`/budgets/${MONTH}/transactions`);
      expect((await list.json()).total).toBe(1);
    }, 60000);
  });
});

describe("production cookie flags (D-SEC-F* cookie hardening)", () => {
  it("marks the session cookie Secure when NODE_ENV=production", async () => {
    const prodCtx = await startTestServer({ NODE_ENV: "production" });
    try {
      const client = createCookieJarFetch(prodCtx.baseUrl);
      const res = await client.request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("prod"), password: PASSWORD }),
      });
      expect(res.status).toBe(201);
      const setCookie = res.headers.getSetCookie().join(";");
      expect(setCookie).toMatch(/bb_session=/);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Secure/i);
    } finally {
      await prodCtx.close();
    }
  }, 60000);
});
