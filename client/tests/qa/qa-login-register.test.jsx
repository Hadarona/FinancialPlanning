// QA-CC-01..08: login/register component behavior, mocked at the fetch
// layer (installFetchMock) rather than by mocking apiClient directly.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import {
  meResponse,
  anonymousMeResponse,
  unauthenticatedErrorEnvelope,
  conflictErrorEnvelope,
} from "./fixtures/authFixtures.js";
import { kitBudget, kitTransactions } from "./fixtures/budgetFixtures.js";
import { currentMonth } from "../../src/lib/dates.js";

const MONTH = currentMonth();

function budgetShellEntries() {
  return [
    { method: "GET", path: `/budgets/${MONTH}`, status: 200, json: kitBudget() },
    {
      method: "GET",
      path: `/budgets/${MONTH}/transactions`,
      status: 200,
      json: kitTransactions(),
    },
  ];
}

describe("qa-login-register", () => {
  it("QA-CC-01: valid login sends exactly one typed POST and navigates to the budget route", async () => {
    const mock = installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
      { method: "POST", path: "/auth/login", status: 200, json: meResponse() },
      ...budgetShellEntries(),
    ]);
    renderApp({ initialPath: "/login" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Welcome back" });

    await user.type(screen.getByLabelText("Email"), "qa-user@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mock.callsMatching("GET", `/budgets/${MONTH}`).length).toBeGreaterThan(0);
    });
    const loginCalls = mock.callsMatching("POST", "/auth/login");
    expect(loginCalls).toHaveLength(1);
    expect(loginCalls[0].body).toEqual({
      email: "qa-user@example.com",
      password: "supersecret1",
    });
  });

  it("QA-CC-02: a failed login shows the error, stays on login, and preserves typed values", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
      {
        method: "POST",
        path: "/auth/login",
        status: 401,
        json: unauthenticatedErrorEnvelope("Incorrect email or password."),
      },
    ]);
    renderApp({ initialPath: "/login" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Welcome back" });

    await user.type(screen.getByLabelText("Email"), "qa-user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("qa-user@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("wrongpassword1");
  });

  it("QA-CC-03: submitting empty/invalid email shows a labelled field error and calls the API zero times", async () => {
    const mock = installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
    ]);
    renderApp({ initialPath: "/login" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Welcome back" });

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(mock.callsMatching("POST", "/auth/login")).toHaveLength(0);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "somepassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(mock.callsMatching("POST", "/auth/login")).toHaveLength(0);
  });

  it("QA-CC-04: a slow login submits exactly once on a rapid double click", async () => {
    const mock = installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
      {
        method: "POST",
        path: "/auth/login",
        status: 200,
        json: meResponse(),
        delayMs: 60,
      },
      ...budgetShellEntries(),
    ]);
    renderApp({ initialPath: "/login" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Welcome back" });
    await user.type(screen.getByLabelText("Email"), "qa-user@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");

    const submit = screen.getByRole("button", { name: "Sign in" });
    await user.click(submit);
    await user.click(submit);
    await user.click(submit);

    await waitFor(() =>
      expect(mock.callsMatching("POST", "/auth/login")).toHaveLength(1),
    );
  });

  it("QA-CC-05: the Show/Hide toggle switches the input type and keeps focus on itself", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
    ]);
    renderApp({ initialPath: "/login" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Welcome back" });

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(passwordInput).toHaveAttribute("type", "text");
    const hideToggle = screen.getByRole("button", { name: "Hide password" });
    expect(hideToggle).toBe(toggle);

    await user.click(hideToggle);
    expect(document.activeElement).toBe(toggle);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("QA-CC-06: registering sends one POST and navigates to the budget route", async () => {
    const mock = installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
      { method: "POST", path: "/auth/register", status: 201, json: meResponse() },
      ...budgetShellEntries(),
    ]);
    renderApp({ initialPath: "/register" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Create account" });

    await user.type(screen.getByLabelText("Email"), "qa-new@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(mock.callsMatching("GET", `/budgets/${MONTH}`).length).toBeGreaterThan(0);
    });
    expect(mock.callsMatching("POST", "/auth/register")).toHaveLength(1);
  });

  it("QA-CC-07: a 409 on register maps to the email field and preserves values", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
      {
        method: "POST",
        path: "/auth/register",
        status: 409,
        json: conflictErrorEnvelope("An account with that email already exists."),
      },
    ]);
    renderApp({ initialPath: "/register" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Create account" });

    await user.type(screen.getByLabelText("Email"), "dup@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("An account with that email already exists."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("dup@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("supersecret1");
  });

  it("QA-CC-08: the submit button shows a pending/disabled state while the login is in flight", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
      {
        method: "POST",
        path: "/auth/login",
        status: 200,
        json: meResponse(),
        delayMs: 80,
      },
      ...budgetShellEntries(),
    ]);
    renderApp({ initialPath: "/login" });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Welcome back" });
    await user.type(screen.getByLabelText("Email"), "qa-user@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret1");

    const submit = screen.getByRole("button", { name: "Sign in" });
    await user.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(submit).toHaveAttribute("aria-busy", "true");
  });
});
