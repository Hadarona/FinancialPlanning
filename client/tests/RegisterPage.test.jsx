import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterPage } from "../src/pages/RegisterPage.jsx";
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

beforeEach(() => {
  apiClient.get.mockReset().mockResolvedValue({ user: null });
  apiClient.post.mockReset();
});

describe("RegisterPage", () => {
  it("shows a weak-password validation message before calling the API", async () => {
    render(renderProviders(<RegisterPage />));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("maps a duplicate-email 409 conflict onto the email field", async () => {
    apiClient.post.mockRejectedValue(
      new ApiError({
        code: "CONFLICT",
        status: 409,
        message: "An account with that email already exists.",
      }),
    );
    render(renderProviders(<RegisterPage />));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "dup@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("An account with that email already exists."),
    ).toBeInTheDocument();
  });
});
