import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client.js";

const AUTH_ME_KEY = ["auth", "me"];

export function useAuthMeQuery() {
  return useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: () => apiClient.get("/auth/me"),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.post("/auth/register", payload),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_ME_KEY, data);
    },
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.post("/auth/login", payload),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_ME_KEY, data);
    },
  });
}

export function useBudgetQuery(month) {
  return useQuery({
    queryKey: ["budget", month],
    queryFn: () => apiClient.get(`/budgets/${month}`),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useTransactionsQuery(month) {
  return useQuery({
    queryKey: ["transactions", month],
    queryFn: () => apiClient.get(`/budgets/${month}/transactions`),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Invalidate everything an expense mutation can change: the budget read
 * model (actuals/progress), the history list, and insights aggregates. */
function invalidateExpenseData(queryClient, month) {
  queryClient.invalidateQueries({ queryKey: ["budget", month] });
  queryClient.invalidateQueries({ queryKey: ["transactions", month] });
  queryClient.invalidateQueries({ queryKey: ["insights"] });
}

export function useCreateTransactionMutation(month) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.post(`/budgets/${month}/transactions`, payload),
    onSuccess: () => invalidateExpenseData(queryClient, month),
  });
}

export function useDeleteTransactionMutation(month) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) =>
      apiClient.delete(`/budgets/${month}/transactions/${transactionId}`),
    onSuccess: () => invalidateExpenseData(queryClient, month),
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/auth/logout"),
    onSuccess: () => {
      // Clear every cached query, not just auth/me: no private data from the
      // previous session should survive into the logged-out state.
      queryClient.clear();
    },
  });
}
