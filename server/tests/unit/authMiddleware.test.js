import { describe, it, expect, vi } from "vitest";
import { createRequireAuth, SESSION_COOKIE_NAME } from "../../src/middleware/auth.js";
import { AppError } from "../../src/errors.js";

function makeReq(cookies = {}) {
  return { cookies };
}

describe("requireAuth middleware", () => {
  it("rejects a request with no session cookie", async () => {
    const authService = { verifySession: vi.fn() };
    const userRepo = { findById: vi.fn() };
    const requireAuth = createRequireAuth({ authService, userRepo });
    const next = vi.fn();

    await requireAuth(makeReq(), {}, next);

    expect(authService.verifySession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an invalid/expired token", async () => {
    const authService = { verifySession: vi.fn(() => null) };
    const userRepo = { findById: vi.fn() };
    const requireAuth = createRequireAuth({ authService, userRepo });
    const next = vi.fn();

    await requireAuth(makeReq({ [SESSION_COOKIE_NAME]: "garbage" }), {}, next);

    expect(userRepo.findById).not.toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a valid token for a user that no longer exists", async () => {
    const authService = { verifySession: vi.fn(() => ({ sub: "user-1" })) };
    const userRepo = { findById: vi.fn(async () => null) };
    const requireAuth = createRequireAuth({ authService, userRepo });
    const next = vi.fn();

    await requireAuth(makeReq({ [SESSION_COOKIE_NAME]: "valid" }), {}, next);

    const err = next.mock.calls[0][0];
    expect(err.code).toBe("UNAUTHENTICATED");
  });

  it("attaches req.user and calls next() with no error for a valid session", async () => {
    const authService = { verifySession: vi.fn(() => ({ sub: "user-1" })) };
    const userRepo = { findById: vi.fn(async () => ({ id: "user-1", email: "a@b.com" })) };
    const requireAuth = createRequireAuth({ authService, userRepo });
    const req = makeReq({ [SESSION_COOKIE_NAME]: "valid" });
    const next = vi.fn();

    await requireAuth(req, {}, next);

    expect(req.user).toEqual({ id: "user-1", email: "a@b.com" });
    expect(next).toHaveBeenCalledWith();
  });
});
