import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, setSelectedBudget, getSelectedBudget } from "../../api/client.js";
import { t } from "../../lib/locale.js";
export function BudgetSwitcher() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["sharing"],
    queryFn: () => apiClient.get("/sharing"),
    retry: false,
  });
  const budgets = query.data?.budgets;
  useEffect(() => {
    const selected = getSelectedBudget();
    if (selected && budgets && !budgets.some((b) => b.id === selected)) {
      setSelectedBudget("");
      queryClient.invalidateQueries({
        predicate: (q) => !["auth", "sharing"].includes(q.queryKey[0]),
      });
    }
  }, [budgets, queryClient]);
  if (!budgets?.length) return null;
  return (
    <label className="budget-switcher">
      {t("Budget", "תקציב")}
      <select
        value={getSelectedBudget() || budgets.find((b) => b.role === "owner")?.id || ""}
        onChange={(e) => {
          setSelectedBudget(e.target.value);
          queryClient.removeQueries({
            predicate: (q) => !["auth", "sharing"].includes(q.queryKey[0]),
          });
          window.location.reload();
        }}
      >
        {budgets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.role === "owner" ? t("My budget", "התקציב שלי") : b.owner_email}{" "}
            {b.role === "viewer" ? t("(view only)", "(צפייה בלבד)") : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
