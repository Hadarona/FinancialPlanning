// QA-CC-40..42: DeleteExpenseConfirm rendered inside the real budget page.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse } from "./fixtures/authFixtures.js";
import {
  kitBudget,
  kitTransactions,
  emptyTransactions,
} from "./fixtures/budgetFixtures.js";
import { currentMonth } from "../../src/lib/dates.js";

const MONTH = currentMonth();
const EXPENSE_ID = kitTransactions().transactions[0].id;

function baseEntries() {
  return [
    { method: "GET", path: "/auth/me", status: 200, json: meResponse() },
    { method: "GET", path: `/months/${MONTH}`, status: 200, json: kitBudget() },
    {
      method: "GET",
      path: `/months/${MONTH}/transactions`,
      status: 200,
      json: kitTransactions(),
    },
  ];
}

async function openDeleteConfirm(extraEntries = []) {
  const mock = installFetchMock([...baseEntries(), ...extraEntries]);
  const user = userEvent.setup();
  renderApp({ initialPath: "/budget" });
  await screen.findByText("12,500");
  const deleteButton = await screen.findByRole("button", {
    name: /Delete Housing 2,520 on Jul 10/,
  });
  await user.click(deleteButton);
  await screen.findByRole("dialog", { name: "Delete expense" });
  return { user, mock };
}

describe("qa-delete-expense", () => {
  it("QA-CC-40: confirming a delete names the transaction, sends one DELETE, and announces removal", async () => {
    const { user, mock } = await openDeleteConfirm([
      {
        method: "DELETE",
        path: `/months/${MONTH}/transactions/${EXPENSE_ID}`,
        status: 204,
      },
      { method: "GET", path: `/months/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/months/${MONTH}/transactions`,
        status: 200,
        json: emptyTransactions(),
      },
    ]);
    expect(
      screen.getByText(/Delete Housing 2,520 on Jul 10\? This can't be undone\./),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Expense deleted")).toBeInTheDocument();
    expect(
      mock.callsMatching("DELETE", `/months/${MONTH}/transactions/${EXPENSE_ID}`),
    ).toHaveLength(1);
    expect(screen.queryByText(/Rent/)).not.toBeInTheDocument();
  });

  it("QA-CC-41: cancelling the confirmation sends zero DELETE calls and keeps the row", async () => {
    const { user, mock } = await openDeleteConfirm();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      mock.callsMatching("DELETE", `/months/${MONTH}/transactions/${EXPENSE_ID}`),
    ).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /Delete Housing 2,520 on Jul 10/ }),
    ).toBeInTheDocument();
  });

  it("QA-CC-42: a failed delete surfaces an error and keeps the row", async () => {
    const { user } = await openDeleteConfirm([
      {
        method: "DELETE",
        path: `/months/${MONTH}/transactions/${EXPENSE_ID}`,
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong.", requestId: "r1" },
        },
      },
    ]);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Couldn't delete the expense.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete Housing 2,520 on Jul 10/ }),
    ).toBeInTheDocument();
  });
});
