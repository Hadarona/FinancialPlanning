import { useRef, useState } from "react";
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
import { ExpensePanel } from "./ExpensePanel.jsx";
import { AddExpenseDialog } from "./AddExpenseDialog.jsx";
import { DeleteExpenseConfirm } from "./DeleteExpenseConfirm.jsx";
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
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const statusTimerRef = useRef(null);

  function announce(message) {
    setStatusMessage(message);
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(""), 5000);
  }

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
        <Button className="budget-add-expense" onClick={() => setAddOpen(true)}>
          <Plus size={24} aria-hidden="true" />
          {copy.budget.addExpenseLabel}
        </Button>
        <ExpensePanel
          month={month}
          categories={budget.categories}
          onDeleteRequest={(transaction) => setDeleteTarget(transaction)}
        />
        <AddExpenseDialog
          open={addOpen}
          month={month}
          categories={budget.categories}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            announce(copy.expense.addedStatus);
          }}
        />
        <DeleteExpenseConfirm
          open={deleteTarget !== null}
          month={month}
          transaction={deleteTarget}
          categoryName={
            budget.categories.find((category) => category.id === deleteTarget?.categoryId)?.name ??
            deleteTarget?.categoryId
          }
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            announce(copy.expense.deletedStatus);
          }}
        />
      </>
    );
  }

  return (
    <div className="budget-page">
      <AppHeader title={copy.budget.title} onLogout={handleLogout} />
      <main className="budget-main">
        <p className="budget-month-label">{monthLabel(month)}</p>
        {renderContent()}
        <p role="status" aria-live="polite" className="budget-status">
          {statusMessage}
        </p>
      </main>
    </div>
  );
}
