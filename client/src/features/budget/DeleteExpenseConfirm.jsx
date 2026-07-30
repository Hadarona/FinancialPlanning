import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { useDeleteTransactionMutation } from "../../api/hooks.js";
import { formatMoney } from "../../lib/money.js";
import { shortDateLabel } from "../../lib/dates.js";
import { copy } from "../../lib/copy.js";
import "./DeleteExpenseConfirm.css";

/**
 * Explicit delete confirmation that names the exact transaction
 * (D-EXP-D4). Cancel is a strict no-op (D-EXP-F6).
 */
export function DeleteExpenseConfirm({
  open,
  month,
  transaction,
  categoryName,
  onClose,
  onDeleted,
}) {
  const deleteMutation = useDeleteTransactionMutation(month);
  const [error, setError] = useState("");

  function handleClose() {
    setError("");
    onClose();
  }

  async function handleDelete() {
    if (deleteMutation.isPending || !transaction) {
      return;
    }
    setError("");
    try {
      await deleteMutation.mutateAsync(transaction.id);
      onDeleted();
    } catch {
      setError(copy.expense.deleteErrorTitle);
    }
  }

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} title={copy.expense.deleteTitle}>
      <p className="delete-expense-text">
        Delete {categoryName} {formatMoney(transaction.amountMinor)} on{" "}
        {shortDateLabel(transaction.occurredOn)}? This can&apos;t be undone.
      </p>
      {error ? (
        <p className="delete-expense-error" role="alert">
          <TriangleAlert size={16} aria-hidden="true" /> {error}
        </p>
      ) : null}
      <div className="delete-expense-actions">
        <Button
          variant="secondary"
          onClick={handleClose}
          disabled={deleteMutation.isPending}
        >
          {copy.expense.cancelLabel}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          loading={deleteMutation.isPending}
          disabled={deleteMutation.isPending}
        >
          {copy.expense.deleteConfirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
