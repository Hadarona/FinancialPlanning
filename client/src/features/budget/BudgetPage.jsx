import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { ErrorState } from "../../components/ui/ErrorState.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import { useMonthQuery, useCreateBudgetMutation } from "../../api/hooks.js";
import { copy } from "../../lib/copy.js";
import { currentMonth } from "../../lib/dates.js";
import { SummaryMetrics } from "./SummaryMetrics.jsx";
import { CategoryRow } from "./CategoryRow.jsx";
import { MonthNav } from "./MonthNav.jsx";
import { ExpensePanel } from "./ExpensePanel.jsx";
import { AddExpenseDialog } from "./AddExpenseDialog.jsx";
import { DeleteExpenseConfirm } from "./DeleteExpenseConfirm.jsx";
import { EditIncomeDialog } from "./EditIncomeDialog.jsx";
import { EditCategoryPlanDialog } from "./EditCategoryPlanDialog.jsx";
import "./BudgetPage.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function BudgetSkeleton() {
  return (
    <div className="budget-loading" aria-busy="true" aria-label="Loading budget">
      <Skeleton height={96} />
      {[1, 2, 3, 4, 5, 6, 7].map((row) => (
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
  const month = MONTH_PATTERN.test(requestedMonth ?? "")
    ? requestedMonth
    : currentMonth();

  const monthQuery = useMonthQuery(month);
  const createBudgetMutation = useCreateBudgetMutation();
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefillCategoryId, setAddPrefillCategoryId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editIncomeOpen, setEditIncomeOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
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

  async function handleCreateBudget() {
    // Defensive recovery for the "no budget row" data anomaly (CR1-11):
    // POST /budget provisions the defaults, then the month model refetches.
    try {
      await createBudgetMutation.mutateAsync();
      announce(copy.budget.budgetCreatedStatus);
    } catch {
      // The query error state keeps rendering; nothing extra to do here.
    }
  }

  function renderContent() {
    if (monthQuery.isLoading) {
      return <BudgetSkeleton />;
    }
    if (monthQuery.isError) {
      if (monthQuery.error?.code === "NOT_FOUND") {
        return (
          <EmptyState
            title={copy.budget.emptyTitle}
            description={copy.budget.emptyDescription}
            actionLabel={copy.budget.createBudgetLabel}
            onAction={handleCreateBudget}
          />
        );
      }
      return (
        <ErrorState
          title={copy.budget.loadErrorTitle}
          description={copy.budget.loadErrorDescription}
          retryLabel={copy.budget.retryLabel}
          onRetry={() => monthQuery.refetch()}
        />
      );
    }

    const { budget } = monthQuery.data;
    return (
      <>
        <SummaryMetrics
          incomeMinor={budget.incomeMinor}
          plannedMinor={budget.plannedMinor}
          availableMinor={budget.availableMinor}
          onEditIncome={() => setEditIncomeOpen(true)}
        />
        <ul className="budget-category-list">
          {budget.categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onEdit={(selected) => setEditCategory(selected)}
              onAddExpense={(selected) => {
                setAddPrefillCategoryId(selected.id);
                setAddOpen(true);
              }}
            />
          ))}
        </ul>
        <Button
          className="budget-add-expense"
          onClick={() => {
            setAddPrefillCategoryId("");
            setAddOpen(true);
          }}
        >
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
          initialCategoryId={addPrefillCategoryId}
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
            budget.categories.find((category) => category.id === deleteTarget?.categoryId)
              ?.name ?? deleteTarget?.categoryId
          }
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            announce(copy.expense.deletedStatus);
          }}
        />
        <EditIncomeDialog
          open={editIncomeOpen}
          budget={budget}
          onClose={() => setEditIncomeOpen(false)}
          onSaved={() => {
            setEditIncomeOpen(false);
            announce(copy.budget.incomeUpdatedStatus);
          }}
        />
        <EditCategoryPlanDialog
          open={editCategory !== null}
          category={editCategory}
          onClose={() => setEditCategory(null)}
          onSaved={(category) => {
            setEditCategory(null);
            announce(copy.budget.categoryUpdatedStatus(category.name));
          }}
        />
      </>
    );
  }

  return (
    <div className="budget-page">
      <AppHeader
        title={copy.budget.title}
        onLogout={handleLogout}
        menuItems={[
          {
            label: copy.insights.menuLabel,
            onSelect: () => navigate("/insights"),
          },
        ]}
      />
      <main className="budget-main">
        <MonthNav
          month={month}
          onNavigate={(nextValue) => navigate(`/budget?month=${nextValue}`)}
        />
        {renderContent()}
        <p role="status" aria-live="polite" className="budget-status">
          {statusMessage}
        </p>
      </main>
    </div>
  );
}
