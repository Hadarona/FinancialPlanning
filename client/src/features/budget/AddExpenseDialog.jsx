import { useId, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useCreateTransactionMutation } from "../../api/hooks.js";
import { ApiError } from "../../api/client.js";
import { categoryIcon } from "../../lib/icons.js";
import { parseMoneyToMinor } from "../../lib/money.js";
import { monthLabel, monthRange, todayIsoDate } from "../../lib/dates.js";
import { copy } from "../../lib/copy.js";
import "./AddExpenseDialog.css";

const NOTE_MAX = 200;

function defaultDateFor(month) {
  const today = todayIsoDate();
  const { firstDay, lastDay } = monthRange(month);
  return today >= firstDay && today <= lastDay ? today : firstDay;
}

function validateForm({ amount, categoryId, occurredOn, note, month }) {
  const errors = {};
  const amountMinor = parseMoneyToMinor(amount);
  if (amountMinor === null) {
    errors.amount = "Enter a valid amount.";
  } else if (amountMinor <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }
  if (!categoryId) {
    errors.categoryId = "Choose a category.";
  }
  const { firstDay, lastDay } = monthRange(month);
  if (!occurredOn) {
    errors.occurredOn = "Enter a date.";
  } else if (occurredOn < firstDay || occurredOn > lastDay) {
    errors.occurredOn = `Date must be within ${monthLabel(month)}.`;
  }
  if (note.length > NOTE_MAX) {
    errors.note = `Note must be at most ${NOTE_MAX} characters.`;
  }
  return { errors, amountMinor };
}

/**
 * Add-expense form dialog (D-EXP-D1..D5, D-EXP-F1..F5). One
 * `clientRequestId` is generated per submission attempt-set (fresh per
 * dialog lifetime and after every success), so a retry after a failed save
 * — or a double-click racing the pending state — can never create a
 * duplicate (decision #8).
 */
export function AddExpenseDialog({ open, month, categories, onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => defaultDateFor(month));
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const createMutation = useCreateTransactionMutation(month);
  const categorySelectId = useId();
  const noteId = useId();
  const noteCounterId = useId();
  const noteErrorId = useId();

  const { firstDay, lastDay } = monthRange(month);
  const SelectedIcon = categoryIcon(
    categories.find((category) => category.id === categoryId)?.icon,
  );

  function resetForm() {
    setAmount("");
    setCategoryId("");
    setOccurredOn(defaultDateFor(month));
    setNote("");
    setFieldErrors({});
    setFormError("");
    clientRequestIdRef.current = crypto.randomUUID();
  }

  function handleClose() {
    // Cancel/Escape never mutates anything (D-EXP-F3).
    resetForm();
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (createMutation.isPending) {
      return;
    }
    const { errors, amountMinor } = validateForm({ amount, categoryId, occurredOn, note, month });
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length > 0) {
      return;
    }

    const trimmedNote = note.trim();
    try {
      await createMutation.mutateAsync({
        categoryId,
        amountMinor,
        occurredOn,
        ...(trimmedNote ? { note: trimmedNote } : {}),
        clientRequestId: clientRequestIdRef.current,
      });
      resetForm();
      onSuccess();
    } catch (err) {
      // Failed save keeps every value and offers retry (D-EXP-F4); the same
      // clientRequestId is reused so the retry stays idempotent.
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : copy.errors.generic);
      }
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={copy.budget.addExpenseLabel}>
      <form className="expense-form" onSubmit={handleSubmit} noValidate>
        <TextInput
          label={copy.expense.amountLabel}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={fieldErrors.amount ?? fieldErrors.amountMinor}
        />

        <div className="field">
          <label htmlFor={categorySelectId} className="field-label">
            {copy.expense.categoryLabel}
          </label>
          <div className={`field-control${fieldErrors.categoryId ? " field-control-error" : ""}`}>
            {SelectedIcon ? (
              <SelectedIcon className="field-icon" aria-hidden="true" size={20} />
            ) : null}
            <select
              id={categorySelectId}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-invalid={fieldErrors.categoryId ? "true" : undefined}
            >
              <option value="" disabled>
                {copy.expense.categoryPlaceholder}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          {fieldErrors.categoryId ? (
            <p className="field-error" role="alert">
              {fieldErrors.categoryId}
            </p>
          ) : null}
        </div>

        <TextInput
          label={copy.expense.dateLabel}
          type="date"
          min={firstDay}
          max={lastDay}
          value={occurredOn}
          onChange={(event) => setOccurredOn(event.target.value)}
          error={fieldErrors.occurredOn}
        />

        <div className="field">
          <label htmlFor={noteId} className="field-label">
            {copy.expense.noteLabel}
          </label>
          <div className={`field-control expense-note-control${fieldErrors.note ? " field-control-error" : ""}`}>
            <textarea
              id={noteId}
              rows={2}
              maxLength={NOTE_MAX + 50}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={fieldErrors.note ? "true" : undefined}
              aria-describedby={fieldErrors.note ? `${noteErrorId} ${noteCounterId}` : noteCounterId}
            />
          </div>
          <p id={noteCounterId} className="expense-note-counter">
            {note.length}/{NOTE_MAX}
          </p>
          {fieldErrors.note ? (
            <p id={noteErrorId} className="field-error" role="alert">
              {fieldErrors.note}
            </p>
          ) : null}
        </div>

        {formError ? (
          <div className="expense-form-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              {copy.expense.saveErrorTitle} {formError}
            </span>
          </div>
        ) : null}

        <div className="expense-form-actions">
          <Button variant="secondary" onClick={handleClose} disabled={createMutation.isPending}>
            {copy.expense.cancelLabel}
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
          >
            {formError ? copy.expense.retryLabel : copy.expense.saveLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
