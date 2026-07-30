import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

/** Renders nothing while the session bootstrap is pending, so an
 * unauthenticated visitor never sees a flash of private content
 * (D-AUTH-F3). */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "pending") {
    return null;
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
