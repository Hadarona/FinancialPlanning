import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";

const PASSWORD = "supersecret1";

function uniqueEmail(prefix) {
  return `${prefix}-${randomUUID()}@example.com`;
}

describe("auth journey", () => {
  let ctx;
  let client;

  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000 });
    client = createCookieJarFetch(ctx.baseUrl);
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  it("registers, exposes /auth/me, logs out, then rejects /auth/me", async () => {
    const email = uniqueEmail("journey");

    const registerRes = await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json();
    expect(registerBody.user).toEqual({ id: expect.any(String), email });
    expect(JSON.stringify(registerBody.user)).not.toMatch(/password/i);

    const setCookie = registerRes.headers.getSetCookie
      ? registerRes.headers.getSetCookie().join(";")
      : "";
    expect(setCookie).toMatch(/bb_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const meRes = await client.request("/auth/me");
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.email).toBe(email);

    const logoutRes = await client.request("/auth/logout", { method: "POST" });
    expect(logoutRes.status).toBe(204);

    const meAfterLogoutRes = await client.request("/auth/me");
    expect(meAfterLogoutRes.status).toBe(401);
  });

  it("provisions the default budget at registration: GET /budget answers 200 (CR1-9)", async () => {
    const freshClient = createCookieJarFetch(ctx.baseUrl);
    const registerRes = await freshClient.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail("provision"), password: PASSWORD }),
    });
    expect(registerRes.status).toBe(201);
    // The register response shape itself is unchanged (REG-1).
    const registerBody = await registerRes.json();
    expect(Object.keys(registerBody)).toEqual(["user"]);

    const budgetRes = await freshClient.request("/budget");
    expect(budgetRes.status).toBe(200);
    const { budget } = await budgetRes.json();
    expect(budget.incomeMinor).toBe(1250000);
    expect(budget.plannedMinor).toBe(1200000);
    expect(budget.categories).toHaveLength(7);
  }, 30000);

  it("rejects a duplicate registration with 409 and does not create a second user", async () => {
    const email = uniqueEmail("dup");
    const first = await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(first.status).toBe(201);

    const second = await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.requestId).toBeTruthy();
  });

  it("returns byte-identical error bodies for an unknown email and a wrong password", async () => {
    const email = uniqueEmail("known");
    await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    client.clear();

    const unknownRes = await client.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail("nobody"), password: "whatever123" }),
    });
    const wrongRes = await client.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "wrongpassword123" }),
    });

    expect(unknownRes.status).toBe(401);
    expect(wrongRes.status).toBe(401);
    const unknownBody = await unknownRes.json();
    const wrongBody = await wrongRes.json();
    // requestId legitimately differs per request; everything else must match byte-for-byte.
    delete unknownBody.error.requestId;
    delete wrongBody.error.requestId;
    expect(wrongBody).toEqual(unknownBody);
  });

  it("rejects malformed registration bodies with 400 and field errors", async () => {
    const res = await client.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "short", extra: true }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors).toBeTruthy();
  });

  it("rejects a protected endpoint with no/garbage session cookie", async () => {
    const anonymousClient = createCookieJarFetch(ctx.baseUrl);
    const res = await anonymousClient.request("/auth/me");
    expect(res.status).toBe(401);
  });

  it("logs auth requests without ever leaking the password", async () => {
    const entries = await ctx.readLogFile("requests.log");
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(PASSWORD);

    const errorEntries = await ctx.readLogFile("error.log");
    expect(JSON.stringify(errorEntries)).not.toContain(PASSWORD);
  });
});

describe("auth rate limiting", () => {
  it("returns 429 once the strict auth limiter is exceeded", async () => {
    const rateLimitedCtx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 2 });
    const client = createCookieJarFetch(rateLimitedCtx.baseUrl);
    try {
      let lastStatus;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const res = await client.request("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: "rate-limited@example.com",
            password: "whatever123",
          }),
        });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    } finally {
      await rateLimitedCtx.close();
    }
  }, 20000);
});
