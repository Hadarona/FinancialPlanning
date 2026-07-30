import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../src/pages/LoginPage.jsx";
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

beforeEach(() => {
  apiClient.get.mockReset().mockResolvedValue({ user: null });
  apiClient.post.mockReset();
});

describe("LoginPage", () => {
  it("shows validation messages when submitted empty and never calls the API", async () => {
    render(renderProviders(<LoginPage />));
    const user = userEvent.setup();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("shows an invalid-email message for a malformed address", async () => {
    render(renderProviders(<LoginPage />));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "somepassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("submits at most once even on rapid repeated clicks", async () => {
    let resolveLogin;
    apiClient.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = () => resolve({ user: { id: "1", email: "a@b.com" } });
        }),
    );
    render(renderProviders(<LoginPage />));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");

    const submit = screen.getByRole("button", { name: "Sign in" });
    await user.click(submit);
    await user.click(submit);
    await user.click(submit);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    resolveLogin();
  });
});
