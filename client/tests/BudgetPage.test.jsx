import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetPage } from "../src/features/budget/BudgetPage.jsx";
import { renderProviders } from "./testUtils.jsx";
import { apiClient, ApiError } from "../src/api/client.js";
import { currentMonth, monthLabel } from "../src/lib/dates.js";

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

/** Kit-numbers fixture as returned by GET /budgets/:month. */
function budgetFixture(overrides = {}) {
  return {
    budget: {
      id: "budget-1",
      month: currentMonth(),
      currencyCode: "USD",
      incomeMinor: 1250000,
      plannedMinor: 1020000,
      availableMinor: 230000,
      actualMinor: 252000,
      categories: [
        { id: "housing", name: "Housing", icon: "House", color: "blue", displayOrder: 1, plannedMinor: 400000, actualMinor: 252000, progressPercent: 63, state: "normal" },
        { id: "groceries", name: "Groceries", icon: "ShoppingCart", color: "green", displayOrder: 2, plannedMinor: 150000, actualMinor: 51000, progressPercent: 34, state: "normal" },
        { id: "transport", name: "Transport", icon: "CarFront", color: "yellow", displayOrder: 3, plannedMinor: 80000, actualMinor: 20800, progressPercent: 26, state: "normal" },
        { id: "fun", name: "Fun", icon: "PartyPopper", color: "coral", displayOrder: 4, plannedMinor: 90000, actualMinor: 25200, progressPercent: 28, state: "normal" },
        { id: "savings", name: "Savings", icon: "PiggyBank", color: "blue", displayOrder: 5, plannedMinor: 300000, actualMinor: 168000, progressPercent: 56, state: "normal" },
      ],
      ...overrides,
    },
  };
}

function mockApi({ budget, transactions } = {}) {
  apiClient.get.mockImplementation((path) => {
    if (path === "/auth/me") {
      return Promise.resolve(USER);
    }
    if (path.includes("/transactions")) {
      return Promise.resolve(
        transactions ?? { transactions: [], total: 0, limit: 50, offset: 0 },
      );
    }
    if (path.startsWith("/budgets/")) {
      return typeof budget === "function" ? budget() : budget;
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

beforeEach(() => {
  apiClient.get.mockReset();
});

describe("BudgetPage", () => {
  it("shows a loading skeleton while the budget is pending", async () => {
    mockApi({ budget: () => new Promise(() => {}) });
    render(renderProviders(<BudgetPage />));
    expect(await screen.findByLabelText("Loading budget")).toBeInTheDocument();
  });

  it("renders the kit fixture: 12,500 income / 10,200 planned / 2,300 available (D-BUD-F2)", async () => {
    mockApi({ budget: () => Promise.resolve(budgetFixture()) });
    render(renderProviders(<BudgetPage />));

    expect(await screen.findByText("12,500")).toBeInTheDocument();
    expect(screen.getByText("10,200")).toBeInTheDocument();
    expect(screen.getByText("2,300")).toBeInTheDocument();
    // All five categories with their planned amounts.
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("4,000")).toBeInTheDocument();
    expect(screen.getByText("3,000")).toBeInTheDocument();
  });

  it("exposes screen-reader progress text per category (D-BUD-F6)", async () => {
    mockApi({ budget: () => Promise.resolve(budgetFixture()) });
    render(renderProviders(<BudgetPage />));

    const housing = await screen.findByRole("progressbar", {
      name: "Housing: 2,520 spent of 4,000 planned, 63%",
    });
    expect(housing).toHaveAttribute("aria-valuenow", "63");
  });

  it("marks an overspent category with text, not color alone (D-BUD-D3)", async () => {
    const fixture = budgetFixture();
    fixture.budget.categories[2] = {
      ...fixture.budget.categories[2],
      actualMinor: 92000,
      progressPercent: 115,
      state: "overspent",
    };
    mockApi({ budget: () => Promise.resolve(fixture) });
    render(renderProviders(<BudgetPage />));

    expect(await screen.findByText("over plan")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Transport: 920 spent of 800 planned, 115%, over plan",
      }),
    ).toBeInTheDocument();
  });

  it("shows the Create budget empty state when no budget exists (D-BUD-F4)", async () => {
    mockApi({
      budget: () =>
        Promise.reject(
          new ApiError({ code: "NOT_FOUND", status: 404, message: "No budget for this month." }),
        ),
    });
    render(renderProviders(<BudgetPage />));

    expect(
      await screen.findByText(`No budget for ${monthLabel(currentMonth())} yet`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create budget" })).toBeInTheDocument();
  });

  it("keeps the authenticated shell and offers retry on failure (D-BUD-F5)", async () => {
    let calls = 0;
    mockApi({
      budget: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(
            new ApiError({ code: "INTERNAL", status: 500, message: "Something went wrong." }),
          );
        }
        return Promise.resolve(budgetFixture());
      },
    });
    render(renderProviders(<BudgetPage />));

    expect(await screen.findByText("Couldn't load your budget")).toBeInTheDocument();
    // Shell (header with page title) is still present.
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("12,500")).toBeInTheDocument();
  });
});
