import "./charts.css";

/**
 * Explicit series/category legend (a11y checklist: legends identify series
 * and categories explicitly; text wears text tokens, the marker carries the
 * color). `items`: `[{ label, detail?, color, patternStroke?, marker }]`
 * where `marker` is `"square" | "square-diagonal" | "square-dotted" |
 * "line" | "dashed-line" | "dotted-line" | "dot"`. The patterned square
 * markers mirror the CR3 grouped-bar fills so series stay identifiable
 * without color.
 */
export function Legend({ items, className = "" }) {
  return (
    <ul className={`chart-legend${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <li key={item.label} className="chart-legend-item">
          <LegendMarker
            marker={item.marker}
            color={item.color}
            patternStroke={item.patternStroke}
          />
          <span className="chart-legend-label">{item.label}</span>
          {item.detail !== undefined ? (
            <span className="chart-legend-detail">{item.detail}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function LegendMarker({ marker, color, patternStroke }) {
  if (marker === "line" || marker === "dashed-line" || marker === "dotted-line") {
    const dashArray =
      marker === "dashed-line" ? "5 4" : marker === "dotted-line" ? "2 5" : undefined;
    return (
      <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true" focusable="false">
        <line
          x1="1"
          y1="4"
          x2="23"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={dashArray}
        />
      </svg>
    );
  }
  if (marker === "square-diagonal" || marker === "square-dotted") {
    const stroke = patternStroke ?? "var(--color-surface)";
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
        focusable="false"
        className="chart-legend-marker-svg"
      >
        <rect width="14" height="14" rx="3" fill={color} />
        {marker === "square-diagonal" ? (
          <g stroke={stroke} strokeWidth="1.5">
            <line x1="-2" y1="6" x2="6" y2="-2" />
            <line x1="2" y1="12" x2="12" y2="2" />
            <line x1="8" y1="16" x2="16" y2="8" />
          </g>
        ) : (
          <g fill={stroke}>
            <circle cx="4" cy="4" r="1.4" />
            <circle cx="10" cy="4" r="1.4" />
            <circle cx="4" cy="10" r="1.4" />
            <circle cx="10" cy="10" r="1.4" />
          </g>
        )}
      </svg>
    );
  }
  return (
    <span
      className={`chart-legend-marker chart-legend-marker-${marker}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}
