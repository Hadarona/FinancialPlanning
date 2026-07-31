import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteExpenseConfirm } from "../src/features/budget/DeleteExpenseConfirm.jsx";
import { renderProviders } from "./testUtils.jsx";
import { apiClient } from "../src/api/client.js";

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

const TRANSACTION = {
  id: "tx-1",
  categoryId: "groceries",
  amountMinor: 4250,
  occurredOn: "2026-07-15",
  note: "Weekly shop",
};

function renderConfirm({ onClose = vi.fn(), onDeleted = vi.fn() } = {}) {
  render(
    renderProviders(
      <DeleteExpenseConfirm
        open
        month="2026-07"
        transaction={TRANSACTION}
        categoryName="Groceries"
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    ),
  );
  return { onClose, onDeleted };
}

beforeEach(() => {
  apiClient.get.mockReset().mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
  apiClient.delete.mockReset();
});

describe("DeleteExpenseConfirm", () => {
  it("identifies the exact transaction being deleted (D-EXP-D4)", async () => {
    renderConfirm();
    expect(
      await screen.findByText(/Delete Groceries 42\.50 on Jul 15\?/),
    ).toBeInTheDocument();
  });

  it("deletes on confirm and reports back (D-EXP-F6)", async () => {
    apiClient.delete.mockResolvedValue(null);
    const { onDeleted } = renderConfirm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(apiClient.delete).toHaveBeenCalledWith("/months/2026-07/transactions/tx-1");
  });

  it("cancel is a strict no-op (D-EXP-F6)", async () => {
    const { onClose, onDeleted } = renderConfirm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with an error message when the delete fails", async () => {
    apiClient.delete.mockRejectedValue(new Error("network"));
    const { onDeleted } = renderConfirm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Couldn't delete the expense/)).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
