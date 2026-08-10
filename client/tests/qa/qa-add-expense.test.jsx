// QA-CC-30..37: AddExpenseDialog rendered inside the real budget page with
// the kit fixture (per plan), mocked at the fetch layer.
import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import { kitBudget, emptyTransactions } from "./fixtures/budgetFixtures.js";
import { currentMonth, monthRange } from "../../src/lib/dates.js";

const MONTH = currentMonth();
const { firstDay, lastDay } = monthRange(MONTH);

function baseEntries() {
  return [
    { method: "GET", path: "/auth/me", status: 200, json: meResponse() },
    { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
    {
      method: "GET",
      path: `/budgets/${MONTH}/transactions`,
      status: 200,
      json: emptyTransactions(),
    },
  ];
}

/** kitBudget() with groceries' actual bumped by `amountMinor` — the exact
 * post-add state the budget GET refetch should return. */
function kitBudgetAfterGroceriesAdd(amountMinor) {
  const base = kitBudget();
  const categories = base.budget.categories.map((category) => {
    if (category.id !== "groceries") return category;
    const actualMinor = category.actualMinor + amountMinor;
    const progressPercent = Math.round((actualMinor / category.plannedMinor) * 100);
    return {
      ...category,
      actualMinor,
      progressPercent,
      state: actualMinor > category.plannedMinor ? "overspent" : "normal",
    };
  });
  const actualMinor = categories.reduce((sum, c) => sum + c.actualMinor, 0);
  return { budget: { ...base.budget, categories, actualMinor } };
}

async function openDialogInBudgetPage(extraEntries = []) {
  const mock = installFetchMock([...baseEntries(), ...extraEntries]);
  const user = userEvent.setup();
  renderApp({ initialPath: "/budget" });
  await screen.findByText("12,500");
  await user.click(screen.getByRole("button", { name: "Add expense" }));
  await screen.findByRole("dialog", { name: "Add expense" });
  return { user, mock };
}

async function fillValidExpense(user) {
  await user.type(screen.getByLabelText("Amount"), "42.50");
  await user.selectOptions(screen.getByLabelText("Category"), "groceries");
}

describe("qa-add-expense", () => {
  it("QA-CC-30: opening moves focus in, Tab is trapped, and Escape closes with zero POSTs", async () => {
    const { user, mock } = await openDialogInBudgetPage();
    const dialog = screen.getByRole("dialog", { name: "Add expense" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    for (let i = 0; i < 10; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mock.callsMatching("POST", `/budgets/${MONTH}/transactions`)).toHaveLength(0);
  });

  it("QA-CC-30b: Cancel closes with zero POSTs", async () => {
    const { user, mock } = await openDialogInBudgetPage();
    await fillValidExpense(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mock.callsMatching("POST", `/budgets/${MONTH}/transactions`)).toHaveLength(0);
  });

  it("QA-CC-31: a valid save posts the parsed payload and the budget re-renders the new actual", async () => {
    const { user, mock } = await openDialogInBudgetPage([
      {
        method: "POST",
        path: `/budgets/${MONTH}/transactions`,
        status: 201,
        json: { transaction: { id: "t1" } },
      },
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: kitBudgetAfterGroceriesAdd(4250),
      },
    ]);
    await fillValidExpense(user);
    await user.type(screen.getByLabelText("Note (optional)"), "Weekly shop");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByText("Expense added")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const postCalls = mock.callsMatching("POST", `/budgets/${MONTH}/transactions`);
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].body).toMatchObject({
      categoryId: "groceries",
      amountMinor: 4250,
      note: "Weekly shop",
    });
    expect(postCalls[0].body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);

    // Budget refetch reflects the new actual — no manual reload needed.
    expect(
      await screen.findByRole("progressbar", { name: /Groceries/ }),
    ).toBeInTheDocument();
  });

  it("QA-CC-32: invalid variants show field-specific alerts and never call the API", async () => {
    const { user, mock } = await openDialogInBudgetPage();

    await user.type(screen.getByLabelText("Amount"), "abc");
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    expect(await screen.findByText("Enter a valid amount.")).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "0");
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    expect(
      await screen.findByText("Amount must be greater than zero."),
    ).toBeInTheDocument();

    const dateInput = screen.getByLabelText("Date");
    const outOfMonth = MONTH.endsWith("-12")
      ? `${Number(MONTH.slice(0, 4)) + 1}-01-15`
      : "2099-01-15";
    fireEvent.change(dateInput, { target: { value: outOfMonth } });
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    expect(await screen.findByText(/Date must be within/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Note (optional)"), "n".repeat(201));
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    expect(
      await screen.findByText("Note must be at most 200 characters."),
    ).toBeInTheDocument();

    expect(mock.callsMatching("POST", `/budgets/${MONTH}/transactions`)).toHaveLength(0);
  });

  it("QA-CC-33: a failed save keeps the dialog open with all values and an error alert, offering Retry", async () => {
    const { user } = await openDialogInBudgetPage([
      {
        method: "POST",
        path: `/budgets/${MONTH}/transactions`,
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong.", requestId: "r1" },
        },
      },
    ]);
    await fillValidExpense(user);
    await user.type(screen.getByLabelText("Note (optional)"), "keep me");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByText(/Couldn't save your expense/)).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("42.50");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("keep me");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("QA-CC-34: retrying after a failed save reuses the same clientRequestId", async () => {
    const { user, mock } = await openDialogInBudgetPage([
      {
        method: "POST",
        path: `/budgets/${MONTH}/transactions`,
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong.", requestId: "r1" },
        },
      },
      {
        method: "POST",
        path: `/budgets/${MONTH}/transactions`,
        status: 201,
        json: { transaction: { id: "t1" } },
      },
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: kitBudgetAfterGroceriesAdd(4250),
      },
    ]);
    await fillValidExpense(user);
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByText(/Couldn't save your expense/);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Expense added")).toBeInTheDocument();

    const postCalls = mock.callsMatching("POST", `/budgets/${MONTH}/transactions`);
    expect(postCalls).toHaveLength(2);
    expect(postCalls[1].body.clientRequestId).toBe(postCalls[0].body.clientRequestId);
  });

  it("QA-CC-35: a rapid double click on Save posts exactly once", async () => {
    const { user, mock } = await openDialogInBudgetPage([
      {
        method: "POST",
        path: `/budgets/${MONTH}/transactions`,
        status: 201,
        json: { transaction: { id: "t1" } },
        delayMs: 60,
      },
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: kitBudgetAfterGroceriesAdd(4250),
      },
    ]);
    await fillValidExpense(user);
    const save = screen.getByRole("button", { name: "Save expense" });
    await user.click(save);
    await user.click(save);
    await user.click(save);

    await screen.findByText("Expense added");
    expect(mock.callsMatching("POST", `/budgets/${MONTH}/transactions`)).toHaveLength(1);
  });

  it("QA-CC-36: the date input's min/max equal the month's first/last day", async () => {
    await openDialogInBudgetPage();
    const dateInput = screen.getByLabelText("Date");
    expect(dateInput).toHaveAttribute("min", firstDay);
    expect(dateInput).toHaveAttribute("max", lastDay);
  });

  it("QA-CC-37: closing the dialog (cancel and success) returns focus to the Add expense trigger", async () => {
    const { user } = await openDialogInBudgetPage();
    const trigger = screen.getByRole("button", { name: "Add expense" });
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(trigger);

    installFetchMock([
      ...baseEntries(),
      {
        method: "POST",
        path: `/budgets/${MONTH}/transactions`,
        status: 201,
        json: { transaction: { id: "t1" } },
      },
      {
        method: "GET",
        path: `/budgets/${MONTH}`,
        status: 200,
        json: kitBudgetAfterGroceriesAdd(4250),
      },
    ]);
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Add expense" });
    await fillValidExpense(user);
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByText("Expense added");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add expense" }),
    );
  });
});
