import { ArrowLeft } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton.jsx";
import { previousMonth, nextMonth, monthYearLabel } from "../../lib/dates.js";
import { copy } from "../../lib/copy.js";
import "./MonthNav.css";

/** Mirrored back-arrow for "next" — the kit's icon map defines only
 * `ArrowLeft` for navigation, used rotated per the plan. */
function ArrowRightMirrored(props) {
  return <ArrowLeft {...props} style={{ transform: "scaleX(-1)" }} />;
}

/** Previous/next month navigation on the Budget screen (D-PLN-F4). */
export function MonthNav({ month, onNavigate }) {
  return (
    <nav className="month-nav" aria-label="Change month">
      <IconButton
        icon={ArrowLeft}
        label={copy.plan.previousMonthLabel}
        onClick={() => onNavigate(previousMonth(month))}
      />
      <span className="month-nav-label" aria-live="polite">
        {monthYearLabel(month)}
      </span>
      <IconButton
        icon={ArrowRightMirrored}
        label={copy.plan.nextMonthLabel}
        onClick={() => onNavigate(nextMonth(month))}
      />
    </nav>
  );
}
