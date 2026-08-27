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

/** Month read model (CR-001): the single budget's plans + that month's
 * actuals. Key prefix ["month"] is invalidated by every budget patch. */
export function useMonthQuery(month) {
  return useQuery({
    queryKey: ["month", month],
    queryFn: () => apiClient.get(`/months/${month}`),
    enabled: Boolean(month),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Invalidate everything a budget-plan change affects: the same plans apply
 * to every month read model, and insights render against them. */
function invalidateBudgetData(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["month"] });
  queryClient.invalidateQueries({ queryKey: ["insights"] });
}

/** PATCH /budget — in-place income/category-plan edits (CR1-5/6). */
export function usePatchBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.patch("/budget", payload),
    onSuccess: () => invalidateBudgetData(queryClient),
  });
}

/** POST /budget — the defensive "no budget yet" recovery path (CR1-11). */
export function useCreateBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/budget"),
    onSuccess: () => invalidateBudgetData(queryClient),
  });
}

/** One coherent insights payload for 1–3 selected months (CR-001 item 3).
 * `months` is a sorted-desc array; the ["insights"] key prefix is
 * invalidated by every expense/plan mutation. */
export function useInsightsQuery(months) {
  const monthsKey = (months ?? []).join(",");
  return useQuery({
    queryKey: ["insights", monthsKey],
    queryFn: () => apiClient.get(`/insights?months=${monthsKey}`),
    enabled: Boolean(months) && months.length >= 1 && months.length <= 3,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useTransactionsQuery(month) {
  return useQuery({
    queryKey: ["transactions", month],
    queryFn: () => apiClient.get(`/months/${month}/transactions`),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Invalidate everything an expense mutation can change: the month read
 * model (actuals/progress), the history list, and insights aggregates. */
function invalidateExpenseData(queryClient, month) {
  queryClient.invalidateQueries({ queryKey: ["month", month] });
  queryClient.invalidateQueries({ queryKey: ["transactions", month] });
  queryClient.invalidateQueries({ queryKey: ["insights"] });
}

export function useCreateTransactionMutation(month) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.post(`/months/${month}/transactions`, payload),
    onSuccess: () => invalidateExpenseData(queryClient, month),
  });
}

export function useDeleteTransactionMutation(month) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) =>
      apiClient.delete(`/months/${month}/transactions/${transactionId}`),
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
