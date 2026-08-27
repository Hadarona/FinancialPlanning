// QA-SU-20..33: independent unit coverage of server/src/validation/schemas.js.
import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  monthSchema,
  createBudgetSchema,
  patchBudgetSchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "../../../src/validation/schemas.js";
import { kitCategoriesPayload } from "../helpers/qaFixtures.js";

describe("QA-SU-20..23: registerSchema / loginSchema", () => {
  it("QA-SU-20: normalizes email (trim + lowercase)", () => {
    const result = registerSchema.safeParse({
      email: "  User@EXAMPLE.com  ",
      password: "supersecret1",
    });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe("user@example.com");
  });

  it.each([
    [7, false],
    [8, true],
    [72, true],
    [73, false],
  ])("QA-SU-21: password length %i accepted=%s", (length, accepted) => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      password: "a".repeat(length),
    });
    expect(result.success).toBe(accepted);
  });

  it("QA-SU-22: rejects an unknown extra key (mass-assignment risk)", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      password: "supersecret1",
      admin: true,
    });
    expect(result.success).toBe(false);
    const loginResult = loginSchema.safeParse({
      email: "a@b.com",
      password: "x",
      admin: true,
    });
    expect(loginResult.success).toBe(false);
  });

  it("QA-SU-23: rejects invalid emails and empty login password with messages", () => {
    for (const email of ["a@", "a b@c.d"]) {
      const result = registerSchema.safeParse({ email, password: "supersecret1" });
      expect(result.success).toBe(false);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
    const emptyPassword = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(emptyPassword.success).toBe(false);
    expect(emptyPassword.error.issues[0].message).toBeTruthy();
  });
});

describe("QA-SU-24: monthSchema", () => {
  it.each([
    ["2026-07", true],
    ["2026-00", false],
    ["2026-13", false],
    ["2026-7", false],
    ["202607", false],
    ["2026-07-01", false],
  ])("monthSchema(%s) valid=%s", (value, valid) => {
    expect(monthSchema.safeParse(value).success).toBe(valid);
  });
});

describe("QA-SU-25..28: budget body schemas", () => {
  it("QA-SU-25: createBudgetSchema rejects 4 categories, 6 categories, a duplicate id, and an unknown id", () => {
    const base = { month: "2026-07", incomeMinor: 1250000 };
    const fourCategories = kitCategoriesPayload().slice(0, 4);
    expect(
      createBudgetSchema.safeParse({ ...base, categories: fourCategories }).success,
    ).toBe(false);

    const sixCategories = [...kitCategoriesPayload(), { id: "housing", plannedMinor: 1 }];
    expect(
      createBudgetSchema.safeParse({ ...base, categories: sixCategories }).success,
    ).toBe(false);

    const duplicateId = kitCategoriesPayload().slice(0, 4);
    duplicateId.push({ id: duplicateId[0].id, plannedMinor: 1 });
    expect(
      createBudgetSchema.safeParse({ ...base, categories: duplicateId }).success,
    ).toBe(false);

    const unknownId = kitCategoriesPayload().slice(0, 4);
    unknownId.push({ id: "phones", plannedMinor: 1 });
    expect(createBudgetSchema.safeParse({ ...base, categories: unknownId }).success).toBe(
      false,
    );
  });

  it("QA-SU-26: plannedMinor rejects negative/fractional/string, accepts 0", () => {
    const base = { month: "2026-07", incomeMinor: 1250000 };
    function withHousingPlanned(plannedMinor) {
      return kitCategoriesPayload().map((category) =>
        category.id === "housing" ? { ...category, plannedMinor } : category,
      );
    }
    expect(
      createBudgetSchema.safeParse({ ...base, categories: withHousingPlanned(-1) })
        .success,
    ).toBe(false);
    expect(
      createBudgetSchema.safeParse({ ...base, categories: withHousingPlanned(100.5) })
        .success,
    ).toBe(false);
    expect(
      createBudgetSchema.safeParse({ ...base, categories: withHousingPlanned("100") })
        .success,
    ).toBe(false);
    expect(
      createBudgetSchema.safeParse({ ...base, categories: withHousingPlanned(0) })
        .success,
    ).toBe(true);
  });

  it("QA-SU-27: incomeMinor rejects negative/fractional, accepts 0", () => {
    const categories = kitCategoriesPayload();
    expect(
      createBudgetSchema.safeParse({ month: "2026-07", incomeMinor: -1, categories })
        .success,
    ).toBe(false);
    expect(
      createBudgetSchema.safeParse({ month: "2026-07", incomeMinor: 0.5, categories })
        .success,
    ).toBe(false);
    expect(
      createBudgetSchema.safeParse({ month: "2026-07", incomeMinor: 0, categories })
        .success,
    ).toBe(true);
  });

  it("QA-SU-28: patchBudgetSchema rejects an empty body; allows income-only or a category subset; rejects 6/duplicate categories", () => {
    expect(patchBudgetSchema.safeParse({}).success).toBe(false);
    expect(patchBudgetSchema.safeParse({ incomeMinor: 100 }).success).toBe(true);
    expect(
      patchBudgetSchema.safeParse({ categories: [{ id: "housing", plannedMinor: 1 }] })
        .success,
    ).toBe(true);
    const sixCategories = [...kitCategoriesPayload(), { id: "housing", plannedMinor: 1 }];
    expect(patchBudgetSchema.safeParse({ categories: sixCategories }).success).toBe(
      false,
    );
    const duplicateId = [
      { id: "housing", plannedMinor: 1 },
      { id: "housing", plannedMinor: 2 },
    ];
    expect(patchBudgetSchema.safeParse({ categories: duplicateId }).success).toBe(false);
  });
});

describe("QA-SU-29..33: transaction schemas", () => {
  const validTransaction = {
    categoryId: "groceries",
    amountMinor: 100,
    occurredOn: "2026-07-01",
  };

  it("QA-SU-29: amountMinor rejects 0/-1/1.5/string, accepts a positive integer", () => {
    for (const amountMinor of [0, -1, 1.5, "5"]) {
      const result = createTransactionSchema.safeParse({
        ...validTransaction,
        amountMinor,
      });
      expect(result.success).toBe(false);
    }
    expect(
      createTransactionSchema.safeParse({ ...validTransaction, amountMinor: 1 }).success,
    ).toBe(true);
  });

  it("QA-SU-30: occurredOn rejects non-YYYY-MM-DD formats, accepts the canonical format", () => {
    expect(
      createTransactionSchema.safeParse({ ...validTransaction, occurredOn: "2026-7-1" })
        .success,
    ).toBe(false);
    expect(
      createTransactionSchema.safeParse({ ...validTransaction, occurredOn: "07/01/2026" })
        .success,
    ).toBe(false);
    expect(
      createTransactionSchema.safeParse({ ...validTransaction, occurredOn: "2026-07-01" })
        .success,
    ).toBe(true);
  });

  it("QA-SU-31: note bounds — 200 chars pass, 201 fail, empty string transforms to undefined", () => {
    const note200 = "n".repeat(200);
    const note201 = "n".repeat(201);
    const result200 = createTransactionSchema.safeParse({
      ...validTransaction,
      note: note200,
    });
    expect(result200.success).toBe(true);
    expect(
      createTransactionSchema.safeParse({ ...validTransaction, note: note201 }).success,
    ).toBe(false);
    const resultEmpty = createTransactionSchema.safeParse({
      ...validTransaction,
      note: "",
    });
    expect(resultEmpty.success).toBe(true);
    expect(resultEmpty.data.note).toBeUndefined();
  });

  it("QA-SU-32: clientRequestId must be a UUID when present, absence is fine", () => {
    expect(
      createTransactionSchema.safeParse({
        ...validTransaction,
        clientRequestId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      createTransactionSchema.safeParse({
        ...validTransaction,
        clientRequestId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      }).success,
    ).toBe(true);
    expect(createTransactionSchema.safeParse(validTransaction).success).toBe(true);
  });

  it("QA-SU-33: listTransactionsQuerySchema bounds, defaults, and strictness", () => {
    expect(listTransactionsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ limit: "1" }).success).toBe(true);
    expect(listTransactionsQuerySchema.safeParse({ limit: "200" }).success).toBe(true);
    const defaults = listTransactionsQuerySchema.safeParse({});
    expect(defaults.success).toBe(true);
    expect(defaults.data.limit).toBe(50);
    expect(defaults.data.offset).toBe(0);
    expect(listTransactionsQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    expect(
      listTransactionsQuerySchema.safeParse({ limit: "10", extra: "x" }).success,
    ).toBe(false);
  });
});
