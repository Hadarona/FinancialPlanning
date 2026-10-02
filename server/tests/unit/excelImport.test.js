import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  parseWorkbook,
  importDate,
  validateWorkbookZip,
} from "../../src/services/excelImport.js";

async function workbook(rows) {
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet("Transactions");
  s.addRow(["statement"]);
  s.addRow([
    "Date",
    "Merchant",
    "Amount",
    "Currency",
    "Category",
    "Billing date",
    "Original amount",
    "Notes",
  ]);
  rows.forEach((r) => s.addRow(r));
  return Buffer.from(await w.xlsx.writeBuffer());
}
describe("Excel import", () => {
  it("uses purchase dates and billed installment amounts, preserving duplicate occurrences", async () => {
    const bytes = await workbook([
      ["31-07-2026", "Example shop", 50, "₪", "Food", "02-09-2026", 100, "1 of 2"],
      ["31-07-2026", "Example shop", 50, "₪", "Food", "02-09-2026", 100, "1 of 2"],
    ]);
    const result = await parseWorkbook(bytes);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ occurredOn: "2026-07-31", amountMinor: 5000 });
    expect(result.rows[0].importKey).not.toBe(result.rows[1].importKey);
    expect((await parseWorkbook(bytes)).rows.map((r) => r.importKey)).toEqual(
      result.rows.map((r) => r.importKey),
    );
    expect(
      (await parseWorkbook(bytes, { dateBasis: "billing" })).rows[0].occurredOn,
    ).toBe("2026-09-02");
  });
  it("flags invalid dates, currencies and formulas, and preserves refunds", async () => {
    const bytes = await workbook([
      ["31-02-2026", "Shop", 4, "ILS"],
      ["01-02-2026", "Shop", 4, "USD"],
      ["01-02-2026", "Shop", { formula: "2+2", result: 4 }, "ILS"],
      ["01-02-2026", "Shop", -4, "ILS"],
    ]);
    const result = await parseWorkbook(bytes);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amountMinor).toBe(-400);
    expect(result.issues).toHaveLength(3);
  });
  it("rejects invalid archives and unsupported worksheets", async () => {
    expect(() => validateWorkbookZip(Buffer.from("bad"))).toThrow();
    expect(() => validateWorkbookZip(Buffer.alloc(100))).toThrow();
    const w = new ExcelJS.Workbook();
    w.addWorksheet("Empty").addRow(["unrecognized"]);
    await expect(parseWorkbook(Buffer.from(await w.xlsx.writeBuffer()))).rejects.toThrow(
      "No supported",
    );
  });
  it("handles Excel numeric dates and leap days", () => {
    expect(importDate("29/02/2024")).toBe("2024-02-29");
    expect(importDate("29/02/2025")).toBeNull();
    expect(importDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
    expect(importDate(46023)).toBe("2026-01-01");
    expect(importDate(null)).toBeNull();
  });
});
