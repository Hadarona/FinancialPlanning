import { createContext, useContext, useMemo } from "react";
import {
  useAuthMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from "../api/hooks.js";

const AuthContext = createContext(null);

/**
 * Bootstraps the session once (GET /auth/me) and exposes
 * {user, status, login, register, logout}. `status` is one of
 * "pending" | "authenticated" | "anonymous" — consumers must not render
 * private content while "pending" (D-AUTH-F3: no private-data flash).
 */
export function AuthProvider({ children }) {
  const meQuery = useAuthMeQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();

  const status = meQuery.isLoading ? "pending" : meQuery.data?.user ? "authenticated" : "anonymous";
  const user = meQuery.data?.user ?? null;

  const value = useMemo(
    () => ({
      user,
      status,
      login: (payload) => loginMutation.mutateAsync(payload),
      register: (payload) => registerMutation.mutateAsync(payload),
      logout: () => logoutMutation.mutateAsync(),
    }),
    [user, status, loginMutation, registerMutation, logoutMutation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
