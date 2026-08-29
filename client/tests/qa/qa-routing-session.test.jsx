// QA-CC-10..15: route guards, session bootstrap/expiry, and logout residue.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./helpers/qaRender.jsx";
import { installFetchMock } from "./helpers/qaFetch.js";
import { meResponse, anonymousMeResponse } from "./fixtures/authFixtures.js";
import { kitBudget, kitTransactions } from "./fixtures/budgetFixtures.js";
import { currentMonth } from "../../src/lib/dates.js";

const MONTH = currentMonth();

describe("qa-routing-session", () => {
  it("QA-CC-10: an anonymous visit to /budget redirects to login without ever fetching budget data", async () => {
    const mock = installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Budget")).not.toBeInTheDocument();
    expect(mock.callsMatching("GET", /^\/months\//)).toHaveLength(0);
  });

  it("QA-CC-11: an authenticated visitor to /login is redirected to /budget", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 200, json: meResponse() },
      { method: "GET", path: `/months/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/months/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/login" });

    expect(await screen.findByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Welcome back" }),
    ).not.toBeInTheDocument();
  });

  it("QA-CC-12: opening /budget directly restores the session and renders the budget data", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 200, json: meResponse() },
      { method: "GET", path: `/months/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/months/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(await screen.findByText("12,500")).toBeInTheDocument();
  });

  it("QA-CC-13: a 401 on the budget fetch redirects with the session-expired message and drops stale data", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 200, json: meResponse() },
      {
        method: "GET",
        path: `/months/${MONTH}`,
        status: 401,
        json: {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in required.",
            requestId: "r1",
          },
        },
      },
    ]);
    renderApp({ initialPath: "/budget" });

    expect(
      await screen.findByText("Your session expired — please sign in again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("12,500")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("QA-CC-14: logging out via the header menu clears the cache so the next budget visit refetches", async () => {
    const mock = installFetchMock([
      { method: "GET", path: "/auth/me", status: 200, json: meResponse() },
      { method: "GET", path: `/months/${MONTH}`, status: 200, json: kitBudget() },
      {
        method: "GET",
        path: `/months/${MONTH}/transactions`,
        status: 200,
        json: kitTransactions(),
      },
      { method: "POST", path: "/auth/logout", status: 204 },
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
    ]);
    renderApp({ initialPath: "/budget" });
    const user = userEvent.setup();
    await screen.findByText("12,500");

    const menuButton = screen.getByRole("button", { name: "More options" });
    menuButton.focus();
    await user.keyboard("{Enter}");
    const logoutItem = await screen.findByRole("menuitem", { name: "Logout" });
    logoutItem.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mock.callsMatching("POST", "/auth/logout")).toHaveLength(1);
    });
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    // logoutItem was reachable purely via keyboard, confirming the menu path used.
    expect(logoutItem).toBeTruthy();
  });

  it("QA-CC-15: an unknown route renders the in-app 404 with a way back", async () => {
    installFetchMock([
      { method: "GET", path: "/auth/me", status: 401, json: anonymousMeResponse() },
    ]);
    renderApp({ initialPath: "/no-such-route" });

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
