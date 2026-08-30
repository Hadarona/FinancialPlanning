import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";
import { render } from "@testing-library/react";
import { AuthProvider } from "../../../src/app/AuthProvider.jsx";
import { ProtectedRoute } from "../../../src/app/ProtectedRoute.jsx";
import { PublicOnlyRoute } from "../../../src/app/PublicOnlyRoute.jsx";
import { LoginPage } from "../../../src/pages/LoginPage.jsx";
import { RegisterPage } from "../../../src/pages/RegisterPage.jsx";
import { NotFoundPage } from "../../../src/pages/NotFoundPage.jsx";
import { BudgetPage } from "../../../src/features/budget/BudgetPage.jsx";
import { InsightsPage } from "../../../src/features/insights/InsightsPage.jsx";

/** The real route tree (mirrors src/app/router.jsx) minus lazy-loading, so
 * QA tests exercise the actual route-guard components (ProtectedRoute /
 * PublicOnlyRoute), not a hand-rolled substitute. */
export const DEFAULT_QA_ROUTES = [
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/budget", element: <BudgetPage /> },
      { path: "/insights", element: <InsightsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

/**
 * Renders the real app shell: QueryClientProvider (retry off) + AuthProvider
 * + a createMemoryRouter built from the real route-guard components. Returns
 * the Testing Library render utilities plus the `queryClient` and `router`
 * for direct inspection/navigation.
 */
export function renderApp({ routes = DEFAULT_QA_ROUTES, initialPath = "/budget" } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, router };
}

/** Renders a single component/dialog in isolation, still wrapped with a
 * QueryClientProvider + AuthProvider + a plain MemoryRouter (for any
 * incidental router hooks), for cases that don't need the full route tree. */
export function renderWidget(ui, { initialPath = "/" } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}
