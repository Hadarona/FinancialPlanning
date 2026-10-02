import { useState } from "react";
import { t } from "../../lib/locale.js";
import { Trash2 } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useTransactionsQuery } from "../../api/hooks.js";
import { categoryIcon } from "../../lib/icons.js";
import { formatMoney } from "../../lib/money.js";
import { shortDateLabel } from "../../lib/dates.js";
import { copy } from "../../lib/copy.js";
import "./ExpensePanel.css";

/**
 * Recent-expenses history for the loaded month (roadmap: add, list, delete).
 * Each delete button's accessible name identifies the exact transaction.
 */
export function ExpensePanel({ month, categories, onDeleteRequest, readOnly = false }) {
  const [offset, setOffset] = useState(0);
  const transactionsQuery = useTransactionsQuery(month, offset);
  const categoriesById = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  );

  function renderBody() {
    if (transactionsQuery.isLoading) {
      return (
        <div
          className="expense-panel-loading"
          aria-busy="true"
          aria-label="Loading expenses"
        >
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      );
    }
    if (transactionsQuery.isError) {
      return (
        <p className="expense-panel-error" role="alert">
          {copy.errors.generic}
        </p>
      );
    }
    const { transactions } = transactionsQuery.data;
    if (transactions.length === 0) {
      return <p className="expense-panel-empty">{copy.expense.emptyHistory}</p>;
    }
    return (
      <ul className="expense-list">
        {transactions.map((transaction) => {
          const category = categoriesById[transaction.categoryId];
          const Icon = categoryIcon(category?.icon);
          const categoryName = category?.name ?? transaction.categoryId;
          return (
            <li key={transaction.id} className="expense-item">
              <span
                className={`expense-item-icon category-row-icon category-row-icon-${category?.color ?? "blue"}`}
                aria-hidden="true"
              >
                {Icon ? <Icon size={20} /> : null}
              </span>
              <div className="expense-item-body">
                <span className="expense-item-title">
                  {categoryName}
                  <span className="expense-item-date">
                    {" "}
                    · {shortDateLabel(transaction.occurredOn)}
                  </span>
                </span>
                {transaction.note ? (
                  <span className="expense-item-note">{transaction.note}</span>
                ) : null}
              </div>
              <span className="expense-item-amount">
                {formatMoney(transaction.amountMinor)}
              </span>
              <IconButton
                icon={Trash2}
                disabled={readOnly}
                label={t(
                  `Delete ${categoryName} ${formatMoney(transaction.amountMinor)} on ${shortDateLabel(transaction.occurredOn)}`,
                  `מחיקת ${categoryName} ${formatMoney(transaction.amountMinor)} בתאריך ${shortDateLabel(transaction.occurredOn)}`,
                )}
                onClick={() => onDeleteRequest(transaction)}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="expense-panel" aria-label={copy.expense.historyTitle}>
      <h2 className="expense-panel-title">{copy.expense.historyTitle}</h2>
      {renderBody()}
      {(offset > 0 || transactionsQuery.data?.total > 50) && (
        <nav
          aria-label={t("Expense pages", "עמודי הוצאות")}
          className="expense-pagination"
        >
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            {t("Previous", "הקודם")}
          </button>
          <span>
            {Math.floor(offset / 50) + 1} /{" "}
            {Math.max(1, Math.ceil((transactionsQuery.data?.total ?? offset + 1) / 50))}
          </span>
          <button
            disabled={
              transactionsQuery.isLoading ||
              offset + 50 >= (transactionsQuery.data?.total ?? 0)
            }
            onClick={() => setOffset(offset + 50)}
          >
            {t("Next", "הבא")}
          </button>
        </nav>
      )}
    </section>
  );
}
