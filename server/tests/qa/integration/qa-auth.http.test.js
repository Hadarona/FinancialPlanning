// QA-SI-01..11: real-HTTP auth coverage against an isolated schema.
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, mustJson } from "../helpers/qaClient.js";

const PASSWORD = "QaPassword1!";

function uniqueEmail(prefix = "qa") {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

describe("QA-SI: auth http", () => {
  let ctx;

  beforeAll(async () => {
    // A generous auth-rate-limit override keeps the many register/login
    // calls in this file from starving each other; QA-SI-08 exercises the
    // strict limit on its own dedicated server instance instead.
    ctx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);

  afterAll(async () => {
    await ctx.close();
  });

  it("QA-SI-01: register returns exactly {user:{id,email}}, a secure cookie, and never echoes the password", async () => {
    const session = createSession(ctx.baseUrl);
    const email = uniqueEmail();
    const response = await session.request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    const rawText = await response.text();
    expect(response.status).toBe(201);
    expect(rawText.toLowerCase()).not.toContain("password");
    expect(rawText).not.toContain(PASSWORD);

    const body = JSON.parse(rawText);
    expect(Object.keys(body)).toEqual(["user"]);
    expect(Object.keys(body.user).sort()).toEqual(["email", "id"]);
    expect(body.user.email).toBe(email);

    const setCookie = response.headers.getSetCookie().join(";");
    expect(setCookie).toMatch(/bb_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it("QA-SI-02: email is trimmed + lowercased so login with the canonical form works", async () => {
    const session = createSession(ctx.baseUrl);
    const localPart = `qa.user+${randomUUID().slice(0, 6)}`;
    const rawEmail = `  ${localPart}@Example.COM `;
    const normalized = `${localPart}@example.com`;

    const registerRes = await session.request("/auth/register", {
      method: "POST",
      body: { email: rawEmail, password: PASSWORD },
    });
    expect(registerRes.status).toBe(201);

    session.clearCookies();
    const loginRes = await session.request("/auth/login", {
      method: "POST",
      body: { email: normalized, password: PASSWORD },
    });
    const loginBody = await mustJson(loginRes, 200);
    expect(loginBody.user.email).toBe(normalized);

    const meRes = await session.request("/auth/me");
    const meBody = await mustJson(meRes, 200);
    expect(meBody.user.email).toBe(normalized);
  });

  it("QA-SI-03: a case-variant duplicate email conflicts and never creates a second account", async () => {
    const session = createSession(ctx.baseUrl);
    const localPart = `qa-dup-${randomUUID().slice(0, 6)}`;
    const email = `${localPart}@example.com`;
    const variantEmail = `${localPart.toUpperCase()}@EXAMPLE.com`;
    const secondPassword = "SecondPassword1!";

    const first = await session.request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(first.status).toBe(201);

    const second = await session.request("/auth/register", {
      method: "POST",
      body: { email: variantEmail, password: secondPassword },
    });
    const secondBody = await mustJson(second, 409);
    expect(secondBody.error.code).toBe("CONFLICT");

    session.clearCookies();
    const loginWithSecondPassword = await session.request("/auth/login", {
      method: "POST",
      body: { email, password: secondPassword },
    });
    expect(loginWithSecondPassword.status).toBe(401);
  });

  it("QA-SI-04: rejected registrations (bad email / short password / extra key) never create a user", async () => {
    const badEmailRes = await createSession(ctx.baseUrl).request("/auth/register", {
      method: "POST",
      body: { email: "not-an-email", password: PASSWORD },
    });
    const badEmailBody = await mustJson(badEmailRes, 400);
    expect(badEmailBody.error.code).toBe("VALIDATION_ERROR");
    expect(badEmailBody.error.fieldErrors).toBeTruthy();

    const shortPasswordEmail = uniqueEmail("short");
    const shortPasswordRes = await createSession(ctx.baseUrl).request("/auth/register", {
      method: "POST",
      body: { email: shortPasswordEmail, password: "short1" },
    });
    const shortPasswordBody = await mustJson(shortPasswordRes, 400);
    expect(shortPasswordBody.error.fieldErrors).toBeTruthy();
    const loginAfterShort = await createSession(ctx.baseUrl).request("/auth/login", {
      method: "POST",
      body: { email: shortPasswordEmail, password: "short1" },
    });
    expect(loginAfterShort.status).toBe(401);

    const extraKeyEmail = uniqueEmail("extra");
    const extraKeyRes = await createSession(ctx.baseUrl).request("/auth/register", {
      method: "POST",
      body: { email: extraKeyEmail, password: PASSWORD, admin: true },
    });
    expect(extraKeyRes.status).toBe(400);
    const loginAfterExtra = await createSession(ctx.baseUrl).request("/auth/login", {
      method: "POST",
      body: { email: extraKeyEmail, password: PASSWORD },
    });
    expect(loginAfterExtra.status).toBe(401);
  });

  it("QA-SI-05: unknown email and wrong password return byte-identical 401 bodies", async () => {
    const session = createSession(ctx.baseUrl);
    const email = uniqueEmail("known");
    await session.request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    session.clearCookies();

    const unknownRes = await session.request("/auth/login", {
      method: "POST",
      body: { email: uniqueEmail("nobody"), password: "whatever123" },
    });
    const wrongRes = await session.request("/auth/login", {
      method: "POST",
      body: { email, password: "wrongpassword123" },
    });
    expect(unknownRes.status).toBe(401);
    expect(wrongRes.status).toBe(401);

    const unknownBody = await mustJson(unknownRes, 401);
    const wrongBody = await mustJson(wrongRes, 401);
    delete unknownBody.error.requestId;
    delete wrongBody.error.requestId;
    expect(wrongBody).toEqual(unknownBody);
  });

  it("QA-SI-06: /auth/me rejects a missing, corrupted, and expired/forged session identically", async () => {
    const session = createSession(ctx.baseUrl);

    const noCookieRes = await session.request("/auth/me");
    expect(noCookieRes.status).toBe(401);

    const corruptedRes = await session.request("/auth/me", {
      headers: { Cookie: "bb_session=not-a-real-jwt" },
    });
    expect(corruptedRes.status).toBe(401);

    const expiredToken = jwt.sign(
      { sub: randomUUID(), email: "nobody@example.com" },
      ctx.config.jwtSecret,
      { expiresIn: "-1s" },
    );
    const expiredRes = await session.request("/auth/me", {
      headers: { Cookie: `bb_session=${expiredToken}` },
    });
    expect(expiredRes.status).toBe(401);
  });

  it("QA-SI-07: logout clears the session so a subsequent /auth/me is rejected", async () => {
    const session = createSession(ctx.baseUrl);
    const email = uniqueEmail("logout");
    await session.request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
    });

    const meBeforeRes = await session.request("/auth/me");
    expect(meBeforeRes.status).toBe(200);

    const logoutRes = await session.request("/auth/logout", { method: "POST" });
    expect(logoutRes.status).toBe(204);
    const setCookie = logoutRes.headers.getSetCookie().join(";");
    expect(setCookie).toMatch(/bb_session=/);

    const meAfterRes = await session.request("/auth/me");
    expect(meAfterRes.status).toBe(401);
  });

  it("QA-SI-08: the strict auth rate limit returns 429 on the 4th rapid attempt", async () => {
    const limitedCtx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 3 });
    try {
      const session = createSession(limitedCtx.baseUrl);
      let lastStatus;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const res = await session.request("/auth/login", {
          method: "POST",
          body: { email: "rate-limited@example.com", password: "whatever123" },
        });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
      expect(lastStatus).not.toBe(401);
    } finally {
      await limitedCtx.close();
    }
  }, 20000);

  it("QA-SI-09: every response carries X-Request-Id, and error bodies echo it", async () => {
    const session = createSession(ctx.baseUrl);
    const email = uniqueEmail("reqid");
    const successRes = await session.request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(successRes.headers.get("x-request-id")).toBeTruthy();

    const failureRes = await session.request("/auth/login", {
      method: "POST",
      body: { email, password: "wrongpassword123" },
    });
    const failureHeaderId = failureRes.headers.get("x-request-id");
    const failureBody = await mustJson(failureRes, 401);
    expect(failureHeaderId).toBeTruthy();
    expect(failureBody.error.requestId).toBe(failureHeaderId);
  });

  it("QA-SI-10: requests are logged with no password or session-token leakage", async () => {
    const session = createSession(ctx.baseUrl);
    const email = uniqueEmail("logcheck");
    const registerRes = await session.request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    const setCookie = registerRes.headers.getSetCookie().join(";");
    const token = setCookie.match(/bb_session=([^;]+)/)?.[1];
    expect(token).toBeTruthy();

    const entries = await ctx.readLogEntries("requests.log");
    expect(entries.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized.toLowerCase()).not.toMatch(/"password":"/);
    // The issued session token (and its still-recognizable JWT header
    // segment) must never appear — req headers/cookies are never logged.
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(token.split(".")[0]);
  });

  it("QA-SI-11: every private endpoint rejects an unauthenticated request", async () => {
    const session = createSession(ctx.baseUrl);
    const month = "2026-07";
    const calls = [
      ["GET", `/budgets/${month}`],
      ["POST", "/budgets"],
      ["PATCH", `/budgets/${month}`],
      ["GET", `/budgets/${month}/transactions`],
      ["POST", `/budgets/${month}/transactions`],
      ["DELETE", `/budgets/${month}/transactions/${randomUUID()}`],
      ["GET", `/insights/${month}`],
    ];
    for (const [method, path] of calls) {
      const res = await session.request(path, {
        method,
        body: method === "POST" || method === "PATCH" ? {} : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(401);
      const body = await mustJson(res, 401);
      expect(body.error.code, `${method} ${path}`).toBe("UNAUTHENTICATED");
    }
  });
});
