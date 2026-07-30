import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../../src/validation/schemas.js";

describe("registerSchema", () => {
  it("normalizes email casing and whitespace", () => {
    const result = registerSchema.parse({
      email: "  User@Example.com  ",
      password: "supersecret",
    });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ email: "not-an-email", password: "supersecret" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys (strict schema)", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      password: "supersecret",
      isAdmin: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a well-formed login body", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys (strict schema)", () => {
    const result = loginSchema.safeParse({
      email: "a@b.com",
      password: "anything",
      rememberMe: true,
    });
    expect(result.success).toBe(false);
  });
});
