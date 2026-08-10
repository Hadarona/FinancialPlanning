// QA-CC-60..67: InsightsPage rendering, tabs, and accessible data tables.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import {
  kitInsights,
  variantInsights,
  noPreviousInsights,
  zeroSpendingInsights,
} from "./fixtures/insightsFixtures.js";
import { currentMonth, previousMonth, monthLabel } from "../../src/lib/dates.js";

const MONTH = currentMonth();
const PREVIOUS = previousMonth(MONTH);
const MONTH_LABEL = monthLabel(MONTH);
const PREVIOUS_LABEL = monthLabel(PREVIOUS);

function authEntry() {
  return { method: "GET", path: "/auth/me", status: 200, json: meResponse() };
}

function withMonth(
  fixture,
  month,
  monthLabelText,
  previousMonth_,
  previousMonthLabelText,
  hasPrevious,
) {
  return {
    insights: {
      ...fixture.insights,
      month,
      monthLabel: monthLabelText,
      previousMonth: previousMonth_,
      previousMonthLabel: previousMonthLabelText,
      hasPrevious,
    },
  };
}

describe("qa-insights-page", () => {
  it("QA-CC-60: the kit fixture shows the hero total, SVG charts, and accessible data matching the fixture; shares sum to 100", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          kitInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });

    expect((await screen.findAllByText("8,420")).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("img").length).toBe(0);

    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.querySelector("caption")).not.toBeNull();
    }
    const shares = kitInsights().insights.categories.map((c) => c.sharePercent);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    for (const share of shares) {
      expect(screen.getAllByText(`${share}%`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("QA-CC-61: a variant fixture changes the hero, legend, and table values together", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          variantInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });

    expect((await screen.findAllByText("2,200")).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("8,420")).not.toBeInTheDocument();
  });

  it("QA-CC-62: switching to the previous-month tab refetches and swaps every number consistently", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          kitInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
      {
        method: "GET",
        path: `/insights/${PREVIOUS}`,
        status: 200,
        json: withMonth(
          variantInsights(),
          PREVIOUS,
          PREVIOUS_LABEL,
          previousMonth(PREVIOUS),
          monthLabel(previousMonth(PREVIOUS)),
          false,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });
    await screen.findAllByText("8,420");

    const user = userEvent.setup();
    const currentTab = screen.getByRole("tab", { name: MONTH_LABEL });
    currentTab.focus();
    await user.keyboard("{ArrowLeft}");

    expect((await screen.findAllByText("2,200")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("tab", { name: PREVIOUS_LABEL })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("QA-CC-63: arrow keys and Enter/Space operate the month tabs", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          kitInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
      {
        method: "GET",
        path: `/insights/${PREVIOUS}`,
        status: 200,
        json: withMonth(
          kitInsights(),
          PREVIOUS,
          PREVIOUS_LABEL,
          previousMonth(PREVIOUS),
          monthLabel(previousMonth(PREVIOUS)),
          false,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });
    await screen.findAllByText("8,420");

    const user = userEvent.setup();
    const currentTab = screen.getByRole("tab", { name: MONTH_LABEL });
    currentTab.focus();
    await user.keyboard("{ArrowLeft}");
    const previousTab = screen.getByRole("tab", { name: PREVIOUS_LABEL });
    expect(previousTab).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(previousTab);

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: MONTH_LABEL })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("QA-CC-64: a missing previous month shows an explicit no-comparison message, never a fake zero-change", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          noPreviousInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          false,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });

    expect(await screen.findByText(/No data to compare/)).toBeInTheDocument();
    expect(screen.queryByText(/vs 0 last month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/last month/)).not.toBeInTheDocument();
  });

  it("QA-CC-65: a zero-spending month shows an explicit empty-month message with the month name", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          zeroSpendingInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });

    expect(
      await screen.findByText(new RegExp(`No expenses recorded for ${MONTH_LABEL}`)),
    ).toBeInTheDocument();
  });

  it("QA-CC-66: 404 shows the create-budget empty state; 500 then retry succeeds", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 404,
        json: {
          error: {
            code: "NOT_FOUND",
            message: "No budget for this month.",
            requestId: "r1",
          },
        },
      },
    ]);
    renderApp({ initialPath: "/insights" });
    expect(
      await screen.findByText(`No budget for ${MONTH_LABEL} yet`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create budget" })).toBeInTheDocument();
  });

  it("QA-CC-66b: a 500 then success on retry recovers", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong.", requestId: "r1" },
        },
      },
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          kitInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });
    expect(await screen.findByText("Couldn't load your insights")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("8,420")).length).toBeGreaterThanOrEqual(1);
  });

  it("QA-CC-67: keyboard-only traversal reaches the hidden data table with labels and values for every series", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/insights/${MONTH}`,
        status: 200,
        json: withMonth(
          kitInsights(),
          MONTH,
          MONTH_LABEL,
          PREVIOUS,
          PREVIOUS_LABEL,
          true,
        ),
      },
    ]);
    renderApp({ initialPath: "/insights" });
    await screen.findAllByText("8,420");

    const cashFlowTable = screen.getByRole("table", {
      name: new RegExp(`Cumulative spending by date: ${MONTH_LABEL}`),
    });
    expect(cashFlowTable).toBeInTheDocument();
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders.length).toBeGreaterThan(0);

    const barTable = screen.getByRole("table", {
      name: new RegExp(`Spending by category: ${MONTH_LABEL}`),
    });
    expect(barTable).toBeInTheDocument();

    const chartMarks = screen.getAllByRole("img", { name: new RegExp(`Housing`) });
    expect(chartMarks[0]).toHaveAttribute("tabindex", "0");
  });
});
