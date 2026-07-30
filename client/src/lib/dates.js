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
