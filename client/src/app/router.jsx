import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { BudgetPage } from "../features/budget/BudgetPage.jsx";
import { BudgetFormPage } from "../features/budget/BudgetFormPage.jsx";
import { Skeleton } from "../components/ui/Skeleton.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { PublicOnlyRoute } from "./PublicOnlyRoute.jsx";

// The Insights screen (three SVG charts) is code-split off the main bundle
// (Stage G): the suspense fallback mirrors the page's own skeleton sizes so
// there is no layout shift when the chunk arrives.
const InsightsPage = lazy(() =>
  import("../features/insights/InsightsPage.jsx").then((module) => ({
    default: module.InsightsPage,
  })),
);

function InsightsRouteFallback() {
  return (
    <div aria-busy="true" aria-label="Loading insights" style={{ padding: "var(--space-5)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Skeleton height={56} />
        <Skeleton height={88} />
        <Skeleton height={280} />
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
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
      { path: "/", element: <Navigate to="/budget" replace /> },
      { path: "/budget", element: <BudgetPage /> },
      { path: "/budget/new", element: <BudgetFormPage mode="create" /> },
      { path: "/budget/:month/edit", element: <BudgetFormPage mode="edit" /> },
      {
        path: "/insights",
        element: (
          <Suspense fallback={<InsightsRouteFallback />}>
            <InsightsPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
