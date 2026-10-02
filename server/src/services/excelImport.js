import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { AppError } from "../errors.js";
import { daysInMonth } from "./calc.js";

const labels = {
  date: ["תאריך עסקה", "Purchase date", "Date"],
  merchant: ["שם בית העסק", "Merchant", "Description"],
  category: ["קטגוריה", "Category"],
  amount: ["סכום חיוב", "Billed amount", "Amount"],
  currency: ["מטבע חיוב", "Currency"],
  billed: ["תאריך חיוב", "Billing date"],
  card: ["4 ספרות אחרונות של כרטיס האשראי", "Card"],
  note: ["הערות", "Notes"],
  original: ["סכום עסקה מקורי", "Original amount"],
};
const fail = (message) => {
  throw new AppError("VALIDATION_ERROR", message);
};

// Inspect the ZIP directory before decompression, bounding both entries and inflated bytes.
export function validateWorkbookZip(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > 5 * 1024 * 1024)
    fail("Choose an XLSX file up to 5 MB.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) fail("This is not a valid XLSX workbook.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16),
    total = 0;
  if (count > 2000 || count === 0) fail("Workbook contains too many parts.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      fail("Invalid workbook archive.");
    total += bytes.readUInt32LE(offset + 24);
    if (total > 32 * 1024 * 1024) fail("Workbook is too large when expanded.");
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
}
export function importDate(value) {
  if (typeof value === "number")
    value = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    value = value.toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
  if (
    !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(iso) ||
    Number(iso.slice(8)) < 1 ||
    Number(iso.slice(8)) > daysInMonth(iso.slice(0, 7))
  )
    return null;
  return iso;
}
function text(value) {
  return typeof value === "object" && value !== null ? "" : String(value ?? "").trim();
}
export async function parseWorkbook(bytes, { dateBasis = "purchase" } = {}) {
  validateWorkbookZip(bytes);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    fail("The workbook could not be read. Save it as XLSX and try again.");
  }
  const rows = [],
    issues = [],
    counts = new Map();
  let recognized = 0;
  for (const sheet of workbook.worksheets) {
    let header = 0,
      map = {};
    for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
      const values = Array.from(sheet.getRow(r).values, text);
      const candidate = Object.fromEntries(
        Object.entries(labels).map(([key, names]) => [
          key,
          values.findIndex((v) => names.some((n) => n.toLowerCase() === v.toLowerCase())),
        ]),
      );
      if (candidate.date > 0 && candidate.amount > 0 && candidate.merchant > 0) {
        header = r;
        map = candidate;
        break;
      }
    }
    if (!header) {
      issues.push({
        sheet: sheet.name,
        row: 0,
        message: "No transaction headers found.",
      });
      continue;
    }
    recognized++;
    if (sheet.rowCount > 5005) fail("Import at most 5,000 rows at a time.");
    for (let r = header + 1; r <= sheet.rowCount; r++) {
      const values = sheet.getRow(r).values;
      const merchant = text(values[map.merchant]);
      if (!merchant && !values[map.date]) continue;
      if (/^(סך הכל|total)/i.test(text(values[map.date]))) break;
      const dateValue = values[dateBasis === "billing" ? map.billed : map.date];
      const occurredOn = importDate(dateValue),
        amount = values[map.amount];
      const currency = text(values[map.currency]) || "ILS";
      const amountMinor =
        typeof amount === "number"
          ? Math.round(amount * 100)
          : Math.round(Number(text(amount).replace(/[,₪\s]/g, "")) * 100);
      if (
        !occurredOn ||
        !merchant ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor === 0 ||
        Math.abs(amountMinor) > 100000000000 ||
        !["ILS", "₪", "NIS"].includes(currency)
      ) {
        issues.push({
          sheet: sheet.name,
          row: r,
          message: "Check date, merchant and non-zero billed amount in ILS.",
        });
        continue;
      }
      const metadata = {
        sourceCategory: text(values[map.category]),
        card: text(values[map.card]),
        billingDate: importDate(values[map.billed]),
        purchaseDate: importDate(values[map.date]),
        originalAmount:
          typeof values[map.original] === "number" ? values[map.original] : null,
      };
      const note = [merchant, text(values[map.note])]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200);
      // Keep identical legitimate rows, but dedupe the same occurrence on repeat imports.
      const identity = JSON.stringify([
        metadata.purchaseDate,
        metadata.billingDate,
        merchant,
        metadata.card,
        amountMinor,
        text(values[map.note]),
      ]);
      const occurrence = (counts.get(identity) ?? 0) + 1;
      counts.set(identity, occurrence);
      const importKey = createHash("sha256")
        .update(identity + ":" + occurrence)
        .digest("hex");
      rows.push({
        index: rows.length,
        occurredOn,
        amountMinor,
        note,
        metadata,
        importKey,
        sourceSheet: sheet.name,
        sourceRow: r,
      });
    }
  }
  if (!recognized)
    fail(
      "No supported transaction sheet found. Expected Date, Merchant and Amount columns.",
    );
  if (rows.length > 5000) fail("Import at most 5,000 transactions at a time.");
  return { rows, issues };
}
