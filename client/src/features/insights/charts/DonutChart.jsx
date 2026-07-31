import { useRef, useState } from "react";
import { formatMoney } from "../../../lib/money.js";
import { donutSegments } from "./chartMath.js";
import { categoryChartColor } from "./chartColors.js";
import { ChartTooltip, tooltipHandlers } from "./ChartTooltip.jsx";
import { Legend } from "./Legend.jsx";
import { VisuallyHiddenTable } from "./VisuallyHiddenTable.jsx";
import { useMeasuredWidth } from "./useMeasuredWidth.js";
import "./charts.css";

const MAX_SIZE = 200;
const MIN_SIZE = 128;
const SEGMENT_GAP = 2; // surface gap between adjacent fills
const LEGEND_MIN = 180; // side legend column width (D-DES-007)
const LEGEND_GAP = 24; // gap between donut and side legend

/**
 * Category-share donut (Chart / Donut / Category). Segment shares use the
 * documented largest-remainder percentages from the API; the center stays
 * empty per the kit composition (D-DES-009). The legend sits beside the
 * donut only when the measured card column fits both (donut >=128px next to
 * a 180px legend), otherwise it stacks below (D-DES-007); it carries the
 * explicit "Housing 47%" identities and a hidden table mirrors the data.
 */
export function DonutChart({ categories, totalMinor, monthLabel }) {
  const figureRef = useRef(null);
  const plotRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // Container-driven layout: measure the card column, decide whether the
  // legend fits beside the donut, and size the donut (128–200px) from the
  // space it can actually use — never the viewport (D-DES-007).
  const measured = useMeasuredWidth(plotRef, MAX_SIZE);
  const besideWidth = measured - LEGEND_MIN - LEGEND_GAP;
  const legendBeside = besideWidth >= MIN_SIZE;
  const size = Math.max(
    MIN_SIZE,
    Math.min(MAX_SIZE, legendBeside ? besideWidth : measured),
  );
  const center = size / 2;
  // Ring geometry: outer 0.44×size, inner 0.20×size → inner ≈45% of outer
  // (figma-build-spec.md §6, D-DES-008); the 0.06×size margin keeps the
  // focus outline inside the SVG.
  const radius = size * 0.32;
  const strokeWidth = size * 0.24;
  const circumference = 2 * Math.PI * radius;

  const segments = donutSegments(categories.map((category) => category.currentMinor));
  const hasData = segments.length > 0;

  const caption = hasData
    ? `${monthLabel} spending shares: ${categories
        .map((category) => `${category.label} ${category.sharePercent}%`)
        .join(", ")}. Total ${formatMoney(totalMinor)}.`
    : `No ${monthLabel} spending recorded yet, so there are no category shares to show.`;

  return (
    <figure className="chart-figure" ref={figureRef}>
      <div
        className={`chart-plot donut-layout${legendBeside ? " donut-layout-row" : ""}`}
        ref={plotRef}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="presentation"
          focusable="false"
        >
          {/* Track (also the empty state's honest "nothing yet" ring). */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={hasData ? 1 : strokeWidth}
          />
          {segments.map((segment) => {
            const category = categories[segment.index];
            const length = segment.fraction * circumference;
            // Shorten each visible segment by the gap unless it is alone.
            const gap = segments.length > 1 ? SEGMENT_GAP : 0;
            const text = `${category.label} — ${monthLabel}: ${formatMoney(category.currentMinor)} USD (${category.sharePercent}%)`;
            return (
              <circle
                key={category.id}
                className="chart-mark"
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={categoryChartColor(category)}
                strokeWidth={strokeWidth}
                strokeDasharray={`${Math.max(length - gap, 1)} ${circumference - Math.max(length - gap, 1)}`}
                strokeDashoffset={-(segment.start * circumference + gap / 2)}
                transform={`rotate(-90 ${center} ${center})`}
                tabIndex={0}
                role="img"
                aria-label={text}
                {...tooltipHandlers(setTooltip, figureRef, text)}
              />
            );
          })}
        </svg>

        <Legend
          className="chart-legend-vertical"
          items={categories.map((category) => ({
            label: category.label,
            detail: `${category.sharePercent}%`,
            color: categoryChartColor(category),
            marker: "dot",
          }))}
        />
      </div>

      <figcaption className="chart-caption">{caption}</figcaption>

      <VisuallyHiddenTable
        caption={`Share of ${monthLabel} spending by category`}
        columns={["Category", "Amount", "Share"]}
        rows={categories.map((category) => [
          category.label,
          formatMoney(category.currentMinor),
          `${category.sharePercent}%`,
        ])}
      />

      <ChartTooltip tooltip={tooltip} />
    </figure>
  );
}
