import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { BudgetPage } from "../features/budget/BudgetPage.jsx";
import { BudgetFormPage } from "../features/budget/BudgetFormPage.jsx";
import { InsightsPage } from "../features/insights/InsightsPage.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { PublicOnlyRoute } from "./PublicOnlyRoute.jsx";

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
      { path: "/insights", element: <InsightsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
