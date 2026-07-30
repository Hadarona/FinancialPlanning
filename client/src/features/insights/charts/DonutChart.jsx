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

/**
 * Category-share donut (Chart / Donut / Category). Segment shares use the
 * documented largest-remainder percentages from the API; the center shows
 * the month's total. Legend (right >=768px, below otherwise) carries the
 * explicit "Housing 47%" identities; a hidden table mirrors the data.
 */
export function DonutChart({ categories, totalMinor, monthLabel }) {
  const figureRef = useRef(null);
  const plotRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // The donut renders at its measured column width (128–200px) with fixed
  // font sizes, so the center total stays legible in a narrow two-up
  // mobile column (D-INS-D5/D6).
  const measured = useMeasuredWidth(plotRef, MAX_SIZE);
  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, measured));
  const center = size / 2;
  const radius = size * 0.37;
  const strokeWidth = size * 0.13;
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
      <div className="chart-plot donut-layout" ref={plotRef}>
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
          <text className="donut-center-value" x={center} y={center} textAnchor="middle">
            {formatMoney(totalMinor)}
          </text>
          <text className="donut-center-label" x={center} y={center + 20} textAnchor="middle">
            {monthLabel}
          </text>
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
