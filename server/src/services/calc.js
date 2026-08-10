// Pure calculation helpers. No I/O, no framework dependencies — kept easy to
// unit test in isolation. All money values are integer minor units (cents).

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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

/** Fixed sample days for the cumulative cash-flow series (REST contract):
 * 1, 6, 11, 16, 21, 26, and the month's last day (clamped by month length). */
const CASH_FLOW_BASE_DAYS = [1, 6, 11, 16, 21, 26];

function assertMonth(month) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid month: ${month}`);
  }
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the calendar month immediately before `month` (format `YYYY-MM`),
 * handling the January -> December/previous-year rollover.
 */
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
 * Number of days in a calendar month ("YYYY-MM"), leap-year aware.
 * Pure arithmetic — no Date objects, no timezone math (decision #6).
 */
export function daysInMonth(month) {
  assertMonth(month);
  const [yearStr, monthStr] = month.split("-");
  const monthNum = Number(monthStr);
  if (monthNum === 2 && isLeapYear(Number(yearStr))) {
    return 29;
  }
  return DAYS_IN_MONTH[monthNum - 1];
}

/**
 * First and last calendar dates of a month as "YYYY-MM-DD" strings.
 * Month membership everywhere is a pure string comparison against this
 * range (decision #6) — no timezone math.
 */
export function monthRange(month) {
  assertMonth(month);
  return {
    firstDay: `${month}-01`,
    lastDay: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
  };
}

/** English month name for a "YYYY-MM" month (fixed table, no locale/Date
 * dependency), e.g. "2026-07" -> "July". */
export function monthName(month) {
  assertMonth(month);
  return MONTH_NAMES[Number(month.split("-")[1]) - 1];
}

/** Short chart label for a calendar date string, e.g. "2026-07-16" -> "Jul 16".
 * Pure string arithmetic — no Date parsing, no timezone math (decision #6). */
export function shortDateLabel(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  const monthNum = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return `${MONTH_NAMES[monthNum - 1].slice(0, 3)} ${day}`;
}

/**
 * The seven cash-flow sample dates of a month as "YYYY-MM-DD" strings:
 * days 1, 6, 11, 16, 21, 26 and the last day of the month (leap-aware).
 */
export function cashFlowSampleDates(month) {
  assertMonth(month);
  const lastDay = daysInMonth(month);
  return [...CASH_FLOW_BASE_DAYS, lastDay].map(
    (day) => `${month}-${String(day).padStart(2, "0")}`,
  );
}

/**
 * Cumulative totals at each sample date: for every sample date D, the sum of
 * all per-day totals whose date is <= D (pure string comparison, decision
 * #6). `sumsByDate` is `{ "YYYY-MM-DD": integer minor units }`.
 */
export function cumulativeAtDates(sampleDates, sumsByDate) {
  const entries = Object.entries(sumsByDate).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  let runningTotal = 0;
  let entryIndex = 0;
  return sampleDates.map((sampleDate) => {
    while (entryIndex < entries.length && entries[entryIndex][0] <= sampleDate) {
      runningTotal += entries[entryIndex][1];
      entryIndex += 1;
    }
    return runningTotal;
  });
}

/**
 * Per-category progress state (roadmap read model):
 * - "unplanned": nothing planned but money spent — progressPercent is null
 *   (never a division by zero);
 * - "overspent": actual exceeds a nonzero plan (>100% preserved);
 * - "normal": everything else. plannedMinor === 0 with no spending is
 *   "normal" with a null progressPercent.
 */
function categoryProgress(plannedMinor, actualMinor) {
  if (plannedMinor === 0) {
    return {
      progressPercent: null,
      state: actualMinor > 0 ? "unplanned" : "normal",
    };
  }
  const progressPercent = Math.round((actualMinor / plannedMinor) * 100);
  return {
    progressPercent,
    state: actualMinor > plannedMinor ? "overspent" : "normal",
  };
}

/**
 * Builds the budget read model (the inner `budget` object of the
 * `GET /budget` and `GET /months/:month` responses) from the stored single
 * budget row and a map of per-category actual spending. CR-001: the budget
 * itself has no month — callers wanting a month read model use
 * `monthReadModel` below.
 *
 * @param budgetRow  { id, currencyCode, incomeMinor, categories:
 *                     [{ id, name, icon, color, displayOrder, plannedMinor }] }
 * @param actualsByCategory  { [categoryId]: integer minor units }
 */
export function summarizeBudget(budgetRow, actualsByCategory = {}) {
  const categories = [...budgetRow.categories]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((category) => {
      const actualMinor = actualsByCategory[category.id] ?? 0;
      const { progressPercent, state } = categoryProgress(
        category.plannedMinor,
        actualMinor,
      );
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        displayOrder: category.displayOrder,
        plannedMinor: category.plannedMinor,
        actualMinor,
        progressPercent,
        state,
      };
    });

  const plannedMinor = categories.reduce(
    (sum, category) => sum + category.plannedMinor,
    0,
  );
  const actualMinor = categories.reduce((sum, category) => sum + category.actualMinor, 0);

  return {
    id: budgetRow.id,
    currencyCode: budgetRow.currencyCode,
    incomeMinor: budgetRow.incomeMinor,
    plannedMinor,
    availableMinor: budgetRow.incomeMinor - plannedMinor,
    actualMinor,
    categories,
  };
}

/**
 * Month read model (`GET /months/:month`): the single budget's plans plus
 * the requested month's actuals. Identical plans for every month; only the
 * actuals (and derived progress) differ (CR-001 item 1).
 */
export function monthReadModel(budgetRow, month, actualsByCategory = {}) {
  assertMonth(month);
  return { month, ...summarizeBudget(budgetRow, actualsByCategory) };
}

/**
 * Plans-only budget model (`GET /budget`): the single budget with computed
 * `plannedMinor`/`availableMinor` and NO actuals — actuals belong to a
 * month read model, never to the month-independent budget (CR1-2).
 */
export function budgetPlanModel(budgetRow) {
  const categories = [...budgetRow.categories]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(({ id, name, icon, color, displayOrder, plannedMinor }) => ({
      id,
      name,
      icon,
      color,
      displayOrder,
      plannedMinor,
    }));
  const plannedMinor = categories.reduce(
    (sum, category) => sum + category.plannedMinor,
    0,
  );
  return {
    id: budgetRow.id,
    currencyCode: budgetRow.currencyCode,
    incomeMinor: budgetRow.incomeMinor,
    plannedMinor,
    availableMinor: budgetRow.incomeMinor - plannedMinor,
    categories,
  };
}

/**
 * Integer percentage shares that always sum to exactly 100, via the
 * largest-remainder method (documented rounding rule, decision #10).
 * An all-zero input returns all-zero shares (there is nothing to share).
 */
export function largestRemainderShares(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return values.map(() => 0);
  }
  const exact = values.map((value) => (value / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    // Largest remainder first; ties broken by lower index for determinism.
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const shares = [...floors];
  for (let i = 0; i < byRemainder.length && remaining > 0; i += 1) {
    shares[byRemainder[i].index] += 1;
    remaining -= 1;
  }
  return shares;
}
