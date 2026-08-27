import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  monthSchema,
  emptyBodySchema,
  patchBudgetSchema,
  insightsQuerySchema,
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

describe("emptyBodySchema (POST /budget takes no body, CR1-2)", () => {
  it("accepts an absent or empty body", () => {
    expect(emptyBodySchema.safeParse(undefined).success).toBe(true);
    expect(emptyBodySchema.safeParse({}).success).toBe(true);
  });

  it("rejects any supplied key (defaults are server constants)", () => {
    expect(emptyBodySchema.safeParse({ incomeMinor: 1 }).success).toBe(false);
    expect(emptyBodySchema.safeParse({ month: "2026-07" }).success).toBe(false);
  });
});

describe("patchBudgetSchema (seven fixed categories, CR2-3)", () => {
  it("accepts income only, categories only, or both", () => {
    expect(patchBudgetSchema.safeParse({ incomeMinor: 1250000 }).success).toBe(true);
    expect(
      patchBudgetSchema.safeParse({
        categories: [{ id: "subscriptions", plannedMinor: 70000 }],
      }).success,
    ).toBe(true);
    expect(
      patchBudgetSchema.safeParse({
        incomeMinor: 1300000,
        categories: [{ id: "utilities", plannedMinor: 90000 }],
      }).success,
    ).toBe(true);
  });

  it("accepts all seven unique categories and rejects an eighth/duplicate", () => {
    const seven = [
      "housing",
      "groceries",
      "transport",
      "fun",
      "savings",
      "subscriptions",
      "utilities",
    ].map((id) => ({ id, plannedMinor: 1000 }));
    expect(patchBudgetSchema.safeParse({ categories: seven }).success).toBe(true);
    expect(
      patchBudgetSchema.safeParse({
        categories: [...seven, { id: "housing", plannedMinor: 1 }],
      }).success,
    ).toBe(false);
    expect(
      patchBudgetSchema.safeParse({
        categories: [
          { id: "housing", plannedMinor: 1 },
          { id: "housing", plannedMinor: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown category ids, empty patches, and unknown keys", () => {
    expect(
      patchBudgetSchema.safeParse({ categories: [{ id: "pets", plannedMinor: 1 }] })
        .success,
    ).toBe(false);
    expect(patchBudgetSchema.safeParse({}).success).toBe(false);
    expect(patchBudgetSchema.safeParse({ month: "2026-07" }).success).toBe(false);
  });
});

describe("insightsQuerySchema (1-3 unique months, CR3-3)", () => {
  it("parses one, two, and three comma-separated months", () => {
    expect(insightsQuerySchema.parse({ months: "2026-07" }).months).toEqual(["2026-07"]);
    expect(insightsQuerySchema.parse({ months: "2026-07,2026-06" }).months).toEqual([
      "2026-07",
      "2026-06",
    ]);
    expect(
      insightsQuerySchema.parse({ months: "2025-12,2026-01,2026-02" }).months,
    ).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("requires the parameter and rejects an empty value", () => {
    expect(insightsQuerySchema.safeParse({}).success).toBe(false);
    expect(insightsQuerySchema.safeParse({ months: "" }).success).toBe(false);
  });

  it("rejects four months, duplicates, and malformed values", () => {
    expect(
      insightsQuerySchema.safeParse({ months: "2026-07,2026-06,2026-05,2026-04" })
        .success,
    ).toBe(false);
    expect(insightsQuerySchema.safeParse({ months: "2026-07,2026-07" }).success).toBe(
      false,
    );
    for (const bad of ["2026-7", "2026-13", "2026-07-01", "july"]) {
      expect(insightsQuerySchema.safeParse({ months: bad }).success).toBe(false);
    }
  });

  it("rejects unknown query keys (strict schema)", () => {
    expect(insightsQuerySchema.safeParse({ months: "2026-07", limit: "5" }).success).toBe(
      false,
    );
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
