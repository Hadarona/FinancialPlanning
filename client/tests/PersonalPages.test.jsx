import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderProviders } from "./testUtils.jsx";
import { SettingsPage } from "../src/features/settings/SettingsPage.jsx";
import { ImportPage } from "../src/features/import/ImportPage.jsx";
import { apiClient, uploadWorkbook } from "../src/api/client.js";

vi.mock("../src/api/client.js", async (original) => ({
  ...(await original()),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  uploadWorkbook: vi.fn(),
}));
const budget = {
  id: "b1",
  revision: 1,
  incomeMinor: 100000,
  plannedMinor: 30000,
  categories: [
    { id: "groceries", name: "Groceries", plannedMinor: 30000 },
    { id: "one-off", name: "One-off expenses", plannedMinor: 0 },
  ],
};
function setupGet(role = "owner") {
  apiClient.get.mockImplementation((path) => {
    if (path === "/auth/me")
      return Promise.resolve({ user: { id: "u1", email: "me@example.com" } });
    if (path === "/sharing")
      return Promise.resolve({
        budgets: [{ id: "b1", role, owner_email: "owner@example.com" }],
      });
    if (path === "/sharing/members")
      return Promise.resolve({
        role,
        members: [{ id: "u2", email: "friend@example.com", role: "viewer" }],
      });
    if (path.startsWith("/months/")) return Promise.resolve({ budget });
    return Promise.reject(new Error("Unexpected URL " + path));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  setupGet();
  apiClient.patch.mockResolvedValue({ budget });
  apiClient.post.mockResolvedValue({});
  apiClient.delete.mockResolvedValue(null);
});
describe("Plan and sharing screens", () => {
  it("edits income, adds a category and sends an effective month and revision", async () => {
    const user = userEvent.setup();
    render(renderProviders(<SettingsPage />));
    const income = await screen.findByLabelText("Monthly income (ILS)");
    await user.clear(income);
    await user.type(income, "2000");
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    const names = screen.getAllByLabelText("Category name");
    await user.type(names.at(-1), "Pets");
    await user.click(screen.getByRole("button", { name: "Save from selected month" }));
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/budget",
        expect.objectContaining({
          revision: 1,
          incomeMinor: 200000,
          effectiveMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
          categories: expect.arrayContaining([
            expect.objectContaining({ name: "Pets", plannedMinor: 0 }),
          ]),
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Plan saved");
  });
  it("archives a category, locks one-off budget at zero and rejects invalid money", async () => {
    const user = userEvent.setup();
    render(renderProviders(<SettingsPage />));
    await screen.findByLabelText("Monthly income (ILS)");
    expect(screen.getAllByLabelText("Monthly plan (ILS)")[1]).toBeDisabled();
    await user.click(screen.getByLabelText("Archive"));
    const income = screen.getByLabelText("Monthly income (ILS)");
    await user.clear(income);
    await user.type(income, "-1");
    await user.click(screen.getByRole("button", { name: "Save from selected month" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("valid non-negative");
    expect(apiClient.patch).not.toHaveBeenCalled();
    await user.clear(income);
    await user.type(income, "100");
    await user.click(screen.getByRole("button", { name: "Save from selected month" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(apiClient.patch.mock.calls[0][1].categories[0].archived).toBe(true);
  });
  it("keeps edits visible on save errors and supports retry", async () => {
    apiClient.patch.mockRejectedValueOnce(
      new Error("The budget changed. Refresh before saving."),
    );
    const user = userEvent.setup();
    render(renderProviders(<SettingsPage />));
    await screen.findByLabelText("Monthly income (ILS)");
    await user.click(screen.getByRole("button", { name: "Save from selected month" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("budget changed");
    await user.click(screen.getByRole("button", { name: "Save from selected month" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Plan saved");
  });
  it("creates an email-bound viewer invite and displays the code", async () => {
    apiClient.post.mockResolvedValueOnce({ token: "invite-code" });
    const user = userEvent.setup();
    render(renderProviders(<SettingsPage />));
    await user.type(await screen.findByLabelText("Their email"), "new@example.com");
    await user.selectOptions(screen.getByLabelText("Access"), "viewer");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(await screen.findByLabelText("Invitation code")).toHaveValue("invite-code");
    expect(apiClient.post).toHaveBeenCalledWith("/sharing/invite", {
      email: "new@example.com",
      role: "viewer",
    });
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
  });
  it("joins a budget and removes member access", async () => {
    const user = userEvent.setup();
    render(renderProviders(<SettingsPage />));
    await user.click(await screen.findByRole("button", { name: "Remove access" }));
    expect(apiClient.delete).toHaveBeenCalledWith("/sharing/members/u2");
    await user.type(
      screen.getByLabelText("Have an invitation? Paste the code"),
      "  token  ",
    );
    await user.click(screen.getByRole("button", { name: "Join budget" }));
    expect(apiClient.post).toHaveBeenCalledWith("/sharing/accept", { token: "token" });
    expect(await screen.findByRole("status")).toHaveTextContent("Budget joined");
  });
  it("does not offer invitation administration to a viewer", async () => {
    setupGet("viewer");
    render(renderProviders(<SettingsPage />));
    await screen.findByText(/friend@example.com/);
    expect(screen.queryByLabelText("Their email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove access" }),
    ).not.toBeInTheDocument();
  });
});
const rows = [
  {
    index: 0,
    sourceRow: 5,
    occurredOn: "2026-07-01",
    note: "Synthetic shop",
    amountMinor: 2000,
    metadata: { sourceCategory: "Food" },
    duplicate: false,
  },
  {
    index: 1,
    sourceRow: 6,
    occurredOn: "2026-07-02",
    note: "Already imported",
    amountMinor: 300,
    metadata: { sourceCategory: "Food" },
    duplicate: true,
  },
];
async function openPreview() {
  const user = userEvent.setup();
  render(renderProviders(<ImportPage />));
  await user.upload(
    screen.getByLabelText("Excel statement (.xlsx, up to 5 MB)"),
    new File(["fake"], "statement.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  fireEvent.submit(
    screen.getByRole("button", { name: "Preview transactions" }).closest("form"),
  );
  await screen.findByText("Review & categorize");
  return user;
}
describe("Import review", () => {
  beforeEach(() => {
    uploadWorkbook.mockResolvedValue({ previewId: "p1", rows, issues: [] });
  });
  it("leaves manual matches unchecked even on select-all and requires individual selection", async () => {
    uploadWorkbook.mockResolvedValueOnce({
      previewId: "p1",
      issues: [],
      rows: [
        {
          ...rows[0],
          manualMatches: [{ id: "manual-1", note: "Lunch entered yesterday" }],
        },
        rows[1],
      ],
    });
    apiClient.post.mockResolvedValueOnce({ imported: 1, duplicates: 0 });
    const user = await openPreview();
    expect(screen.getByText("Possible duplicate")).toBeVisible();
    expect(screen.getByText("Lunch entered yesterday")).toBeVisible();
    expect(screen.getByLabelText("Import row 5")).not.toBeChecked();
    await user.click(screen.getByLabelText("Select all new transactions"));
    await user.click(screen.getByLabelText("Select all new transactions"));
    expect(screen.getByLabelText("Import row 5")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirm import" })).toBeDisabled();
    await user.click(screen.getByLabelText("Import row 5"));
    await user.click(screen.getByRole("button", { name: "Confirm import" }));
    expect(apiClient.post).toHaveBeenCalledWith("/imports/commit", {
      previewId: "p1",
      rows: [{ index: 0, categoryId: "one-off", allowManualMatch: true }],
    });
  });
  it("requires a preview, excludes duplicates, maps categories and imports only selected rows", async () => {
    apiClient.post.mockResolvedValueOnce({ imported: 1, duplicates: 0 });
    const user = await openPreview();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Import row 6")).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Food"), "groceries");
    await user.click(screen.getByRole("button", { name: "Confirm import" }));
    expect(apiClient.post).toHaveBeenCalledWith("/imports/commit", {
      previewId: "p1",
      rows: [{ index: 0, categoryId: "groceries" }],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Imported 1");
  });
  it("supports deselection and never submits an empty selection", async () => {
    const user = await openPreview();
    await user.click(screen.getByLabelText("Import row 5"));
    expect(screen.getByRole("button", { name: "Confirm import" })).toBeDisabled();
    await user.click(screen.getByLabelText("Select all new transactions"));
    expect(screen.getByRole("button", { name: "Confirm import" })).not.toBeDisabled();
  });
  it("shows skipped rows and preserves preview on commit failure", async () => {
    uploadWorkbook.mockResolvedValueOnce({
      previewId: "p1",
      rows,
      issues: [{ sheet: "Transactions", row: 8, message: "Invalid date" }],
    });
    apiClient.post.mockRejectedValueOnce(new Error("Preview expired"));
    const user = await openPreview();
    expect(screen.getByText(/rows need review/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm import" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Preview expired");
    expect(screen.getByText("Review & categorize")).toBeInTheDocument();
  });
  it("shows upload errors without creating transactions", async () => {
    uploadWorkbook.mockRejectedValueOnce(new Error("Invalid workbook"));
    const user = userEvent.setup();
    render(renderProviders(<ImportPage />));
    await user.upload(
      screen.getByLabelText("Excel statement (.xlsx, up to 5 MB)"),
      new File(["x"], "broken.xlsx"),
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Preview transactions" }).closest("form"),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid workbook");
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe("Shared viewer controls", () => {
  it("disables plan editing for a selected viewer budget", async () => {
    setupGet("viewer");
    sessionStorage.setItem("selected-budget", "b1");
    render(renderProviders(<SettingsPage />));
    await screen.findByLabelText("Monthly income (ILS)");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save from selected month" }),
      ).toBeDisabled(),
    );
    expect(screen.getByLabelText("Monthly income (ILS)")).toBeDisabled();
  });
  it("disables imports for a selected viewer budget", async () => {
    setupGet("viewer");
    sessionStorage.setItem("selected-budget", "b1");
    render(renderProviders(<ImportPage />));
    expect(await screen.findByText(/You have view-only access/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Preview transactions" })).toBeDisabled();
  });
});
