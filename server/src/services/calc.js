// Pure calculation helpers. No I/O, no framework dependencies — kept easy to
// unit test in isolation. Stage C (budget summary) extends this module with
// summarizeBudget/monthRange/largestRemainderShares.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Returns the calendar month immediately before `month` (format `YYYY-MM`),
 * handling the January -> December/previous-year rollover.
 */
export function previousMonth(month) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid month: ${month}`);
  }
  const [yearStr, monthStr] = month.split("-");
  let year = Number(yearStr);
  let monthNum = Number(monthStr) - 1;
  if (monthNum < 1) {
    monthNum = 12;
    year -= 1;
  }
  return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
}
