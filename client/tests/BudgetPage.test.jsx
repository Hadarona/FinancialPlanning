import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetPage } from "../src/features/budget/BudgetPage.jsx";
import { renderProviders } from "./testUtils.jsx";
import { apiClient, ApiError } from "../src/api/client.js";
import { currentMonth, previousMonth } from "../src/lib/dates.js";

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

/** CR-001 month read model as returned by GET /months/:month (seven fixed
 * categories; income 12,500 / planned 12,000 / available 500). */
function monthFixture(overrides = {}) {
  return {
    budget: {
      id: "budget-1",
      month: currentMonth(),
      currencyCode: "USD",
      incomeMinor: 1250000,
      plannedMinor: 1200000,
      availableMinor: 50000,
      actualMinor: 252000,
      categories: [
        {
          id: "housing",
          name: "Housing",
          icon: "House",
          color: "blue",
          displayOrder: 1,
          plannedMinor: 400000,
          actualMinor: 252000,
          progressPercent: 63,
          state: "normal",
        },
        {
          id: "groceries",
          name: "Groceries",
          icon: "ShoppingCart",
          color: "green",
          displayOrder: 2,
          plannedMinor: 150000,
          actualMinor: 51000,
          progressPercent: 34,
          state: "normal",
        },
        {
          id: "transport",
          name: "Transport",
          icon: "CarFront",
          color: "yellow",
          displayOrder: 3,
          plannedMinor: 80000,
          actualMinor: 20800,
          progressPercent: 26,
          state: "normal",
        },
        {
          id: "fun",
          name: "Fun",
          icon: "PartyPopper",
          color: "coral",
          displayOrder: 4,
          plannedMinor: 90000,
          actualMinor: 25200,
          progressPercent: 28,
          state: "normal",
        },
        {
          id: "savings",
          name: "Savings",
          icon: "PiggyBank",
          color: "blue",
          displayOrder: 5,
          plannedMinor: 300000,
          actualMinor: 168000,
          progressPercent: 56,
          state: "normal",
        },
        {
          id: "subscriptions",
          name: "Subscriptions",
          icon: "Repeat",
          color: "coral",
          displayOrder: 6,
          plannedMinor: 60000,
          actualMinor: 15000,
          progressPercent: 25,
          state: "normal",
        },
        {
          id: "utilities",
          name: "Utilities",
          icon: "Plug",
          color: "green",
          displayOrder: 7,
          plannedMinor: 120000,
          actualMinor: 72100,
          progressPercent: 60,
          state: "normal",
        },
      ],
      ...overrides,
    },
  };
}

function mockApi({ month, transactions } = {}) {
  apiClient.get.mockImplementation((path) => {
    if (path === "/auth/me") {
      return Promise.resolve(USER);
    }
    if (path.includes("/transactions")) {
      return Promise.resolve(
        transactions ?? { transactions: [], total: 0, limit: 50, offset: 0 },
      );
    }
    if (path.startsWith("/months/")) {
      return typeof month === "function" ? month() : month;
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.patch.mockReset();
});

describe("BudgetPage", () => {
  it("shows a loading skeleton while the month is pending", async () => {
    mockApi({ month: () => new Promise(() => {}) });
    render(renderProviders(<BudgetPage />));
    expect(await screen.findByLabelText("Loading budget")).toBeInTheDocument();
  });

  it("renders the CR-001 fixture: 12,500 income / 12,000 planned / 500 available with seven rows", async () => {
    mockApi({ month: () => Promise.resolve(monthFixture()) });
    render(renderProviders(<BudgetPage />));

    expect(await screen.findByText("12,500")).toBeInTheDocument();
    expect(screen.getByText("12,000")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    // All seven categories, including the two CR2 additions.
    for (const name of [
      "Housing",
      "Groceries",
      "Transport",
      "Fun",
      "Savings",
      "Subscriptions",
      "Utilities",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("4,000")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("opens the income popup from the income value and PATCHes incomeMinor (CR1-5)", async () => {
    mockApi({ month: () => Promise.resolve(monthFixture()) });
    apiClient.patch.mockResolvedValue({ budget: {} });
    render(renderProviders(<BudgetPage />));
    const user = userEvent.setup();

    const incomeButton = await screen.findByRole("button", {
      name: "Edit income, current value 12,500",
    });
    await user.click(incomeButton);

    const dialog = await screen.findByRole("dialog", { name: "Edit income" });
    const input = screen.getByLabelText("Income");
    expect(input).toHaveValue("12500");

    await user.clear(input);
    await user.type(input, "13000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(apiClient.patch).toHaveBeenCalledWith("/budget", { incomeMinor: 1300000 });
    expect(dialog).not.toBeInTheDocument();
    expect(await screen.findByText("Income updated")).toBeInTheDocument();
  });

  it("opens a category popup from its row and PATCHes that category only (CR1-6)", async () => {
    mockApi({ month: () => Promise.resolve(monthFixture()) });
    apiClient.patch.mockResolvedValue({ budget: {} });
    render(renderProviders(<BudgetPage />));
    const user = userEvent.setup();

    const utilitiesRow = await screen.findByRole("button", {
      name: /Utilities: 721 spent of 1,200 planned, 60%, edit planned amount/,
    });
    await user.click(utilitiesRow);

    await screen.findByRole("dialog", { name: "Edit Utilities plan" });
    const input = screen.getByLabelText("Planned amount");
    expect(input).toHaveValue("1200");

    await user.clear(input);
    await user.type(input, "900");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(apiClient.patch).toHaveBeenCalledWith("/budget", {
      categories: [{ id: "utilities", plannedMinor: 90000 }],
    });
    expect(await screen.findByText("Utilities plan updated")).toBeInTheDocument();
  });

  it("keeps Planned and Available non-interactive (CR1-7)", async () => {
    mockApi({ month: () => Promise.resolve(monthFixture()) });
    render(renderProviders(<BudgetPage />));
    await screen.findByText("12,500");

    // The only summary-metric button is the income editor.
    const planned = screen.getByText("12,000");
    const available = screen.getByText("500");
    for (const value of [planned, available]) {
      expect(value.closest("button")).toBeNull();
      expect(value.closest("a")).toBeNull();
    }
  });

  it("has no 'Edit budget' menu item (CR1-8) and offers Insights", async () => {
    mockApi({ month: () => Promise.resolve(monthFixture()) });
    render(renderProviders(<BudgetPage />));
    await screen.findByText("12,500");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "More options" }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).not.toContain("Edit budget");
    expect(items).toContain("View insights");
  });

  it("exposes the full progress sentence on each category-row button (D-BUD-F6)", async () => {
    mockApi({ month: () => Promise.resolve(monthFixture()) });
    render(renderProviders(<BudgetPage />));

    expect(
      await screen.findByRole("button", {
        name: "Housing: 2,520 spent of 4,000 planned, 63%, edit planned amount",
      }),
    ).toBeInTheDocument();
  });

  it("marks an overspent category with text, not color alone (D-BUD-D3)", async () => {
    const fixture = monthFixture();
    fixture.budget.categories[2] = {
      ...fixture.budget.categories[2],
      actualMinor: 92000,
      progressPercent: 115,
      state: "overspent",
    };
    mockApi({ month: () => Promise.resolve(fixture) });
    render(renderProviders(<BudgetPage />));

    expect(await screen.findByText("over plan")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Transport: 920 spent of 800 planned, 115%, over plan, edit planned amount",
      }),
    ).toBeInTheDocument();
  });

  it("shows per-month actuals over the same plans when navigating months (CR1-11)", async () => {
    const prev = previousMonth(currentMonth());
    apiClient.get.mockImplementation((path) => {
      if (path === "/auth/me") {
        return Promise.resolve(USER);
      }
      if (path.includes("/transactions")) {
        return Promise.resolve({ transactions: [], total: 0, limit: 50, offset: 0 });
      }
      if (path === `/months/${currentMonth()}`) {
        return Promise.resolve(monthFixture());
      }
      if (path === `/months/${prev}`) {
        // Same plans, zero actuals — a zero month renders, never a 404.
        const zeroed = monthFixture({ actualMinor: 0 });
        zeroed.budget.categories = zeroed.budget.categories.map((category) => ({
          ...category,
          actualMinor: 0,
          progressPercent: 0,
        }));
        return Promise.resolve(zeroed);
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    render(renderProviders(<BudgetPage />));
    const user = userEvent.setup();

    expect(await screen.findByText("12,500")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(
      await screen.findByRole("button", {
        name: "Housing: 0 spent of 4,000 planned, 0%, edit planned amount",
      }),
    ).toBeInTheDocument();
    // Plans unchanged.
    expect(screen.getByText("12,000")).toBeInTheDocument();
  });

  it("recovers from the defensive no-budget state by POSTing /budget (CR1-11)", async () => {
    let hasBudget = false;
    mockApi({
      month: () =>
        hasBudget
          ? Promise.resolve(monthFixture())
          : Promise.reject(
              new ApiError({ code: "NOT_FOUND", status: 404, message: "No budget yet." }),
            ),
    });
    apiClient.post.mockImplementation(() => {
      hasBudget = true;
      return Promise.resolve({ budget: {} });
    });
    render(renderProviders(<BudgetPage />));
    const user = userEvent.setup();

    expect(await screen.findByText("No budget yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set up your budget" }));

    expect(apiClient.post).toHaveBeenCalledWith("/budget");
    expect(await screen.findByText("12,500")).toBeInTheDocument();
  });

  it("keeps the authenticated shell and offers retry on failure (D-BUD-F5)", async () => {
    let calls = 0;
    mockApi({
      month: () => {
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
        return Promise.resolve(monthFixture());
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
