import { createBrowserRouter, Navigate, useNavigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { AppHeader } from "../components/ui/AppHeader.jsx";
import { BudgetPage } from "../features/budget/BudgetPage.jsx";
import { BudgetFormPage } from "../features/budget/BudgetFormPage.jsx";
import { copy } from "../lib/copy.js";
import { useAuth } from "./AuthProvider.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { PublicOnlyRoute } from "./PublicOnlyRoute.jsx";

// Insights is a placeholder until Stage F builds the real screen;
// AppHeader (with a working Logout) is wired in.
function AuthenticatedShellPlaceholder({ title, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div>
      <AppHeader title={title} onLogout={handleLogout} />
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}

function InsightsPlaceholder() {
  return (
    <AuthenticatedShellPlaceholder title={copy.insights.title}>
      <p>Insights screen coming soon.</p>
    </AuthenticatedShellPlaceholder>
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
      { path: "/insights", element: <InsightsPlaceholder /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
