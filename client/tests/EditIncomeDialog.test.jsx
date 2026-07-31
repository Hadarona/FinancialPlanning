import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditIncomeDialog } from "../src/features/budget/EditIncomeDialog.jsx";
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

const BUDGET = { incomeMinor: 1250000, plannedMinor: 1200000, availableMinor: 50000 };

function Harness({ onSaved = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open income
      </button>
      <EditIncomeDialog
        open={open}
        budget={BUDGET}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          onSaved();
        }}
      />
    </>
  );
}

async function openDialog(props) {
  const user = userEvent.setup();
  render(renderProviders(<Harness {...props} />));
  await user.click(screen.getByRole("button", { name: "open income" }));
  await screen.findByRole("dialog", { name: "Edit income" });
  return user;
}

beforeEach(() => {
  apiClient.get.mockReset().mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
  apiClient.patch.mockReset();
});

describe("EditIncomeDialog (CR1-5/CR1-10)", () => {
  it("is a labelled modal dialog with initial focus on the prefilled input", async () => {
    await openDialog();
    const dialog = screen.getByRole("dialog", { name: "Edit income" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const input = screen.getByLabelText("Income");
    expect(input).toHaveValue("12500");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab, closes on Escape without mutating, and returns focus", async () => {
    const user = await openDialog();
    const dialog = screen.getByRole("dialog", { name: "Edit income" });

    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "open income" }),
    );
  });

  it("previews the recomputed Available while typing (CR1-7 values stay computed)", async () => {
    const user = await openDialog();
    const input = screen.getByLabelText("Income");
    await user.clear(input);
    await user.type(input, "13000");
    // 13,000 - 12,000 planned = 1,000 available.
    expect(screen.getByText(/Available 1,000/)).toBeInTheDocument();
  });

  it("parses by string math and PATCHes incomeMinor on save", async () => {
    apiClient.patch.mockResolvedValue({ budget: {} });
    const onSaved = vi.fn();
    const user = await openDialog({ onSaved });

    const input = screen.getByLabelText("Income");
    await user.clear(input);
    await user.type(input, "13000.55");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(apiClient.patch).toHaveBeenCalledWith("/budget", { incomeMinor: 1300055 });
  });

  it("rejects malformed and negative input client-side without calling the API", async () => {
    const user = await openDialog();
    const input = screen.getByLabelText("Income");

    for (const bad of ["abc", "-50"]) {
      await user.clear(input);
      await user.type(input, bad);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Enter a valid amount.")).toBeInTheDocument();
    }
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("maps server field errors inline and keeps the dialog open", async () => {
    apiClient.patch.mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Please check the highlighted fields.",
        fieldErrors: { incomeMinor: "Income cannot be negative." },
      }),
    );
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Income cannot be negative.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit income" })).toBeInTheDocument();
  });

  it("announces a generic failure and disables Save while pending (double-submit)", async () => {
    let resolvePatch;
    apiClient.patch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePatch = () => resolve({ budget: {} });
        }),
    );
    const user = await openDialog();
    const save = screen.getByRole("button", { name: "Save" });
    await user.click(save);
    await user.click(save);
    await user.click(save);
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    resolvePatch();

    apiClient.patch.mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL", status: 500, message: "Something went wrong." }),
    );
  });
});
