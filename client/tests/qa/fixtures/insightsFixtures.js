// QA-owned client fixtures for GET /api/v1/insights/:month
// (`{ insights: {...} }` shape). Numbers are picked independently of
// client/src so a hard-coded chart/legend value shows up as a mismatch.

const CATEGORY_META = [
  { id: "housing", label: "Housing", color: "blue" },
  { id: "groceries", label: "Groceries", color: "green" },
  { id: "transport", label: "Transport", color: "yellow" },
  { id: "fun", label: "Fun", color: "coral" },
  { id: "savings", label: "Savings", color: "blue" },
];

/** Kit reference numbers (roadmap §2.2 / docs/api.md): current total
 * 8,420 (842,000 minor), previous 9,180 (918,000 minor), shares
 * [47,18,10,11,14] (sum 100). */
export function kitInsights(overrides = {}) {
  const current = [395700, 151600, 84200, 92600, 117900];
  const previous = [430000, 170000, 90000, 100000, 128000];
  const shares = [47, 18, 10, 11, 14];
  return {
    insights: {
      month: "2026-07",
      monthLabel: "July",
      previousMonth: "2026-06",
      previousMonthLabel: "June",
      hasPrevious: true,
      currentTotalMinor: 842000,
      previousTotalMinor: 918000,
      categories: CATEGORY_META.map((meta, index) => ({
        ...meta,
        currentMinor: current[index],
        previousMinor: previous[index],
        sharePercent: shares[index],
      })),
      cashFlow: {
        labels: ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
        currentCumulativeMinor: [60000, 180000, 310000, 460000, 590000, 730000, 842000],
        previousCumulativeMinor: [80000, 210000, 350000, 500000, 650000, 790000, 918000],
      },
      ...overrides,
    },
  };
}

/** Every number differs from the kit fixture (QA-CC-61, D-INS-F1). */
export function variantInsights() {
  const current = [50000, 120000, 30000, 15000, 5000];
  const shares = [23, 55, 14, 7, 2];
  return {
    insights: {
      month: "2026-11",
      monthLabel: "November",
      previousMonth: "2026-10",
      previousMonthLabel: "October",
      hasPrevious: true,
      currentTotalMinor: 220000,
      previousTotalMinor: 260000,
      categories: CATEGORY_META.map((meta, index) => ({
        ...meta,
        currentMinor: current[index],
        previousMinor: [60000, 130000, 40000, 20000, 10000][index],
        sharePercent: shares[index],
      })),
      cashFlow: {
        labels: ["Nov 1", "Nov 6", "Nov 11", "Nov 16", "Nov 21", "Nov 26", "Nov 30"],
        currentCumulativeMinor: [10000, 40000, 90000, 140000, 180000, 205000, 220000],
        previousCumulativeMinor: [20000, 60000, 110000, 160000, 210000, 245000, 260000],
      },
    },
  };
}

/** No budget existed for the previous month — an explicit no-comparison
 * state, never a fake zero (QA-CC-64, D-INS-F5). */
export function noPreviousInsights() {
  const current = [395700, 151600, 84200, 92600, 117900];
  const shares = [47, 18, 10, 11, 14];
  return {
    insights: {
      month: "2026-07",
      monthLabel: "July",
      previousMonth: "2026-06",
      previousMonthLabel: "June",
      hasPrevious: false,
      currentTotalMinor: 842000,
      previousTotalMinor: null,
      categories: CATEGORY_META.map((meta, index) => ({
        ...meta,
        currentMinor: current[index],
        previousMinor: null,
        sharePercent: shares[index],
      })),
      cashFlow: {
        labels: ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
        currentCumulativeMinor: [60000, 180000, 310000, 460000, 590000, 730000, 842000],
        previousCumulativeMinor: [],
      },
    },
  };
}

/** A month with zero recorded spending (QA-CC-65). */
export function zeroSpendingInsights() {
  return {
    insights: {
      month: "2026-07",
      monthLabel: "July",
      previousMonth: "2026-06",
      previousMonthLabel: "June",
      hasPrevious: true,
      currentTotalMinor: 0,
      previousTotalMinor: 918000,
      categories: CATEGORY_META.map((meta) => ({
        ...meta,
        currentMinor: 0,
        previousMinor: 100000,
        sharePercent: 0,
      })),
      cashFlow: {
        labels: ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
        currentCumulativeMinor: [0, 0, 0, 0, 0, 0, 0],
        previousCumulativeMinor: [80000, 210000, 350000, 500000, 650000, 790000, 918000],
      },
    },
  };
}
