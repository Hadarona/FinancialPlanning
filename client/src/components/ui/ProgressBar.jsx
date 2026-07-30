import "./ProgressBar.css";

/**
 * Linear progress track (8px default). The visual fill is capped at 100%,
 * but `aria-valuenow`/text always carry the real percentage so overspending
 * is never visually understated to assistive tech (D-BUD-D2/D3).
 * `percent` may be null (zero-plan categories) — the track renders empty.
 */
export function ProgressBar({ percent, color = "blue", size = "default", label }) {
  const isOverspent = typeof percent === "number" && percent > 100;
  const fillPercent = percent === null ? 0 : Math.max(0, Math.min(percent, 100));

  return (
    <div
      className={`progress progress-${size}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent === null ? undefined : percent}
      aria-label={label}
    >
      <div
        className={`progress-fill progress-fill-${isOverspent ? "coral" : color}`}
        style={{ width: `${fillPercent}%` }}
      />
    </div>
  );
}
