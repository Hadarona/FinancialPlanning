import { describe, it, expect } from "vitest";
import { previousMonth } from "../../src/services/calc.js";

describe("previousMonth", () => {
  it("rolls back within the same year", () => {
    expect(previousMonth("2026-07")).toBe("2026-06");
  });

  it("rolls back across a year boundary (January -> previous December)", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("rejects a malformed month", () => {
    expect(() => previousMonth("2026-13")).toThrow();
  });
});
