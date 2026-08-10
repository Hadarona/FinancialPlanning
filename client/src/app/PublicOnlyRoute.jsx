import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

/** Keeps an already-authenticated visitor off Login/Register. */
export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === "pending") {
    return null;
  }
  if (status === "authenticated") {
    return <Navigate to="/budget" replace />;
  }
  return <Outlet />;
}
