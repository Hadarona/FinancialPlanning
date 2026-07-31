// QA-CC-50..57: BudgetFormPage create/edit behavior.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import { kitBudget } from "./fixtures/budgetFixtures.js";
import { currentMonth } from "../../src/lib/dates.js";
import { DEFAULT_CATEGORIES } from "../../src/lib/categories.js";

const MONTH = currentMonth();

function authEntry() {
  return { method: "GET", path: "/auth/me", status: 200, json: meResponse() };
}

describe("qa-budget-form", () => {
  it("QA-CC-50: typing income/plan values updates the live planned/available preview every keystroke", async () => {
    installFetchMock([authEntry()]);
    const user = userEvent.setup();
    renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });

    await user.clear(screen.getByLabelText("Income"));
    await user.type(screen.getByLabelText("Income"), "1000");
    await user.clear(screen.getByLabelText("Housing"));
    await user.type(screen.getByLabelText("Housing"), "300");

    // Planned = 300 (housing) + defaults for the other four (1500+800+900+3000)=6200 -> 6500.
    await waitFor(() => {
      expect(document.querySelector(".plan-totals").textContent).toContain(
        "Planned 6,500",
      );
    });
    expect(document.querySelector(".plan-totals").textContent).toContain(
      "Available -5,500",
    );
  });

  it("QA-CC-51: over-allocating plans beyond income shows a warning but keeps Save enabled", async () => {
    installFetchMock([authEntry()]);
    const user = userEvent.setup();
    renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });

    await user.clear(screen.getByLabelText("Income"));
    await user.type(screen.getByLabelText("Income"), "1");

    expect(
      await screen.findByText("You've planned more than your income."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save budget" })).toBeEnabled();
  });

  it("QA-CC-52: a valid create posts month + integer incomeMinor + exactly five {id,plannedMinor} entries", async () => {
    const mock = installFetchMock([
      authEntry(),
      { method: "POST", path: "/budgets", status: 201, json: kitBudget() },
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: { transactions: [], total: 0, limit: 50, offset: 0 },
      },
    ]);
    const user = userEvent.setup();
    renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });

    await user.click(screen.getByRole("button", { name: "Save budget" }));

    await waitFor(() => expect(mock.callsMatching("POST", "/budgets")).toHaveLength(1));
    const body = mock.callsMatching("POST", "/budgets")[0].body;
    expect(body.month).toBe(MONTH);
    expect(Number.isInteger(body.incomeMinor)).toBe(true);
    expect(body.categories).toHaveLength(5);
    expect(new Set(body.categories.map((c) => Object.keys(c).sort().join(",")))).toEqual(
      new Set(["id,plannedMinor"]),
    );
    expect(new Set(body.categories.map((c) => c.id))).toEqual(
      new Set(DEFAULT_CATEGORIES.map((c) => c.id)),
    );
    await screen.findByRole("heading", { name: "Budget" });
  });

  it("QA-CC-53: a 409 on create shows a recovery link to the existing month's budget", async () => {
    installFetchMock([
      authEntry(),
      {
        method: "POST",
        path: "/budgets",
        status: 409,
        json: {
          error: {
            code: "CONFLICT",
            message: "You already have a budget for this month.",
            requestId: "r1",
          },
        },
      },
    ]);
    const user = userEvent.setup();
    renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    const link = await screen.findByRole("link", { name: "View existing budget" });
    expect(link).toHaveAttribute("href", `/budget?month=${MONTH}`);
  });

  it("QA-CC-54: invalid money text in income/plan fields shows field errors and posts nothing", async () => {
    const mock = installFetchMock([authEntry()]);
    const user = userEvent.setup();
    renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });

    await user.clear(screen.getByLabelText("Income"));
    await user.type(screen.getByLabelText("Income"), "abc");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(await screen.findByText("Enter a valid income.")).toBeInTheDocument();
    expect(mock.callsMatching("POST", "/budgets")).toHaveLength(0);
  });

  it("QA-CC-55: edit mode prefills from the loaded budget, saves via PATCH, and renders updated numbers", async () => {
    const mock = installFetchMock([
      authEntry(),
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "PATCH",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: {
          budget: {
            ...kitBudget().budget,
            incomeMinor: 1500000,
            availableMinor: 1500000 - 1020000,
          },
        },
      },
      // BudgetPage's refetch-on-mount after navigating back must see the
      // saved income, not the original prefill snapshot.
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: {
          budget: {
            ...kitBudget().budget,
            incomeMinor: 1500000,
            availableMinor: 1500000 - 1020000,
          },
        },
      },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: { transactions: [], total: 0, limit: 50, offset: 0 },
      },
    ]);
    const user = userEvent.setup();
    renderApp({ initialPath: `/budget/${MONTH}/edit` });
    await screen.findByRole("heading", { name: "Edit budget" });

    expect(await screen.findByLabelText("Income")).toHaveValue("12500");
    expect(screen.getByLabelText("Housing")).toHaveValue("4000");

    await user.clear(screen.getByLabelText("Income"));
    await user.type(screen.getByLabelText("Income"), "15000");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    await waitFor(() =>
      expect(mock.callsMatching("PATCH", `/budgets/${MONTH}`)).toHaveLength(1),
    );
    expect(mock.callsMatching("PATCH", `/budgets/${MONTH}`)[0].body.incomeMinor).toBe(
      1500000,
    );
    expect(await screen.findByText("15,000")).toBeInTheDocument();
  });

  it("QA-CC-56: navigating away from a dirty form blocks, Stay preserves values, and a saved form proceeds unprompted", async () => {
    installFetchMock([
      authEntry(),
      { method: "POST", path: "/budgets", status: 201, json: kitBudget() },
      { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/budgets/${MONTH}/transactions`,
        status: 200,
        json: { transactions: [], total: 0, limit: 50, offset: 0 },
      },
    ]);
    const user = userEvent.setup();
    const { router } = renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });

    await user.clear(screen.getByLabelText("Income"));
    await user.type(screen.getByLabelText("Income"), "5000");

    router.navigate(`/budget?month=${MONTH}`);
    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Income")).toHaveValue("5000");

    await user.click(screen.getByRole("button", { name: "Save budget" }));
    await screen.findByRole("heading", { name: "Budget" });
  });

  it("QA-CC-57: the form always shows exactly the five fixed category rows with no add/remove control", async () => {
    installFetchMock([authEntry()]);
    renderApp({ initialPath: `/budget/new?month=${MONTH}` });
    await screen.findByRole("heading", { name: "Create budget" });

    for (const category of DEFAULT_CATEGORIES) {
      expect(screen.getByLabelText(category.name)).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: /add category/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });
});
