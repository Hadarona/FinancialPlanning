import { vi } from "vitest";

/**
 * Installs a scripted `fetch` mock (`vi.stubGlobal("fetch", ...)`) driven by
 * an ordered, route-keyed script: `[{ method, path (string|RegExp), status,
 * json, delayMs? }]`. Independent of the developer's own pattern of mocking
 * `apiClient` directly (`vi.mock("../src/api/client.js", ...)`) — this mocks
 * one level lower, at the real `fetch` the product's `apiClient` calls, so
 * QA tests exercise the actual request/response parsing path too.
 *
 * Matching: for a real request path, every script entry whose method and
 * path match is collected in script order; the Nth call to that same real
 * path consumes the Nth matching entry (clamped to the last one for any
 * further calls) — this lets a script express "fails once, then succeeds on
 * retry" by listing two entries for the same route.
 *
 * Every call is recorded as `{ method, path, body }` (`path` excludes the
 * `/api/v1` prefix, matching how the app's own hooks/api client refer to
 * routes). An unmatched request throws instead of hanging or silently
 * resolving, so a test can never green-pass while missing its target.
 */
export function installFetchMock(script) {
  const calls = [];
  const callCounts = new Map();

  function stripPrefix(url) {
    return url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/v1/, "");
  }

  function matchesEntry(entry, method, path) {
    if (entry.method.toUpperCase() !== method.toUpperCase()) {
      return false;
    }
    return entry.path instanceof RegExp ? entry.path.test(path) : entry.path === path;
  }

  async function mockFetch(input, init = {}) {
    const rawUrl = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    const path = stripPrefix(rawUrl);

    let body;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ method, path, body });

    const matching = script.filter((entry) => matchesEntry(entry, method, path));
    if (matching.length === 0) {
      throw new Error(
        `installFetchMock: unmatched request ${method} ${path} — add a script entry for it.`,
      );
    }
    const key = `${method} ${path}`;
    const seenCount = callCounts.get(key) ?? 0;
    callCounts.set(key, seenCount + 1);
    const entry = matching[Math.min(seenCount, matching.length - 1)];

    if (entry.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, entry.delayMs));
    }
    const status = entry.status ?? 200;
    // The Fetch spec forbids a body on null-body statuses (204/205/304);
    // the real Express responses this mocks never send one for those either.
    const responseBody = entry.json === undefined ? null : JSON.stringify(entry.json);
    return new Response(responseBody, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  vi.stubGlobal("fetch", vi.fn(mockFetch));

  return {
    calls,
    /** All recorded calls matching a method + path (string exact or RegExp). */
    callsMatching(method, path) {
      return calls.filter((call) =>
        matchesEntry({ method, path }, call.method, call.path),
      );
    },
  };
}
