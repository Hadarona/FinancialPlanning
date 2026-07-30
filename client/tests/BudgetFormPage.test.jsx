import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { BudgetFormPage } from "../src/features/budget/BudgetFormPage.jsx";
import { AuthProvider } from "../src/app/AuthProvider.jsx";
import { currentMonth } from "../src/lib/dates.js";
import { apiClient, ApiError } from "../src/api/client.js";

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

const MONTH = currentMonth();

// The unsaved-changes guard uses useBlocker, which requires a data router —
// hence createMemoryRouter instead of the plain MemoryRouter test helper.
function renderForm(initialPath = "/budget/new") {
  const router = createMemoryRouter(
    [
      { path: "/budget/new", element: <BudgetFormPage mode="create" /> },
      { path: "/budget/:month/edit", element: <BudgetFormPage mode="edit" /> },
      { path: "/budget", element: <div>Budget destination</div> },
    ],
    { initialEntries: [initialPath] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  apiClient.get.mockReset().mockImplementation((path) => {
    if (path === "/auth/me") {
      return Promise.resolve({ user: { id: "u1", email: "a@b.com" } });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
  apiClient.post.mockReset();
  apiClient.patch.mockReset();
});

describe("BudgetFormPage", () => {
  it("shows a live planned/available preview that updates per keystroke (D-PLN-D2/F2)", async () => {
    renderForm();
    const user = userEvent.setup();

    // Kit defaults prefilled: income 12,500, planned 10,200, available 2,300.
    const totals = await screen.findByText(
      (_, element) =>
        element?.classList?.contains("plan-totals") &&
        element.textContent === "Planned 10,200 · Available 2,300",
    );
    expect(totals).toBeInTheDocument();

    const housing = screen.getByLabelText("Housing");
    await user.clear(housing);
    await user.type(housing, "5000");

    expect(
      screen.getByText(
        (_, element) =>
          element?.classList?.contains("plan-totals") &&
          element.textContent === "Planned 11,200 · Available 1,300",
      ),
    ).toBeInTheDocument();
  });

  it("warns on over-allocation but still allows saving (D-PLN-D3, decision #2)", async () => {
    apiClient.post.mockResolvedValue({ budget: { month: MONTH } });
    renderForm();
    const user = userEvent.setup();

    const income = await screen.findByLabelText("Income");
    await user.clear(income);
    await user.type(income, "9000");

    expect(
      await screen.findByText("You've planned more than your income."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save budget" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const [, payload] = apiClient.post.mock.calls[0];
    expect(payload).toMatchObject({ month: MONTH, incomeMinor: 900000 });
    expect(payload.categories).toHaveLength(5);

    // Saved: navigation proceeded without the unsaved-changes guard.
    expect(await screen.findByText("Budget destination")).toBeInTheDocument();
  });

  it("guards unsaved changes behind an explicit confirmation (D-PLN-F5)", async () => {
    renderForm();
    const user = userEvent.setup();

    const income = await screen.findByLabelText("Income");
    await user.clear(income);
    await user.type(income, "9999");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Blocked: the confirm dialog appears instead of navigating.
    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Income")).toHaveValue("9999");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(await screen.findByText("Budget destination")).toBeInTheDocument();
  });

  it("offers a recovery link to the existing month on a 409 (D-PLN-F3)", async () => {
    apiClient.post.mockRejectedValue(
      new ApiError({
        code: "CONFLICT",
        status: 409,
        message: "You already have a budget for this month.",
      }),
    );
    renderForm();
    const user = userEvent.setup();

    await screen.findByLabelText("Income");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(await screen.findByText(/You already have a budget for/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View existing budget" });
    expect(link).toHaveAttribute("href", `/budget?month=${MONTH}`);
  });

  it("prefills current values in edit mode and PATCHes all five categories (D-PLN-F2)", async () => {
    apiClient.get.mockImplementation((path) => {
      if (path === "/auth/me") {
        return Promise.resolve({ user: { id: "u1", email: "a@b.com" } });
      }
      if (path === `/budgets/${MONTH}`) {
        return Promise.resolve({
          budget: {
            id: "b1",
            month: MONTH,
            incomeMinor: 1300000,
            plannedMinor: 1020000,
            availableMinor: 280000,
            actualMinor: 0,
            categories: [
              {
                id: "housing",
                name: "Housing",
                icon: "House",
                color: "blue",
                displayOrder: 1,
                plannedMinor: 400000,
                actualMinor: 0,
                progressPercent: 0,
                state: "normal",
              },
              {
                id: "groceries",
                name: "Groceries",
                icon: "ShoppingCart",
                color: "green",
                displayOrder: 2,
                plannedMinor: 150000,
                actualMinor: 0,
                progressPercent: 0,
                state: "normal",
              },
              {
                id: "transport",
                name: "Transport",
                icon: "CarFront",
                color: "yellow",
                displayOrder: 3,
                plannedMinor: 80000,
                actualMinor: 0,
                progressPercent: 0,
                state: "normal",
              },
              {
                id: "fun",
                name: "Fun",
                icon: "PartyPopper",
                color: "coral",
                displayOrder: 4,
                plannedMinor: 90000,
                actualMinor: 0,
                progressPercent: 0,
                state: "normal",
              },
              {
                id: "savings",
                name: "Savings",
                icon: "PiggyBank",
                color: "blue",
                displayOrder: 5,
                plannedMinor: 300000,
                actualMinor: 0,
                progressPercent: 0,
                state: "normal",
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    apiClient.patch.mockResolvedValue({ budget: { month: MONTH } });

    renderForm(`/budget/${MONTH}/edit`);
    const user = userEvent.setup();

    const income = await screen.findByLabelText("Income");
    expect(income).toHaveValue("13000");

    const fun = screen.getByLabelText("Fun");
    await user.clear(fun);
    await user.type(fun, "1200");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1));
    const [path, payload] = apiClient.patch.mock.calls[0];
    expect(path).toBe(`/budgets/${MONTH}`);
    expect(payload.incomeMinor).toBe(1300000);
    expect(payload.categories).toHaveLength(5);
    expect(payload.categories.find((c) => c.id === "fun").plannedMinor).toBe(120000);
  });
});
