// Money is always an integer number of minor units (cents) once it leaves
// this module. User input is parsed by string splitting, never by
// `parseFloat`, to avoid floating-point drift on currency values.

const MONEY_INPUT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Parses a user-typed amount string (e.g. "42.50", "42", "-3.1") into an
 * integer number of minor units (e.g. 4250). Returns `null` for empty or
 * malformed input so callers can render a validation error.
 */
export function parseMoneyToMinor(input) {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (!MONEY_INPUT_PATTERN.test(unsigned)) {
    return null;
  }
  const [wholePart, fractionPartRaw = ""] = unsigned.split(".");
  const fractionPart = `${fractionPartRaw}00`.slice(0, 2);
  const wholeDigits = wholePart.replace(/^0+(?=\d)/, "");
  const minor = Number(wholeDigits || "0") * 100 + Number(fractionPart || "0");
  return negative ? -minor : minor;
}

/**
 * Renders integer minor units as a plain editable input value ("4250" ->
 * "42.50", "400000" -> "4000") — pure string arithmetic, no float division,
 * round-tripping exactly through `parseMoneyToMinor`.
 */
export function minorToInputValue(minor) {
  if (typeof minor !== "number" || !Number.isFinite(minor)) {
    return "";
  }
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const formatted = cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, "0")}`;
  return negative ? `-${formatted}` : formatted;
}

/**
 * Renders integer minor units as "1,234" (en-US grouping, no currency
 * symbol per product decision #1). Cents are shown only when nonzero, e.g.
 * 420050 -> "4,200.50" but 420000 -> "4,200".
 */
export function formatMoney(minor) {
  if (typeof minor !== "number" || !Number.isFinite(minor)) {
    return "";
  }
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const wholeUnits = Math.floor(abs / 100);
  const cents = abs % 100;
  const wholeFormatted = wholeUnits.toLocaleString("en-US");
  const formatted =
    cents === 0 ? wholeFormatted : `${wholeFormatted}.${String(cents).padStart(2, "0")}`;
  return negative ? `-${formatted}` : formatted;
}
