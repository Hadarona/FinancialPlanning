import "./Skeleton.css";

/** Loading placeholder block. Purely decorative — parents announce loading
 * via aria-busy; the blocks themselves are hidden from assistive tech. */
export function Skeleton({ height = 16, width = "100%", className = "" }) {
  return (
    <span
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}
