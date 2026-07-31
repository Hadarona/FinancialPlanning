import "./ProgressBar.css";

/**
 * Linear progress track (8px default). The visual fill is capped at 100%,
 * but `aria-valuenow`/text always carry the real percentage so overspending
 * is never visually understated to assistive tech (D-BUD-D2/D3).
 * `percent` may be null (zero-plan categories) — the track renders empty.
 *
 * `decorative` renders the same visuals with no progressbar semantics — for
 * hosts (e.g. the CR1-6 category-row button) whose own accessible name
 * already carries the full progress sentence, avoiding a nested duplicate
 * announcement.
 */
export function ProgressBar({
  percent,
  color = "blue",
  size = "default",
  label,
  decorative = false,
}) {
  const isOverspent = typeof percent === "number" && percent > 100;
  const fillPercent = percent === null ? 0 : Math.max(0, Math.min(percent, 100));

  const semantics = decorative
    ? { "aria-hidden": true }
    : {
        role: "progressbar",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": percent === null ? undefined : percent,
        "aria-label": label,
      };

  return (
    <div className={`progress progress-${size}`} {...semantics}>
      <div
        className={`progress-fill progress-fill-${isOverspent ? "coral" : color}`}
        style={{ width: `${fillPercent}%` }}
      />
    </div>
  );
}
