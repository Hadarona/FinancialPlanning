import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuthMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from "../api/hooks.js";

const AuthContext = createContext(null);

/**
 * Bootstraps the session once (GET /auth/me) and exposes
 * {user, status, sessionExpired, login, register, logout}. `status` is one
 * of "pending" | "authenticated" | "anonymous" — consumers must not render
 * private content while "pending" (D-AUTH-F3: no private-data flash).
 *
 * Session expiry (D-RESP-F5): the API client dispatches `session-expired`
 * when a private call returns 401. The handler drops the cached session and
 * every cached private query (no stale private data can be re-rendered),
 * which flips `status` to "anonymous" so ProtectedRoute redirects; the
 * `sessionExpired` flag lets the login screen explain why.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const meQuery = useAuthMeQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    function handleSessionExpired() {
      setSessionExpired(true);
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
    }
    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, [queryClient]);

  const status = meQuery.isLoading
    ? "pending"
    : meQuery.data?.user
      ? "authenticated"
      : "anonymous";
  const user = meQuery.data?.user ?? null;

  const value = useMemo(
    () => ({
      user,
      status,
      sessionExpired,
      login: async (payload) => {
        const result = await loginMutation.mutateAsync(payload);
        setSessionExpired(false);
        return result;
      },
      register: async (payload) => {
        const result = await registerMutation.mutateAsync(payload);
        setSessionExpired(false);
        return result;
      },
      logout: () => logoutMutation.mutateAsync(),
    }),
    [user, status, sessionExpired, loginMutation, registerMutation, logoutMutation],
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
