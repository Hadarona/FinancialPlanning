import { describe, it, expect, vi } from "vitest";
import { createAuthService } from "../../src/services/authService.js";
import { AppError } from "../../src/errors.js";

const testConfig = { bcryptRounds: 4, jwtSecret: "unit-test-secret" };

function makeUserRepo(overrides = {}) {
  return {
    createUser: vi.fn(async ({ email }) => ({
      id: "11111111-1111-1111-1111-111111111111",
      email,
      created_at: new Date().toISOString(),
    })),
    findByEmail: vi.fn(async () => null),
    findById: vi.fn(async () => null),
    ...overrides,
  };
}

describe("authService.register", () => {
  it("hashes the password and never returns it", async () => {
    const userRepo = makeUserRepo();
    const authService = createAuthService({ userRepo, config: testConfig });

    const user = await authService.register({ email: "a@b.com", password: "supersecret" });

    expect(user).toEqual({ id: expect.any(String), email: "a@b.com" });
    expect(user.passwordHash).toBeUndefined();
    expect(user.password).toBeUndefined();
    const [[insertArgs]] = userRepo.createUser.mock.calls;
    expect(insertArgs.passwordHash).not.toBe("supersecret");
  });

  it("maps a unique-violation into a safe 409 CONFLICT AppError", async () => {
    const userRepo = makeUserRepo({
      createUser: vi.fn(async () => {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }),
    });
    const authService = createAuthService({ userRepo, config: testConfig });

    await expect(authService.register({ email: "a@b.com", password: "supersecret" })).rejects.toMatchObject(
      { code: "CONFLICT", status: 409 },
    );
  });

  it("rethrows unrelated repository errors", async () => {
    const userRepo = makeUserRepo({
      createUser: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    });
    const authService = createAuthService({ userRepo, config: testConfig });

    await expect(
      authService.register({ email: "a@b.com", password: "supersecret" }),
    ).rejects.toThrow("connection lost");
  });
});

describe("authService.login", () => {
  it("logs in with correct credentials", async () => {
    const userRepo = makeUserRepo();
    const authService = createAuthService({ userRepo, config: testConfig });
    const registered = await authService.register({ email: "a@b.com", password: "supersecret" });

    const [[{ passwordHash }]] = userRepo.createUser.mock.calls;
    userRepo.findByEmail.mockResolvedValueOnce({
      id: registered.id,
      email: "a@b.com",
      password_hash: passwordHash,
    });

    const user = await authService.login({ email: "a@b.com", password: "supersecret" });
    expect(user).toEqual({ id: registered.id, email: "a@b.com" });
  });

  it("rejects an unknown email with a generic message", async () => {
    const userRepo = makeUserRepo({ findByEmail: vi.fn(async () => null) });
    const authService = createAuthService({ userRepo, config: testConfig });

    await expect(
      authService.login({ email: "nobody@example.com", password: "whatever" }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("rejects a wrong password with the identical message/code as an unknown email", async () => {
    const userRepo = makeUserRepo({
      findByEmail: vi.fn(async () => ({
        id: "id-1",
        email: "a@b.com",
        password_hash: "$2a$04$abcdefghijklmnopqrstuv", // not a real match
      })),
    });
    const authService = createAuthService({ userRepo, config: testConfig });

    let unknownEmailError;
    let wrongPasswordError;
    try {
      await authService.login({ email: "nobody@example.com", password: "whatever" });
    } catch (err) {
      unknownEmailError = err;
    }
    try {
      await authService.login({ email: "a@b.com", password: "whatever" });
    } catch (err) {
      wrongPasswordError = err;
    }

    expect(unknownEmailError).toBeInstanceOf(AppError);
    expect(wrongPasswordError).toBeInstanceOf(AppError);
    expect(wrongPasswordError.code).toBe(unknownEmailError.code);
    expect(wrongPasswordError.message).toBe(unknownEmailError.message);
    expect(wrongPasswordError.status).toBe(unknownEmailError.status);
  });
});

describe("authService session tokens", () => {
  it("signs and verifies a round-trip session", () => {
    const authService = createAuthService({ userRepo: makeUserRepo(), config: testConfig });
    const token = authService.signSession({ id: "user-1", email: "a@b.com" });
    const payload = authService.verifySession(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
  });

  it("returns null for a malformed or invalid token", () => {
    const authService = createAuthService({ userRepo: makeUserRepo(), config: testConfig });
    expect(authService.verifySession("not-a-real-token")).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const authService = createAuthService({ userRepo: makeUserRepo(), config: testConfig });
    const otherService = createAuthService({
      userRepo: makeUserRepo(),
      config: { ...testConfig, jwtSecret: "a-different-secret" },
    });
    const token = otherService.signSession({ id: "user-1", email: "a@b.com" });
    expect(authService.verifySession(token)).toBeNull();
  });
});
