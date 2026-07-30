import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";

// Budget/Insights are placeholders until Stage C/F build the real screens.
function BudgetPlaceholder() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Budget</h1>
      <p>Budget screen coming soon.</p>
    </main>
  );
}

function InsightsPlaceholder() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Spending insights</h1>
      <p>Insights screen coming soon.</p>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/budget" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/budget", element: <BudgetPlaceholder /> },
  { path: "/insights", element: <InsightsPlaceholder /> },
  { path: "*", element: <NotFoundPage /> },
]);
