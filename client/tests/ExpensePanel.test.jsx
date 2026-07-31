import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExpensePanel } from "../src/features/budget/ExpensePanel.jsx";
import { apiClient } from "../src/api/client.js";

vi.mock("../src/api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

const CATEGORIES = [
  { id: "housing", name: "Housing", icon: "House", color: "blue" },
  { id: "groceries", name: "Groceries", icon: "ShoppingCart", color: "green" },
];

const TRANSACTIONS = [
  {
    id: "tx-1",
    categoryId: "groceries",
    amountMinor: 4250,
    occurredOn: "2026-07-15",
    note: "Weekly shop",
  },
  {
    id: "tx-2",
    categoryId: "housing",
    amountMinor: 395700,
    occurredOn: "2026-07-01",
    note: null,
  },
];

function renderPanel(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExpensePanel
        month="2026-07"
        categories={CATEGORIES}
        onDeleteRequest={props.onDeleteRequest ?? vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("ExpensePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists expenses with category, date, amount, and note", async () => {
    apiClient.get.mockResolvedValueOnce({
      transactions: TRANSACTIONS,
      total: 2,
      limit: 50,
      offset: 0,
    });

    renderPanel();

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("Weekly shop")).toBeInTheDocument();
    expect(screen.getByText("42.50")).toBeInTheDocument();
    expect(screen.getByText("3,957")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/months/2026-07/transactions");
  });

  it("names the exact transaction in each delete button and reports it on click (D-EXP-D4 naming)", async () => {
    apiClient.get.mockResolvedValueOnce({
      transactions: TRANSACTIONS,
      total: 2,
      limit: 50,
      offset: 0,
    });
    const onDeleteRequest = vi.fn();
    const user = userEvent.setup();

    renderPanel({ onDeleteRequest });

    const deleteGroceries = await screen.findByRole("button", {
      name: /Delete Groceries 42\.50 on/,
    });
    await user.click(deleteGroceries);
    expect(onDeleteRequest).toHaveBeenCalledWith(TRANSACTIONS[0]);
  });

  it("shows the empty-history state when there are no expenses", async () => {
    apiClient.get.mockResolvedValueOnce({
      transactions: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    renderPanel();

    expect(await screen.findByText(/no expenses/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("announces a load failure without dropping the section", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("network down"));

    renderPanel();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recent expenses/i })).toBeInTheDocument();
  });
});
