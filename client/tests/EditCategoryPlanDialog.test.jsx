import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditCategoryPlanDialog } from "../src/features/budget/EditCategoryPlanDialog.jsx";
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

const CATEGORY = {
  id: "utilities",
  name: "Utilities",
  plannedMinor: 120000,
  actualMinor: 72100,
};

function Harness({ onSaved = () => {} }) {
  const [category, setCategory] = useState(null);
  return (
    <>
      <button type="button" onClick={() => setCategory(CATEGORY)}>
        open category
      </button>
      <EditCategoryPlanDialog
        open={category !== null}
        category={category}
        onClose={() => setCategory(null)}
        onSaved={(saved) => {
          setCategory(null);
          onSaved(saved);
        }}
      />
    </>
  );
}

async function openDialog(props) {
  const user = userEvent.setup();
  render(renderProviders(<Harness {...props} />));
  await user.click(screen.getByRole("button", { name: "open category" }));
  await screen.findByRole("dialog", { name: "Edit Utilities plan" });
  return user;
}

beforeEach(() => {
  apiClient.get.mockReset().mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
  apiClient.patch.mockReset();
});

describe("EditCategoryPlanDialog (CR1-6/CR1-10)", () => {
  it("is a labelled modal dialog prefilled with the category plan", async () => {
    await openDialog();
    const dialog = screen.getByRole("dialog", { name: "Edit Utilities plan" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Planned amount")).toHaveValue("1200");
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The month's spending contextualizes the edit.
    expect(screen.getByText(/Spent 721 of 1,200 planned/)).toBeInTheDocument();
  });

  it("closes on Escape without mutating and returns focus to the row", async () => {
    const user = await openDialog();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "open category" }),
    );
  });

  it("PATCHes exactly one category with parsed minor units on save", async () => {
    apiClient.patch.mockResolvedValue({ budget: {} });
    const onSaved = vi.fn();
    const user = await openDialog({ onSaved });

    const input = screen.getByLabelText("Planned amount");
    await user.clear(input);
    await user.type(input, "900");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(apiClient.patch).toHaveBeenCalledWith("/budget", {
      categories: [{ id: "utilities", plannedMinor: 90000 }],
    });
    expect(onSaved.mock.calls[0][0].name).toBe("Utilities");
  });

  it("rejects malformed input client-side without calling the API", async () => {
    const user = await openDialog();
    const input = screen.getByLabelText("Planned amount");
    await user.clear(input);
    await user.type(input, "12,x");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a valid amount.")).toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("maps server field errors inline and offers retry", async () => {
    apiClient.patch.mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Please check the highlighted fields.",
        fieldErrors: {
          "categories.0.plannedMinor": "Planned amounts cannot be negative.",
        },
      }),
    );
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Planned amounts cannot be negative."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Edit Utilities plan" }),
    ).toBeInTheDocument();
  });

  it("submits only once on rapid double click (double-submit protection)", async () => {
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
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    resolvePatch();
  });
});
