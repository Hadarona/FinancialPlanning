import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import {
  Link,
  Navigate,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { ErrorState } from "../../components/ui/ErrorState.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import {
  useBudgetQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
} from "../../api/hooks.js";
import { ApiError } from "../../api/client.js";
import { DEFAULT_CATEGORIES } from "../../lib/categories.js";
import { categoryIcon } from "../../lib/icons.js";
import { parseMoneyToMinor, minorToInputValue, formatMoney } from "../../lib/money.js";
import { currentMonth, monthLabel, monthYearLabel } from "../../lib/dates.js";
import { copy } from "../../lib/copy.js";
import "./BudgetFormPage.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultFormValues() {
  return {
    income: minorToInputValue(1250000),
    plans: Object.fromEntries(
      DEFAULT_CATEGORIES.map((category) => [
        category.id,
        minorToInputValue(category.plannedMinor),
      ]),
    ),
  };
}

function budgetToFormValues(budget) {
  return {
    income: minorToInputValue(budget.incomeMinor),
    plans: Object.fromEntries(
      budget.categories.map((category) => [
        category.id,
        minorToInputValue(category.plannedMinor),
      ]),
    ),
  };
}

function sameValues(a, b) {
  return (
    a.income === b.income &&
    DEFAULT_CATEGORIES.every((category) => a.plans[category.id] === b.plans[category.id])
  );
}

/**
 * Create/edit a month's income and planned allocations (Stage E).
 * - Live "Planned · Available" preview recomputed per keystroke (D-PLN-D2).
 * - Over-allocation is allowed but visibly warned (D-PLN-D3, decision #2).
 * - Unsaved changes are guarded by a router blocker + beforeunload
 *   (D-PLN-F5); a 409 offers a recovery link to the existing month
 *   (D-PLN-F3). The category set itself is fixed and not editable here
 *   (D-PLN-F6, decision #7).
 */
export function BudgetFormPage({ mode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const requestedMonth = mode === "edit" ? params.month : searchParams.get("month");
  const month = MONTH_PATTERN.test(requestedMonth ?? "")
    ? requestedMonth
    : currentMonth();
  const monthIsValid = mode !== "edit" || MONTH_PATTERN.test(requestedMonth ?? "");

  const budgetQuery = useBudgetQuery(mode === "edit" && monthIsValid ? month : null);
  const createMutation = useCreateBudgetMutation();
  const updateMutation = useUpdateBudgetMutation(month);
  const saving = createMutation.isPending || updateMutation.isPending;

  const [values, setValues] = useState(defaultFormValues);
  const [initialValues, setInitialValues] = useState(defaultFormValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [conflict, setConflict] = useState(false);
  const prefilledRef = useRef(false);
  const savedRef = useRef(false);

  // Edit mode: prefill once from the loaded budget.
  useEffect(() => {
    if (mode === "edit" && budgetQuery.data && !prefilledRef.current) {
      prefilledRef.current = true;
      const loaded = budgetToFormValues(budgetQuery.data.budget);
      setValues(loaded);
      setInitialValues(loaded);
    }
  }, [mode, budgetQuery.data]);

  const dirty = !sameValues(values, initialValues);

  // Router blocker: never discard unsaved edits without an explicit choice.
  const blocker = useBlocker(() => dirty && !savedRef.current && !saving);

  useEffect(() => {
    if (!dirty || savedRef.current) {
      return undefined;
    }
    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  if (mode === "edit" && !monthIsValid) {
    return <Navigate to="/budget" replace />;
  }

  const incomeMinor = parseMoneyToMinor(values.income);
  const plannedMinor = DEFAULT_CATEGORIES.reduce((sum, category) => {
    const parsed = parseMoneyToMinor(values.plans[category.id]);
    return sum + (parsed !== null && parsed >= 0 ? parsed : 0);
  }, 0);
  const availableMinor = (incomeMinor ?? 0) - plannedMinor;
  const overAllocated = incomeMinor !== null && plannedMinor > incomeMinor;

  function setIncome(income) {
    setValues((prev) => ({ ...prev, income }));
  }

  function setPlan(categoryId, value) {
    setValues((prev) => ({ ...prev, plans: { ...prev.plans, [categoryId]: value } }));
  }

  function validate() {
    const errors = {};
    if (incomeMinor === null || incomeMinor < 0) {
      errors.income = "Enter a valid income.";
    }
    for (const category of DEFAULT_CATEGORIES) {
      const parsed = parseMoneyToMinor(values.plans[category.id]);
      if (parsed === null || parsed < 0) {
        errors[`plan-${category.id}`] = "Enter a valid amount.";
      }
    }
    return errors;
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const errors = validate();
    setFieldErrors(errors);
    setFormError("");
    setConflict(false);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const categories = DEFAULT_CATEGORIES.map((category) => ({
      id: category.id,
      plannedMinor: parseMoneyToMinor(values.plans[category.id]),
    }));

    try {
      if (mode === "edit") {
        await updateMutation.mutateAsync({ incomeMinor, categories });
      } else {
        await createMutation.mutateAsync({ month, incomeMinor, categories });
      }
      savedRef.current = true;
      navigate(`/budget?month=${month}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFLICT") {
        setConflict(true);
        return;
      }
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        return;
      }
      setFormError(err instanceof ApiError ? err.message : copy.errors.generic);
    }
  }

  const title = mode === "edit" ? copy.plan.editTitle : copy.plan.createTitle;

  function renderForm() {
    if (mode === "edit" && budgetQuery.isLoading) {
      return (
        <div className="plan-form-loading" aria-busy="true" aria-label="Loading budget">
          <Skeleton height={72} />
          <Skeleton height={280} />
        </div>
      );
    }
    if (mode === "edit" && budgetQuery.isError) {
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

    return (
      <form className="plan-form" onSubmit={handleSubmit} noValidate>
        <TextInput
          label={copy.plan.incomeLabel}
          inputMode="decimal"
          autoComplete="off"
          value={values.income}
          onChange={(event) => setIncome(event.target.value)}
          error={fieldErrors.income ?? fieldErrors.incomeMinor}
        />

        <ul className="plan-category-list">
          {DEFAULT_CATEGORIES.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <li key={category.id} className="plan-category-row">
                <span
                  className={`category-row-icon category-row-icon-${category.color} plan-category-icon`}
                  aria-hidden="true"
                >
                  {Icon ? <Icon size={20} /> : null}
                </span>
                <div className="plan-category-input">
                  <TextInput
                    label={category.name}
                    inputMode="decimal"
                    autoComplete="off"
                    value={values.plans[category.id]}
                    onChange={(event) => setPlan(category.id, event.target.value)}
                    error={
                      fieldErrors[`plan-${category.id}`] ?? fieldErrors[`categories`]
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="plan-totals" aria-live="polite">
          {copy.plan.plannedLabel} {formatMoney(plannedMinor)} ·{" "}
          {copy.plan.availableLabel}{" "}
          <span className={availableMinor < 0 ? "plan-totals-negative" : undefined}>
            {formatMoney(availableMinor)}
          </span>
        </p>

        {overAllocated ? (
          <p className="plan-warning" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            {copy.budget.overAllocatedWarning}
          </p>
        ) : null}

        {conflict ? (
          <p className="plan-warning" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              You already have a budget for {monthYearLabel(month)}.{" "}
              <Link to={`/budget?month=${month}`}>{copy.plan.conflictLinkLabel}</Link>
            </span>
          </p>
        ) : null}

        {formError ? (
          <p className="plan-warning" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              {copy.plan.saveErrorTitle} {formError}
            </span>
          </p>
        ) : null}

        <div className="plan-form-actions">
          <Button
            variant="secondary"
            onClick={() => navigate(`/budget?month=${month}`)}
            disabled={saving}
          >
            {copy.plan.cancelLabel}
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            {formError ? copy.plan.retryLabel : copy.plan.saveLabel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="plan-page">
      <AppHeader title={title} onLogout={handleLogout} />
      <main className="budget-main">
        <p className="budget-month-label">{monthYearLabel(month)}</p>
        {renderForm()}
      </main>

      <Dialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title={copy.plan.unsavedTitle}
      >
        <p className="plan-unsaved-body">{copy.plan.unsavedBody}</p>
        <div className="plan-form-actions">
          <Button variant="secondary" onClick={() => blocker.reset?.()}>
            {copy.plan.keepEditingLabel}
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            {copy.plan.discardLabel}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
