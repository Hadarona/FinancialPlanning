import { Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { ErrorState } from "../../components/ui/ErrorState.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import { useBudgetQuery } from "../../api/hooks.js";
import { copy } from "../../lib/copy.js";
import { currentMonth, monthLabel } from "../../lib/dates.js";
import { SummaryMetrics } from "./SummaryMetrics.jsx";
import { CategoryRow } from "./CategoryRow.jsx";
import "./BudgetPage.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function BudgetSkeleton() {
  return (
    <div className="budget-loading" aria-busy="true" aria-label="Loading budget">
      <Skeleton height={96} />
      {[1, 2, 3, 4, 5].map((row) => (
        <Skeleton key={row} height={64} />
      ))}
    </div>
  );
}

export function BudgetPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMonth = searchParams.get("month");
  const month = MONTH_PATTERN.test(requestedMonth ?? "") ? requestedMonth : currentMonth();

  const budgetQuery = useBudgetQuery(month);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function renderContent() {
    if (budgetQuery.isLoading) {
      return <BudgetSkeleton />;
    }
    if (budgetQuery.isError) {
      if (budgetQuery.error?.code === "NOT_FOUND") {
        return (
          <EmptyState
            title={`No budget for ${monthLabel(month)} yet`}
            description={copy.budget.emptyDescription}
            actionLabel={copy.budget.createBudgetLabel}
            onAction={() => navigate(`/budget/new?month=${month}`)}
          />
        );
      }
      return (
        <ErrorState
          title={copy.budget.loadErrorTitle}
          description={copy.budget.loadErrorDescription}
          retryLabel={copy.budget.retryLabel}
          onRetry={() => budgetQuery.refetch()}
        />
      );
    }

    const { budget } = budgetQuery.data;
    return (
      <>
        <SummaryMetrics
          incomeMinor={budget.incomeMinor}
          plannedMinor={budget.plannedMinor}
          availableMinor={budget.availableMinor}
        />
        <ul className="budget-category-list">
          {budget.categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
        {/* Wired to the expense dialog in Stage D. */}
        <Button className="budget-add-expense" disabled title="Available soon">
          <Plus size={24} aria-hidden="true" />
          {copy.budget.addExpenseLabel}
        </Button>
      </>
    );
  }

  return (
    <div className="budget-page">
      <AppHeader title={copy.budget.title} onLogout={handleLogout} />
      <main className="budget-main">
        <p className="budget-month-label">{monthLabel(month)}</p>
        {renderContent()}
      </main>
    </div>
  );
}
