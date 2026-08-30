// QA-CC-50..53: in-place budget editing and no-budget recovery behavior.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import { kitBudget, emptyTransactions } from "./fixtures/budgetFixtures.js";
import { currentMonth } from "../../src/lib/dates.js";

const MONTH = currentMonth();

function authEntry() {
  return { method: "GET", path: "/auth/me", status: 200, json: meResponse() };
}

function monthEntries(budget = kitBudget()) {
  return [
    { method: "GET", path: `/months/${MONTH}`, status: 200, json: budget },
    {
      method: "GET",
      path: `/months/${MONTH}/transactions`,
      status: 200,
      json: emptyTransactions(),
    },
  ];
}

function withIncome(incomeMinor) {
  const { budget } = kitBudget();
  return {
    budget: {
      ...budget,
      incomeMinor,
      availableMinor: incomeMinor - budget.plannedMinor,
    },
  };
}

function withHousingPlan(plannedMinor) {
  const { budget } = kitBudget();
  const categories = budget.categories.map((category) =>
    category.id === "housing"
      ? {
          ...category,
          plannedMinor,
          progressPercent: Math.round((category.actualMinor / plannedMinor) * 100),
        }
      : category,
  );
  const totalPlannedMinor = categories.reduce(
    (total, category) => total + category.plannedMinor,
    0,
  );
  return {
    budget: {
      ...budget,
      categories,
      plannedMinor: totalPlannedMinor,
      availableMinor: budget.incomeMinor - totalPlannedMinor,
    },
  };
}

describe("qa-budget-flow", () => {
  it("QA-CC-50: editing income through the live dialog PATCHes integer minor units and refreshes the summary", async () => {
    const updatedBudget = withIncome(1500000);
    const mock = installFetchMock([
      authEntry(),
      ...monthEntries(),
      { method: "PATCH", path: "/budget", status: 200, json: updatedBudget },
      ...monthEntries(updatedBudget),
    ]);
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Edit income, current value 12,500" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit income" });
    const income = screen.getByLabelText("Income");
    expect(income).toHaveValue("12500");

    await user.clear(income);
    await user.type(income, "15000");
    expect(dialog).toHaveTextContent("Available 3,000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.callsMatching("PATCH", "/budget")).toHaveLength(1));
    expect(mock.callsMatching("PATCH", "/budget")[0].body).toEqual({ incomeMinor: 1500000 });
    expect(await screen.findByText("Income updated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit income, current value 15,000" })).toBeInTheDocument();
  });

  it("QA-CC-51: editing one category plan PATCHes only that category and refreshes its row", async () => {
    const updatedBudget = withHousingPlan(450000);
    const mock = installFetchMock([
      authEntry(),
      ...monthEntries(),
      { method: "PATCH", path: "/budget", status: 200, json: updatedBudget },
      ...monthEntries(updatedBudget),
    ]);
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole("button", { name: /Housing: 2,520 spent of 4,000 planned, 63%, edit planned amount/ }),
    );
    await screen.findByRole("dialog", { name: "Edit Housing plan" });
    const plannedAmount = screen.getByLabelText("Planned amount");
    await user.clear(plannedAmount);
    await user.type(plannedAmount, "4500");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.callsMatching("PATCH", "/budget")).toHaveLength(1));
    expect(mock.callsMatching("PATCH", "/budget")[0].body).toEqual({
      categories: [{ id: "housing", plannedMinor: 450000 }],
    });
    expect(await screen.findByText("Housing plan updated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Housing: 2,520 spent of 4,500 planned, 56%, edit planned amount/ })).toBeInTheDocument();
  });

  it("QA-CC-52: invalid dialog input posts nothing, and Cancel closes the dialog without a change", async () => {
    const mock = installFetchMock([authEntry(), ...monthEntries()]);
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Edit income, current value 12,500" }));
    const income = screen.getByLabelText("Income");
    await user.clear(income);
    await user.type(income, "invalid");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a valid amount.")).toBeInTheDocument();
    expect(mock.callsMatching("PATCH", "/budget")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Edit income" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit income, current value 12,500" })).toBeInTheDocument();
  });

  it("QA-CC-53: the no-budget recovery action POSTs /budget and renders the refreshed month", async () => {
    const mock = installFetchMock([
      authEntry(),
      {
        method: "GET",
        path: `/months/${MONTH}`,
        status: 404,
        json: { error: { code: "NOT_FOUND", message: "No budget yet.", requestId: "r1" } },
      },
      { method: "POST", path: "/budget", status: 201, json: kitBudget() },
      ...monthEntries(),
    ]);
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Set up your budget" }));
    await waitFor(() => expect(mock.callsMatching("POST", "/budget")).toHaveLength(1));
    expect(await screen.findByText("12,500")).toBeInTheDocument();
    expect(await screen.findByText("Budget created")).toBeInTheDocument();
  });
});
