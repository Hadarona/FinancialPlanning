// QA-CC-20..28: BudgetPage rendering, states, and month navigation.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import {
  kitBudget,
  variantBudget,
  overspentBudget,
  unplannedBudget,
  kitTransactions,
  emptyTransactions,
} from "./fixtures/budgetFixtures.js";
import { currentMonth, previousMonth, nextMonth } from "../../src/lib/dates.js";

const MONTH = currentMonth();

function authenticatedEntry() {
  return { method: "GET", path: "/auth/me", status: 200, json: meResponse() };
}

describe("qa-budget-page", () => {
  it("QA-CC-20: the kit fixture renders the summary totals and five category rows", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(await screen.findByText("12,500")).toBeInTheDocument();
    expect(screen.getByText("10,200")).toBeInTheDocument();
    expect(screen.getByText("2,300")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
    for (const name of ["Housing", "Groceries", "Transport", "Fun", "Savings"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("QA-CC-21: re-rendering with a variant fixture replaces every number (no hard-coded totals)", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: variantBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: emptyTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(await screen.findByText("20,000")).toBeInTheDocument();
    expect(screen.queryByText("12,500")).not.toBeInTheDocument();
    expect(screen.queryByText("10,200")).not.toBeInTheDocument();
    expect(screen.queryByText("2,300")).not.toBeInTheDocument();
  });

  it("QA-CC-22: progress is actual/planned, never planned/income (63%, never 32%)", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });

    await screen.findByText("12,500");
    // The percent lives in the progress track's accessible name
    // (ProgressBar renders it via aria-label, not visible text).
    expect(screen.getByRole("progressbar", { name: /63%/ })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /32%/ })).not.toBeInTheDocument();
  });

  it("QA-CC-23: overspent and unplanned rows are flagged as text, not color alone", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: overspentBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: emptyTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });
    await screen.findByText("12,500");
    expect(screen.getByText("over plan")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /133%/ })).toBeInTheDocument();
  });

  it("QA-CC-23b: an unplanned category is flagged as text", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: unplannedBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: emptyTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });
    await screen.findByText("12,500");
    expect(screen.getByText("unplanned spending")).toBeInTheDocument();
  });

  it("QA-CC-24: the screen-reader progress sentence matches exactly", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });
    await screen.findByText("12,500");
    expect(
      screen.getByRole("progressbar", {
        name: "Housing: 2,520 spent of 4,000 planned, 63%",
      }),
    ).toBeInTheDocument();
  });

  it("QA-CC-25: a delayed budget response shows a busy loading state before data", async () => {
    installFetchMock([
      authenticatedEntry(),
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: kitBudget(),
        delayMs: 40,
      },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(await screen.findByLabelText("Loading budget")).toBeInTheDocument();
    expect(await screen.findByText("12,500")).toBeInTheDocument();
  });

  it("QA-CC-26: a 404 budget response shows the create-budget empty state", async () => {
    installFetchMock([
      authenticatedEntry(),
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
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
    renderApp({ initialPath: "/budget" });

    expect(await screen.findByText(/No budget for .* yet/)).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: "Create budget" });
    const user = userEvent.setup();
    await user.click(createButton);
    expect(
      await screen.findByRole("heading", { name: "Create budget" }),
    ).toBeInTheDocument();
  });

  it("QA-CC-27: a 500 then success on retry keeps the shell mounted and renders data", async () => {
    installFetchMock([
      authenticatedEntry(),
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong.", requestId: "r1" },
        },
      },
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(await screen.findByText("Couldn't load your budget")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("12,500")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
  });

  it("QA-CC-28: prev/next month navigation computes the adjacent month; a garbage ?month falls back to current", async () => {
    const prev = previousMonth(MONTH);
    const next = nextMonth(MONTH);
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
      { method: "GET", path: `/budgets/${prev}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${prev}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
      { method: "GET", path: `/budgets/${next}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${next}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    const { router } = renderApp({ initialPath: "/budget" });
    const user = userEvent.setup();
    await screen.findByText("12,500");

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => {
      expect(router.state.location.pathname + router.state.location.search).toBe(
        `/budget?month=${prev}`,
      );
    });

    await user.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => {
      expect(router.state.location.pathname + router.state.location.search).toBe(
        `/budget?month=${MONTH}`,
      );
    });
  });

  it("QA-CC-28b: a garbage ?month query falls back to the current month without crashing", async () => {
    installFetchMock([
      authenticatedEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget?month=garbage" });
    expect(await screen.findByText("12,500")).toBeInTheDocument();
  });
});
