import { TriangleAlert } from "lucide-react";
import { Card } from "../../components/ui/Card.jsx";
import { formatMoney } from "../../lib/money.js";
import { copy } from "../../lib/copy.js";
import "./SummaryMetrics.css";

/**
 * Three summary metrics (Income / Planned / Available) per the approved
 * Budget compositions. A negative Available (over-allocation is allowed,
 * decision #2) is conveyed with coral color PLUS an icon and warning text —
 * never color alone (D-PLN-D3 groundwork).
 */
export function SummaryMetrics({ incomeMinor, plannedMinor, availableMinor }) {
  const overAllocated = availableMinor < 0;

  return (
    <Card className="summary-metrics-card">
      <dl className="summary-metrics">
        <div className="summary-metric">
          <dt className="summary-metric-label summary-metric-label-income">
            {copy.budget.incomeLabel}
          </dt>
          <dd className="summary-metric-value summary-metric-value-income">
            {formatMoney(incomeMinor)}
          </dd>
        </div>
        <div className="summary-metric">
          <dt className="summary-metric-label summary-metric-label-planned">
            {copy.budget.plannedLabel}
          </dt>
          <dd className="summary-metric-value">{formatMoney(plannedMinor)}</dd>
        </div>
        <div className="summary-metric">
          <dt className="summary-metric-label">{copy.budget.availableLabel}</dt>
          <dd
            className={`summary-metric-value ${
              overAllocated
                ? "summary-metric-value-negative"
                : "summary-metric-value-available"
            }`}
          >
            {formatMoney(availableMinor)}
          </dd>
        </div>
      </dl>
      {overAllocated ? (
        <p className="summary-metrics-warning">
          <TriangleAlert size={16} aria-hidden="true" />
          {copy.budget.overAllocatedWarning}
        </p>
      ) : null}
    </Card>
  );
}
