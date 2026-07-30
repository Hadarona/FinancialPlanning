import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddExpenseDialog } from "../src/features/budget/AddExpenseDialog.jsx";
import { DEFAULT_CATEGORIES } from "../src/lib/categories.js";
import { currentMonth } from "../src/lib/dates.js";
import { renderProviders } from "./testUtils.jsx";
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

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open dialog
      </button>
      <AddExpenseDialog
        open={open}
        month={MONTH}
        categories={DEFAULT_CATEGORIES}
        onClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
      />
    </>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  render(renderProviders(<Harness />));
  await user.click(screen.getByRole("button", { name: "open dialog" }));
  await screen.findByRole("dialog", { name: "Add expense" });
  return user;
}

async function fillValidExpense(user) {
  await user.type(screen.getByLabelText("Amount"), "42.50");
  await user.selectOptions(screen.getByLabelText("Category"), "groceries");
}

beforeEach(() => {
  apiClient.get.mockReset().mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
  apiClient.post.mockReset();
});

describe("AddExpenseDialog", () => {
  it("moves focus into the dialog, traps Tab, and returns focus on Escape (D-EXP-D5)", async () => {
    const user = await openDialog();
    const dialog = screen.getByRole("dialog", { name: "Add expense" });

    // Focus moved inside on open.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab cycles stay inside the dialog.
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Escape closes without mutating and returns focus to the opener.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "open dialog" }));
  });

  it("shows field errors for invalid input and never calls the API (D-EXP-F2)", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Amount"), "abc");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByText("Enter a valid amount.")).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("submits string-parsed minor units with a clientRequestId and closes on success (D-EXP-F1)", async () => {
    apiClient.post.mockResolvedValue({ transaction: { id: "t1" } });
    const user = await openDialog();
    await fillValidExpense(user);
    await user.type(screen.getByLabelText("Note (optional)"), "Weekly shop");

    await user.click(screen.getByRole("button", { name: "Save expense" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [path, payload] = apiClient.post.mock.calls[0];
    expect(path).toBe(`/budgets/${MONTH}/transactions`);
    expect(payload).toMatchObject({
      categoryId: "groceries",
      amountMinor: 4250,
      note: "Weekly shop",
    });
    expect(payload.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("creates exactly one expense on rapid double click (D-EXP-F5)", async () => {
    let resolveCreate;
    apiClient.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = () => resolve({ transaction: { id: "t1" } });
        }),
    );
    const user = await openDialog();
    await fillValidExpense(user);

    const save = screen.getByRole("button", { name: "Save expense" });
    await user.click(save);
    await user.click(save);
    await user.click(save);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    resolveCreate();
  });

  it("keeps values and offers retry with the same clientRequestId after a failed save (D-EXP-F4)", async () => {
    apiClient.post.mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL", status: 500, message: "Something went wrong." }),
    );
    const user = await openDialog();
    await fillValidExpense(user);
    await user.type(screen.getByLabelText("Note (optional)"), "keep me");

    await user.click(screen.getByRole("button", { name: "Save expense" }));

    // Dialog stays open, values preserved, error banner shown.
    expect(await screen.findByText(/Couldn't save your expense/)).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("42.50");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("keep me");

    apiClient.post.mockResolvedValueOnce({ transaction: { id: "t1" } });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(apiClient.post).toHaveBeenCalledTimes(2);
    const firstId = apiClient.post.mock.calls[0][1].clientRequestId;
    const secondId = apiClient.post.mock.calls[1][1].clientRequestId;
    expect(secondId).toBe(firstId);
  });

  it("cancel closes without any mutation (D-EXP-F3)", async () => {
    const user = await openDialog();
    await fillValidExpense(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
