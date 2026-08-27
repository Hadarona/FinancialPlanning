import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsightsPage } from "../src/features/insights/InsightsPage.jsx";
import { renderProviders } from "./testUtils.jsx";
import { apiClient, ApiError } from "../src/api/client.js";
import {
  currentMonth,
  previousMonth,
  monthLabel,
  monthYearLabel,
  shortDateLabel,
} from "../src/lib/dates.js";

vi.mock("../src/api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const USER = { user: { id: "user-1", email: "a@b.com" } };

const BASE = currentMonth();
const PREVIOUS = previousMonth(BASE);
const THIRD = previousMonth(PREVIOUS);
const BASE_YEAR_LABEL = monthYearLabel(BASE);
const PREVIOUS_YEAR_LABEL = monthYearLabel(PREVIOUS);

const CATEGORY_META = [
  { id: "housing", label: "Housing", color: "blue" },
  { id: "groceries", label: "Groceries", color: "green" },
  { id: "transport", label: "Transport", color: "yellow" },
  { id: "fun", label: "Fun", color: "coral" },
  { id: "savings", label: "Savings", color: "blue" },
  { id: "subscriptions", label: "Subscriptions", color: "coral" },
  { id: "utilities", label: "Utilities", color: "green" },
];

/** CR-001 demo totals (minor units, sum 842,000 / 918,000 / 0). */
const TOTALS_BY_MONTH = {
  [BASE]: [323600, 136600, 84200, 92600, 117900, 15000, 72100],
  [PREVIOUS]: [350000, 155000, 90000, 100000, 128000, 15000, 80000],
  [THIRD]: [0, 0, 0, 0, 0, 0, 0],
};

function cumulativeFor(total) {
  // A simple monotone 7-point series ending at the month total.
  if (total === 0) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  const step = Math.floor(total / 7);
  const series = Array.from({ length: 7 }, (_, i) => step * (i + 1));
  series[6] = total;
  return series;
}

function sampleLabels(month) {
  return [1, 6, 11, 16, 21, 26, 28].map((day) =>
    shortDateLabel(`${month}-${String(day).padStart(2, "0")}`),
  );
}

/** Builds the CR3 multi-month insights response for the given months
 * (newest first), mirroring the server shape. */
function insightsFixture(months) {
  const totals = months.map((month) =>
    TOTALS_BY_MONTH[month].reduce((sum, value) => sum + value, 0),
  );
  const combined = CATEGORY_META.map((_, index) =>
    months.reduce((sum, month) => sum + TOTALS_BY_MONTH[month][index], 0),
  );
  const combinedTotal = combined.reduce((sum, value) => sum + value, 0);
  // Simplified integer shares for fixtures (largest-remainder on the server).
  let remaining = 100;
  const shares = combined.map((value, index) => {
    if (combinedTotal === 0) {
      return 0;
    }
    if (index === combined.length - 1) {
      return remaining;
    }
    const share = Math.floor((value / combinedTotal) * 100);
    remaining -= share;
    return share;
  });

  return {
    insights: {
      months: months.map((month, index) => ({
        month,
        label: monthLabel(month),
        yearLabel: monthYearLabel(month),
        totalMinor: totals[index],
        cashFlow: {
          labels: sampleLabels(month),
          cumulativeMinor: cumulativeFor(totals[index]),
        },
      })),
      categories: CATEGORY_META.map((meta, index) => ({
        ...meta,
        totalsMinor: months.map((month) => TOTALS_BY_MONTH[month][index]),
        combinedMinor: combined[index],
        sharePercent: shares[index],
      })),
      combinedTotalMinor: combinedTotal,
    },
  };
}

function mockApi(handler) {
  apiClient.get.mockImplementation((path) => {
    if (path === "/auth/me") {
      return Promise.resolve(USER);
    }
    const match = path.match(/^\/insights\?months=(.+)$/);
    if (match) {
      return handler(decodeURIComponent(match[1]).split(","));
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
});

describe("InsightsPage (CR-001 multi-month comparison)", () => {
  it("defaults to the current calendar month with a single series (CR3-1)", async () => {
    mockApi((months) => Promise.resolve(insightsFixture(months)));
    render(renderProviders(<InsightsPage />));

    expect(
      await screen.findByText(`Total spent in ${BASE_YEAR_LABEL}`),
    ).toBeInTheDocument();
    expect(screen.getAllByText("8,420").length).toBeGreaterThanOrEqual(1);
    expect(apiClient.get).toHaveBeenCalledWith(`/insights?months=${BASE}`);
    // No second month anywhere.
    expect(screen.queryByText(`Total spent in ${PREVIOUS_YEAR_LABEL}`)).toBeNull();

    // Every chart carries an accessible data-derived text summary.
    expect(
      screen.getByText(new RegExp(`Spending by category across ${BASE_YEAR_LABEL}:`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Spending shares across ${BASE_YEAR_LABEL}:`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`Cumulative spending: 8,420 through ${BASE_YEAR_LABEL}`),
      ),
    ).toBeInTheDocument();
    // The trigger summarizes the single selection.
    expect(screen.getByRole("button", { name: /Months to compare/ })).toHaveTextContent(
      BASE_YEAR_LABEL,
    );
  });

  it("renders all seven categories in the charts, including the CR2 additions", async () => {
    mockApi((months) => Promise.resolve(insightsFixture(months)));
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    const barTable = screen.getByRole("table", {
      name: `Spending by category: ${BASE_YEAR_LABEL}`,
    });
    for (const meta of CATEGORY_META) {
      expect(
        within(barTable).getByRole("rowheader", { name: meta.label }),
      ).toBeInTheDocument();
    }
    expect(within(barTable).getByRole("cell", { name: "150" })).toBeInTheDocument();
    expect(within(barTable).getByRole("cell", { name: "721" })).toBeInTheDocument();
  });

  it("selecting more months drives the query and renders one hero total per month (CR3-2/4)", async () => {
    mockApi((months) => Promise.resolve(insightsFixture(months)));
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Months to compare/ }));
    await user.click(
      screen.getByRole("option", { name: new RegExp(PREVIOUS_YEAR_LABEL) }),
    );

    expect(
      await screen.findByText(`Total spent in ${PREVIOUS_YEAR_LABEL}`),
    ).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(`/insights?months=${BASE},${PREVIOUS}`);
    expect(screen.getAllByText("9,180").length).toBeGreaterThanOrEqual(1);
    // Hidden tables gain one value column per selected month.
    const barTable = screen.getByRole("table", {
      name: `Spending by category: ${BASE_YEAR_LABEL}, ${PREVIOUS_YEAR_LABEL}`,
    });
    expect(
      within(barTable).getByRole("columnheader", { name: PREVIOUS_YEAR_LABEL }),
    ).toBeInTheDocument();
    // Legends identify both series explicitly.
    expect(screen.getAllByText(PREVIOUS_YEAR_LABEL).length).toBeGreaterThanOrEqual(2);
  });

  it("shows donut percentages summing to 100 for the combined selection", async () => {
    mockApi((months) => Promise.resolve(insightsFixture(months)));
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    const donutTable = screen.getByRole("table", {
      name: `Share of spending by category across ${BASE_YEAR_LABEL}`,
    });
    const shareCells = within(donutTable)
      .getAllByRole("cell")
      .map((cell) => cell.textContent)
      .filter((text) => text.endsWith("%"));
    const total = shareCells.reduce((sum, text) => sum + Number(text.slice(0, -1)), 0);
    expect(total).toBe(100);
  });

  it("keeps hidden chart tables out of the layout width (DEV-SELFTEST-001 regression guard)", async () => {
    mockApi((months) => Promise.resolve(insightsFixture(months)));
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(3);
    for (const table of tables) {
      expect(table.classList.contains("visually-hidden")).toBe(false);
      const wrapper = table.closest(".visually-hidden");
      expect(wrapper).not.toBeNull();
      expect(wrapper.tagName).toBe("DIV");
      expect(table.querySelector("caption")).not.toBeNull();
      expect(table.querySelectorAll("th[scope='col']").length).toBeGreaterThan(0);
      expect(table.querySelectorAll("th[scope='row']").length).toBeGreaterThan(0);
    }
  });

  it("renders a zero month as honest zeros, never an error (CR3-7)", async () => {
    mockApi(() => Promise.resolve(insightsFixture([THIRD])));
    render(renderProviders(<InsightsPage />));

    expect(
      await screen.findByText(`Total spent in ${monthYearLabel(THIRD)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`No expenses recorded for ${monthYearLabel(THIRD)}`)),
    ).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your insights")).toBeNull();
  });

  it("recovers from the defensive no-budget 404 by POSTing /budget (CR1-11)", async () => {
    let hasBudget = false;
    mockApi((months) =>
      hasBudget
        ? Promise.resolve(insightsFixture(months))
        : Promise.reject(
            new ApiError({ code: "NOT_FOUND", status: 404, message: "No budget yet." }),
          ),
    );
    apiClient.post.mockImplementation(() => {
      hasBudget = true;
      return Promise.resolve({ budget: {} });
    });
    render(renderProviders(<InsightsPage />));
    const user = userEvent.setup();

    expect(await screen.findByText("No budget yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set up your budget" }));

    expect(apiClient.post).toHaveBeenCalledWith("/budget");
    expect(await screen.findAllByText("8,420")).not.toHaveLength(0);
  });

  it("keeps the shell and offers retry on failure", async () => {
    let calls = 0;
    mockApi((months) => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject(
          new ApiError({
            code: "INTERNAL",
            status: 500,
            message: "Something went wrong.",
          }),
        );
      }
      return Promise.resolve(insightsFixture(months));
    });
    render(renderProviders(<InsightsPage />));

    expect(await screen.findByText("Couldn't load your insights")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spending insights" }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("8,420")).length).toBeGreaterThanOrEqual(1);
  });
});
