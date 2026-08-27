// QA-CU-01..04: independent unit coverage of client/src/lib/money.js.
import { describe, it, expect } from "vitest";
import {
  parseMoneyToMinor,
  formatMoney,
  minorToInputValue,
} from "../../src/lib/money.js";

describe("QA-CU-01: parseMoneyToMinor", () => {
  it.each([
    ["42.50", 4250],
    ["42", 4200],
    ["0.1", 10],
    ["0.01", 1],
    ["007", 700],
    ["-3.10", -310],
    ["0", 0],
  ])("parseMoneyToMinor(%s) === %i", (input, expected) => {
    expect(parseMoneyToMinor(input)).toBe(expected);
  });
});

describe("QA-CU-02: formatMoney (kit numbers, no currency symbol)", () => {
  it.each([
    [1250000, "12,500"],
    [420050, "4,200.50"],
    [420000, "4,200"],
    [0, "0"],
    [-230000, "-2,300"],
    [842000, "8,420"],
  ])("formatMoney(%i) === %s", (minor, expected) => {
    const result = formatMoney(minor);
    expect(result).toBe(expected);
    expect(result).not.toContain("$");
  });
});

describe("QA-CU-03: parseMoneyToMinor rejects malformed input", () => {
  it.each([[""], [" "], ["1,000"], ["1e3"], ["42.505"], [".5"], ["abc"], [42]])(
    "parseMoneyToMinor(%j) === null",
    (input) => {
      expect(parseMoneyToMinor(input)).toBeNull();
    },
  );
});

describe("QA-CU-04: minorToInputValue <-> parseMoneyToMinor round-trip", () => {
  it.each([0, 1, 10, 99, 100, 101, 4250, 1250000, 99999999])(
    "round-trips %i losslessly",
    (minor) => {
      const inputValue = minorToInputValue(minor);
      expect(parseMoneyToMinor(inputValue)).toBe(minor);
    },
  );
});
