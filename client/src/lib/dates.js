// Calendar-date policy (decision #6): month membership is a pure string/date
// comparison; there is no timezone math anywhere in this module.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Returns the current local calendar month as "YYYY-MM". */
export function currentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Returns today as a local "YYYY-MM-DD" date string. */
export function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function assertMonth(month) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid month: ${month}`);
  }
}

/** Returns the calendar month immediately before `month` ("YYYY-MM"). */
export function previousMonth(month) {
  assertMonth(month);
  const [yearStr, monthStr] = month.split("-");
  let year = Number(yearStr);
  let monthNum = Number(monthStr) - 1;
  if (monthNum < 1) {
    monthNum = 12;
    year -= 1;
  }
  return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
}

/**
 * Returns `count` calendar months ending at `from` (inclusive), newest
 * first — e.g. the last 12 months for the CR3 month multi-select. Pure
 * string month math, year-boundary safe.
 */
export function lastMonths(count, from = currentMonth()) {
  const months = [];
  let month = from;
  for (let i = 0; i < count; i += 1) {
    months.push(month);
    month = previousMonth(month);
  }
  return months;
}

/** Returns the calendar month immediately after `month` ("YYYY-MM"). */
export function nextMonth(month) {
  assertMonth(month);
  const [yearStr, monthStr] = month.split("-");
  let year = Number(yearStr);
  let monthNum = Number(monthStr) + 1;
  if (monthNum > 12) {
    monthNum = 1;
    year += 1;
  }
  return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
}

/** Returns just the month name, e.g. "2026-07" -> "July". */
export function monthLabel(month) {
  assertMonth(month);
  const monthNum = Number(month.split("-")[1]);
  return MONTH_NAMES[monthNum - 1];
}

/** Returns the month name and year, e.g. "2026-07" -> "July 2026". */
export function monthYearLabel(month) {
  assertMonth(month);
  const [year] = month.split("-");
  return `${monthLabel(month)} ${year}`;
}

/** Short label for a calendar date string, e.g. "2026-07-15" -> "Jul 15".
 * Pure string arithmetic — no Date parsing, no timezone math. */
export function shortDateLabel(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  const monthNum = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return `${MONTH_NAMES[monthNum - 1].slice(0, 3)} ${day}`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** First/last calendar dates of a month ("YYYY-MM-DD"), leap-year aware.
 * Mirrors server/src/services/calc.js monthRange. */
export function monthRange(month) {
  assertMonth(month);
  const [yearStr, monthStr] = month.split("-");
  const monthNum = Number(monthStr);
  const days =
    monthNum === 2 && isLeapYear(Number(yearStr)) ? 29 : DAYS_IN_MONTH[monthNum - 1];
  return {
    firstDay: `${month}-01`,
    lastDay: `${month}-${String(days).padStart(2, "0")}`,
  };
}
