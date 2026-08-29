// QA-CC-60..63: current multi-month InsightsPage behavior.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import { currentMonth, previousMonth, monthYearLabel, shortDateLabel } from "../../src/lib/dates.js";

const MONTH = currentMonth();
const PREVIOUS = previousMonth(MONTH);
const MONTH_YEAR = monthYearLabel(MONTH);
const PREVIOUS_YEAR = monthYearLabel(PREVIOUS);
const categories = [
  ["housing", "Housing", "blue", 323600],
  ["groceries", "Groceries", "green", 136600],
  ["transport", "Transport", "yellow", 84200],
  ["fun", "Fun", "coral", 92600],
  ["savings", "Savings", "blue", 117900],
  ["subscriptions", "Subscriptions", "coral", 15000],
  ["utilities", "Utilities", "green", 72100],
];

function authEntry() {
  return { method: "GET", path: "/auth/me", status: 200, json: meResponse() };
}

function insightsFixture(months) {
  const totalsByMonth = months.map((month, monthIndex) =>
    categories.map(([, , , total]) => (monthIndex === 0 ? total : Math.round(total * 1.09))),
  );
  const combinedByCategory = categories.map((_, index) =>
    totalsByMonth.reduce((sum, values) => sum + values[index], 0),
  );
  const combinedTotalMinor = combinedByCategory.reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  const shares = combinedByCategory.map((value, index) => {
    if (index === combinedByCategory.length - 1) return 100 - assigned;
    const share = Math.floor((value / combinedTotalMinor) * 100);
    assigned += share;
    return share;
  });

  return {
    insights: {
      months: months.map((month, index) => {
        const totalMinor = totalsByMonth[index].reduce((sum, value) => sum + value, 0);
        const step = Math.floor(totalMinor / 7);
        const cumulativeMinor = Array.from({ length: 7 }, (_, point) => step * (point + 1));
        cumulativeMinor[6] = totalMinor;
        return {
          month,
          label: monthYearLabel(month),
          yearLabel: monthYearLabel(month),
          totalMinor,
          cashFlow: {
            labels: [1, 6, 11, 16, 21, 26, 28].map((day) =>
              shortDateLabel(`${month}-${String(day).padStart(2, "0")}`),
            ),
            cumulativeMinor,
          },
        };
      }),
      categories: categories.map(([id, label, color], index) => ({
        id,
        label,
        color,
        totalsMinor: totalsByMonth.map((values) => values[index]),
        combinedMinor: combinedByCategory[index],
        sharePercent: shares[index],
      })),
      combinedTotalMinor,
    },
  };
}

describe("qa-insights-page", () => {
  it("QA-CC-60: the default current-month selection fetches the multi-month endpoint and renders all seven categories", async () => {
    installFetchMock([
      authEntry(),
      { method: "GET", path: `/insights?months=${MONTH}`, status: 200, json: insightsFixture([MONTH]) },
    ]);
    renderApp({ initialPath: "/insights" });

    expect(await screen.findByText(`Total spent in ${MONTH_YEAR}`)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: `Spending by category: ${MONTH_YEAR}` });
    for (const [, label] of categories) {
      expect(within(table).getByRole("rowheader", { name: label })).toBeInTheDocument();
    }
  });

  it("QA-CC-61: adding a second month updates the URL-backed query and renders both series", async () => {
    installFetchMock([
      authEntry(),
      { method: "GET", path: `/insights?months=${MONTH}`, status: 200, json: insightsFixture([MONTH]) },
      {
        method: "GET",
        path: `/insights?months=${MONTH},${PREVIOUS}`,
        status: 200,
        json: insightsFixture([MONTH, PREVIOUS]),
      },
    ]);
    const user = userEvent.setup();
    renderApp({ initialPath: "/insights" });

    await screen.findByText(`Total spent in ${MONTH_YEAR}`);
    await user.click(screen.getByRole("button", { name: /Months to compare/ }));
    await user.click(screen.getByRole("option", { name: PREVIOUS_YEAR }));

    expect(await screen.findByText(`Total spent in ${PREVIOUS_YEAR}`)).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: `Spending by category: ${MONTH_YEAR}, ${PREVIOUS_YEAR}`,
      }),
    ).toBeInTheDocument();
  });

  it("QA-CC-62: the no-budget recovery POSTs /budget, then refetches insights", async () => {
    const mock = installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights?months=${MONTH}`,
        status: 404,
        json: { error: { code: "NOT_FOUND", message: "No budget yet.", requestId: "r1" } },
      },
      { method: "POST", path: "/budget", status: 201, json: { budget: {} } },
      { method: "GET", path: `/insights?months=${MONTH}`, status: 200, json: insightsFixture([MONTH]) },
    ]);
    const user = userEvent.setup();
    renderApp({ initialPath: "/insights" });

    await user.click(await screen.findByRole("button", { name: "Set up your budget" }));
    await waitFor(() => expect(mock.callsMatching("POST", "/budget")).toHaveLength(1));
    expect(await screen.findByText(`Total spent in ${MONTH_YEAR}`)).toBeInTheDocument();
  });

  it("QA-CC-63: combined donut shares are whole percentages summing to 100", async () => {
    installFetchMock([
      authEntry(),
      { method: "GET", path: `/insights?months=${MONTH}`, status: 200, json: insightsFixture([MONTH]) },
    ]);
    renderApp({ initialPath: "/insights" });

    await screen.findByText(`Total spent in ${MONTH_YEAR}`);
    const donutTable = screen.getByRole("table", {
      name: `Share of spending by category across ${MONTH_YEAR}`,
    });
    const total = within(donutTable)
      .getAllByRole("cell")
      .map((cell) => cell.textContent)
      .filter((value) => value.endsWith("%"))
      .reduce((sum, value) => sum + Number(value.slice(0, -1)), 0);
    expect(total).toBe(100);
  });
});
