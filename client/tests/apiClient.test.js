import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError, describeAuthError } from "../src/api/client.js";

function jsonResponse(body, { status = 200 } = {}) {
  // Null-body statuses (204/205/304) must not receive a body at all.
  if (body === null) {
    return new Response(null, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiClient (fetch wrapper)", () => {
  let fetchMock;
  let sessionExpiredEvents;
  const recordSessionExpired = () => {
    sessionExpiredEvents += 1;
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    sessionExpiredEvents = 0;
    window.addEventListener("session-expired", recordSessionExpired);
  });

  afterEach(() => {
    window.removeEventListener("session-expired", recordSessionExpired);
    vi.unstubAllGlobals();
  });

  it("GETs with credentials included and returns the parsed payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ budget: { month: "2026-07" } }));

    const payload = await apiClient.get("/budgets/2026-07");

    expect(payload).toEqual({ budget: { month: "2026-07" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/budgets/2026-07");
    expect(init.credentials).toBe("include");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("POSTs a JSON body with the JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ user: { id: "u1" } }, { status: 201 }),
    );

    await apiClient.post("/auth/register", {
      email: "a@example.com",
      password: "longenough",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      email: "a@example.com",
      password: "longenough",
    });
  });

  it("returns null for an empty (204) response body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));
    await expect(
      apiClient.delete("/budgets/2026-07/transactions/tx1"),
    ).resolves.toBeNull();
  });

  it("throws a fully-populated ApiError from the documented error envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Enter a valid email",
            fieldErrors: { email: "Enter a valid email" },
            requestId: "req-123",
          },
        },
        { status: 400 },
      ),
    );

    const err = await apiClient.post("/auth/register", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Enter a valid email");
    expect(err.fieldErrors).toEqual({ email: "Enter a valid email" });
    expect(err.requestId).toBe("req-123");
  });

  it("falls back to a safe generic error when the failure body is not the envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>gateway error</html>", { status: 502 }),
    );

    const err = await apiClient.get("/budgets/2026-07").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("INTERNAL");
    expect(err.status).toBe(502);
    expect(err.message).toBe("Something went wrong. Please try again.");
  });

  it("dispatches session-expired on a private 401, but not on auth bootstrap paths", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in required.",
            requestId: "r",
          },
        },
        { status: 401 },
      ),
    );

    await apiClient.get("/budgets/2026-07").catch(() => {});
    expect(sessionExpiredEvents).toBe(1);

    await apiClient.get("/auth/me").catch(() => {});
    await apiClient.post("/auth/login", {}).catch(() => {});
    await apiClient.post("/auth/register", {}).catch(() => {});
    expect(sessionExpiredEvents).toBe(1);
  });
});

describe("describeAuthError", () => {
  it("maps a non-ApiError to the generic form error", () => {
    expect(describeAuthError(new TypeError("offline"))).toEqual({
      fieldErrors: {},
      formError: "Something went wrong. Please try again.",
    });
  });

  it("passes server fieldErrors through untouched", () => {
    const err = new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Invalid",
      fieldErrors: { password: "Too short" },
    });
    expect(describeAuthError(err)).toEqual({
      fieldErrors: { password: "Too short" },
      formError: "",
    });
  });

  it("attaches a bare 409 CONFLICT to the named field", () => {
    const err = new ApiError({
      code: "CONFLICT",
      status: 409,
      message: "An account with this email already exists.",
    });
    expect(describeAuthError(err, { conflictField: "email" })).toEqual({
      fieldErrors: { email: "An account with this email already exists." },
      formError: "",
    });
  });

  it("falls back to the error message as the form error", () => {
    const err = new ApiError({
      code: "UNAUTHENTICATED",
      status: 401,
      message: "Incorrect email or password.",
    });
    expect(describeAuthError(err)).toEqual({
      fieldErrors: {},
      formError: "Incorrect email or password.",
    });
  });
});
