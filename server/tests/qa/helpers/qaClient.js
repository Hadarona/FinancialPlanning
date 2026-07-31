import { randomUUID } from "node:crypto";

/**
 * Minimal cookie-jar `fetch` wrapper for real-HTTP QA integration tests.
 * Independent of the developer's own `createCookieJarFetch` helper (QA never
 * imports developer test code) but the same shape: one session keeps its
 * `Set-Cookie` across requests.
 */
export function createSession(baseUrl) {
  let cookies = {};

  function applySetCookie(response) {
    const raw =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const entry of raw) {
      const [pair] = entry.split(";");
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) continue;
      const name = pair.slice(0, eqIndex).trim();
      const value = pair.slice(eqIndex + 1).trim();
      cookies[name] = value;
    }
  }

  function cookieHeader() {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function request(pathName, init = {}) {
    const headers = new Headers(init.headers || {});
    const cookieStr = cookieHeader();
    if (cookieStr) {
      headers.set("Cookie", cookieStr);
    }
    const hasBody = init.body !== undefined;
    const bodyIsString = typeof init.body === "string";
    if (hasBody && !headers.has("Content-Type") && !bodyIsString) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${baseUrl}${pathName}`, {
      ...init,
      headers,
      body: hasBody && !bodyIsString ? JSON.stringify(init.body) : init.body,
    });
    applySetCookie(response);
    return response;
  }

  return {
    request,
    get cookies() {
      return { ...cookies };
    },
    clearCookies() {
      cookies = {};
    },
  };
}

/** Registers a fresh, uniquely-emailed user on `session` and returns
 * `{ email, password, response }`. Never reuses an email across tests. */
export async function registerUser(session, overrides = {}) {
  const email = overrides.email ?? `qa-${randomUUID().slice(0, 8)}@example.com`;
  const password = overrides.password ?? "QaPassword1!";
  const response = await session.request("/auth/register", {
    method: "POST",
    body: { email, password },
  });
  return { email, password, response };
}

/** Parses a response as JSON and asserts its status, throwing a descriptive
 * error (with the raw body) on mismatch so failures are easy to triage. */
export async function mustJson(response, expectedStatus) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(
        `Expected JSON body, got non-JSON (status ${response.status}): ${text.slice(0, 500)}`,
      );
    }
  }
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${JSON.stringify(body)}`,
    );
  }
  return body;
}
