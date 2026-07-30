import { TriangleAlert } from "lucide-react";
import { ProgressBar } from "../../components/ui/ProgressBar.jsx";
import { categoryIcon } from "../../lib/icons.js";
import { formatMoney } from "../../lib/money.js";
import { copy } from "../../lib/copy.js";
import "./CategoryRow.css";

/**
 * Screen-reader progress sentence (D-BUD-F6), e.g.
 * "Housing: 2,520 spent of 4,000 planned, 63%".
 */
export function categoryProgressText(category) {
  const base = `${category.name}: ${formatMoney(category.actualMinor)} spent of ${formatMoney(
    category.plannedMinor,
  )} planned`;
  if (category.state === "unplanned") {
    return `${base}, ${copy.budget.unplannedLabel}`;
  }
  if (category.progressPercent === null) {
    return base;
  }
  const suffix = category.state === "overspent" ? `, ${copy.budget.overPlanLabel}` : "";
  return `${base}, ${category.progressPercent}%${suffix}`;
}

/**
 * One budget category row per the approved compositions: tinted icon
 * circle, label, planned amount, progress track. Overspending and unplanned
 * spending are conveyed with an icon + text, never color alone (D-BUD-D3).
 */
export function CategoryRow({ category }) {
  const Icon = categoryIcon(category.icon);
  const isOverspent = category.state === "overspent";
  const isUnplanned = category.state === "unplanned";
  const progressText = categoryProgressText(category);

  return (
    <li className="category-row">
      <span className={`category-row-icon category-row-icon-${category.color}`} aria-hidden="true">
        {Icon ? <Icon size={24} /> : null}
      </span>
      <div className="category-row-body">
        <div className="category-row-top">
          <span className="category-row-name" aria-hidden="true">
            {category.name}
          </span>
          {isOverspent || isUnplanned ? (
            <span className="category-row-flag" aria-hidden="true">
              <TriangleAlert size={14} />
              {isOverspent ? copy.budget.overPlanLabel : copy.budget.unplannedLabel}
            </span>
          ) : null}
          <span className="category-row-amount" aria-hidden="true">
            {formatMoney(category.plannedMinor)}
          </span>
        </div>
        <ProgressBar
          percent={category.progressPercent}
          color={category.color}
          label={progressText}
        />
      </div>
    </li>
  );
}
