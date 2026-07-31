import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { usePatchBudgetMutation } from "../../api/hooks.js";
import { ApiError } from "../../api/client.js";
import { parseMoneyToMinor, minorToInputValue, formatMoney } from "../../lib/money.js";
import { copy } from "../../lib/copy.js";
import "./EditBudgetDialogs.css";

/**
 * Click-to-edit planned-amount popup for one category (CR1-6). One labelled
 * money field prefilled with the current plan, a live preview of that
 * month's spending against the new plan, Cancel/Save. Reuses the proven
 * Dialog focus contract (trap, Esc, initial focus, focus return).
 */
export function EditCategoryPlanDialog({ open, category, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const patchMutation = usePatchBudgetMutation();

  useEffect(() => {
    if (open && category) {
      setAmount(minorToInputValue(category.plannedMinor));
      setFieldError("");
      setFormError("");
    }
  }, [open, category]);

  if (!category) {
    return null;
  }

  const parsedMinor = parseMoneyToMinor(amount);

  async function handleSubmit(event) {
    event.preventDefault();
    if (patchMutation.isPending) {
      return;
    }
    if (parsedMinor === null || parsedMinor < 0) {
      setFieldError(copy.budget.invalidAmountError);
      return;
    }
    setFieldError("");
    setFormError("");
    try {
      await patchMutation.mutateAsync({
        categories: [{ id: category.id, plannedMinor: parsedMinor }],
      });
      onSaved(category);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldError(Object.values(err.fieldErrors)[0] ?? copy.errors.generic);
      } else {
        setFormError(err instanceof ApiError ? err.message : copy.errors.generic);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.budget.editCategoryTitle(category.name)}
    >
      <form className="edit-budget-form" onSubmit={handleSubmit} noValidate>
        <TextInput
          label={copy.budget.plannedAmountLabel}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={fieldError}
        />

        <p className="edit-budget-preview">
          {copy.budget.spentPreview(
            formatMoney(category.actualMinor),
            parsedMinor !== null && parsedMinor >= 0
              ? formatMoney(parsedMinor)
              : formatMoney(category.plannedMinor),
          )}
        </p>

        {formError ? (
          <div className="edit-budget-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              {copy.budget.saveErrorTitle} {formError}
            </span>
          </div>
        ) : null}

        <div className="edit-budget-actions">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={patchMutation.isPending}
          >
            {copy.budget.cancelLabel}
          </Button>
          <Button
            type="submit"
            loading={patchMutation.isPending}
            disabled={patchMutation.isPending}
          >
            {formError ? copy.budget.retryLabel : copy.budget.saveLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
