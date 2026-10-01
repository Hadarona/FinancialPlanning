import { useQuery } from "@tanstack/react-query";
import { apiClient, getSelectedBudget } from "./client.js";
export function useBudgetRole() {
  const query = useQuery({
    queryKey: ["sharing"],
    queryFn: () => apiClient.get("/sharing"),
    retry: false,
  });
  const selected = getSelectedBudget();
  return query.data?.budgets?.find((b) =>
    selected ? b.id === selected : b.role === "owner",
  )?.role;
}
