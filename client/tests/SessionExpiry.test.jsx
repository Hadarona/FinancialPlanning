import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../src/app/AuthProvider.jsx";
import { ProtectedRoute } from "../src/app/ProtectedRoute.jsx";
import { LoginPage } from "../src/pages/LoginPage.jsx";
import { NotFoundPage } from "../src/pages/NotFoundPage.jsx";
import { ErrorState } from "../src/components/ui/ErrorState.jsx";
import { apiClient } from "../src/api/client.js";

vi.mock("../src/api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

function PrivateProbe() {
  return <p>secret budget content</p>;
}

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/budget"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/budget" element={<PrivateProbe />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.get.mockImplementation((path) => {
    if (path === "/auth/me") {
      return Promise.resolve({ user: { id: "user-1", email: "a@b.com" } });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
});

describe("session expiry (D-RESP-F5)", () => {
  it("redirects to login with an explanation and drops private content on session-expired", async () => {
    renderApp();
    expect(await screen.findByText("secret budget content")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("session-expired"));
    });

    // Private content is gone, the login screen explains why.
    expect(
      await screen.findByText("Your session expired — please sign in again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("secret budget content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });
});

describe("NotFoundPage", () => {
  it("renders an in-app 404 with a route home (D-RESP-B2 client side)", () => {
    render(
      <MemoryRouter initialEntries={["/nope"]}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute("href", "/");
  });
});

describe("ErrorState offline hint", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(navigator),
    "onLine",
  );

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Object.getPrototypeOf(navigator), "onLine", originalDescriptor);
    }
  });

  it("adds an explicit offline hint when the browser reports offline", () => {
    Object.defineProperty(Object.getPrototypeOf(navigator), "onLine", {
      configurable: true,
      get: () => false,
    });
    render(<ErrorState title="Couldn't load your budget" onRetry={() => {}} />);
    expect(
      screen.getByText("You appear to be offline. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it("shows no offline hint while online", () => {
    render(<ErrorState title="Couldn't load your budget" onRetry={() => {}} />);
    expect(screen.queryByText(/appear to be offline/)).not.toBeInTheDocument();
  });
});
