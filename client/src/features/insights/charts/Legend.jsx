import "./charts.css";

/**
 * Explicit series/category legend (a11y checklist: legends identify series
 * and categories explicitly; text wears text tokens, the marker carries the
 * color). `items`: `[{ label, detail?, color, marker: "square"|"line"|"dashed-line"|"dot" }]`.
 */
export function Legend({ items, className = "" }) {
  return (
    <ul className={`chart-legend${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <li key={item.label} className="chart-legend-item">
          <LegendMarker marker={item.marker} color={item.color} />
          <span className="chart-legend-label">{item.label}</span>
          {item.detail !== undefined ? (
            <span className="chart-legend-detail">{item.detail}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function LegendMarker({ marker, color }) {
  if (marker === "line" || marker === "dashed-line") {
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
          strokeDasharray={marker === "dashed-line" ? "5 4" : undefined}
        />
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
