import { createBrowserRouter, Navigate, useNavigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { AppHeader } from "../components/ui/AppHeader.jsx";
import { copy } from "../lib/copy.js";
import { useAuth } from "./AuthProvider.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { PublicOnlyRoute } from "./PublicOnlyRoute.jsx";

// Budget/Insights are placeholders until Stage C/F build the real screens;
// AppHeader (with a working Logout) is wired in now since Stage B owns it.
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

function BudgetPlaceholder() {
  return (
    <AuthenticatedShellPlaceholder title={copy.budget.title}>
      <p>Budget screen coming soon.</p>
    </AuthenticatedShellPlaceholder>
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
      { path: "/budget", element: <BudgetPlaceholder /> },
      { path: "/insights", element: <InsightsPlaceholder /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
