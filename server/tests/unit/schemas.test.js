import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  monthSchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "../../src/validation/schemas.js";

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
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "supersecret",
    });
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

describe("monthSchema", () => {
  it("accepts strict YYYY-MM only", () => {
    expect(monthSchema.safeParse("2026-07").success).toBe(true);
    for (const bad of ["2026-7", "2026-13", "2026-00", "202607", "2026-07-01"]) {
      expect(monthSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("createTransactionSchema", () => {
  const valid = { categoryId: "fun", amountMinor: 4250, occurredOn: "2026-07-15" };

  it("accepts a minimal valid expense and drops an empty note", () => {
    const result = createTransactionSchema.parse({ ...valid, note: "   " });
    expect(result.note).toBeUndefined();
    expect(result.amountMinor).toBe(4250);
  });

  it("rejects non-integer, non-positive, and non-numeric amounts", () => {
    for (const amountMinor of [10.5, 0, -1, "100", null]) {
      expect(createTransactionSchema.safeParse({ ...valid, amountMinor }).success).toBe(
        false,
      );
    }
  });

  it("rejects oversized notes, malformed dates, and unknown keys", () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, note: "x".repeat(201) }).success,
    ).toBe(false);
    expect(
      createTransactionSchema.safeParse({ ...valid, occurredOn: "15/07/2026" }).success,
    ).toBe(false);
    expect(createTransactionSchema.safeParse({ ...valid, isAdmin: true }).success).toBe(
      false,
    );
  });

  it("rejects a malformed clientRequestId", () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, clientRequestId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("listTransactionsQuerySchema", () => {
  it("applies documented defaults", () => {
    expect(listTransactionsQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
  });

  it("enforces bounds", () => {
    expect(listTransactionsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    expect(listTransactionsQuerySchema.parse({ limit: "200", offset: "10" })).toEqual({
      limit: 200,
      offset: 10,
    });
  });
});
