import { useRef, useState } from "react";
import { formatMoney } from "../../../lib/money.js";
import { axisScale, compactAxisLabel, linePoints, xLabelIndexes } from "./chartMath.js";
import {
  SERIES_COLORS,
  SERIES_LINE_DASHES,
  SERIES_LEGEND_LINE_MARKERS,
} from "./chartColors.js";
import { ChartTooltip, tooltipHandlers } from "./ChartTooltip.jsx";
import { Legend } from "./Legend.jsx";
import { VisuallyHiddenTable } from "./VisuallyHiddenTable.jsx";
import { useMeasuredWidth } from "./useMeasuredWidth.js";
import "./charts.css";

const PLOT_HEIGHT = 200;

/** Compact margins below ~240px keep the plot usable in a narrow two-up
 * mobile column (compact tick labels like "5K" need less gutter). */
function marginsFor(width) {
  return width < 240
    ? { top: 12, right: 8, bottom: 28, left: 34 }
    : { top: 12, right: 12, bottom: 28, left: 48 };
}

/** Shared 7-position x axis: each month's own sample days align by index
 * (1/6/11/16/21/26/last). With one month the month's own date labels show;
 * with several, mixed-month date labels would mislead, so the axis shows
 * the day-of-month positions instead (CR3-4). */
function positionLabels(months) {
  if (months.length === 1) {
    return months[0].cashFlow.labels;
  }
  return ["1", "6", "11", "16", "21", "26", "End"];
}

/**
 * Cumulative cash-flow comparison for 1–3 selected months (CR3-4), newest
 * first. Series pair a kit color with a line style (solid / dashed /
 * dotted) so they never differ by color alone. The seven sample points of
 * each series are keyboard-focusable with tooltips; a hidden table mirrors
 * the data.
 *
 * `months`: `[{ month, label, yearLabel,
 *               cashFlow: { labels: string[], cumulativeMinor: number[] } }]`.
 */
export function LineChart({ months }) {
  const figureRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const width = useMeasuredWidth(containerRef);

  const MARGIN = marginsFor(width);
  const plotWidth = Math.max(90, width - MARGIN.left - MARGIN.right);
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;

  const allValues = months.flatMap((entry) => entry.cashFlow.cumulativeMinor);
  const scale = axisScale(Math.max(0, ...allValues));

  const plotOptions = { max: scale.max, width: plotWidth, height: PLOT_HEIGHT };
  const seriesPoints = months.map((entry) =>
    linePoints(entry.cashFlow.cumulativeMinor, plotOptions),
  );

  function toPath(points) {
    return points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${MARGIN.left + point.x},${MARGIN.top + point.y}`,
      )
      .join(" ");
  }

  const axisLabels = positionLabels(months);
  // Width-aware x labels never collide (D-DES-010): first/middle/last on
  // wide plots, first + last only in a narrow two-up column.
  const labelIndexes = xLabelIndexes(axisLabels.length, plotWidth);

  const caption = `Cumulative spending: ${months
    .map(
      (entry) =>
        `${formatMoney(entry.cashFlow.cumulativeMinor.at(-1) ?? 0)} through ${entry.yearLabel}`,
    )
    .join(", ")}.`;

  function renderPoints(entry, slotIndex) {
    return seriesPoints[slotIndex].map((point, index) => {
      const text = `${entry.cashFlow.labels[index]} — ${entry.yearLabel}: ${formatMoney(
        entry.cashFlow.cumulativeMinor[index],
      )} USD`;
      return (
        <circle
          key={`${entry.month}-${entry.cashFlow.labels[index]}`}
          className="chart-mark chart-mark-hover"
          cx={MARGIN.left + point.x}
          cy={MARGIN.top + point.y}
          r={4.5}
          fill={SERIES_COLORS[slotIndex]}
          stroke="var(--color-surface)"
          strokeWidth={2}
          tabIndex={0}
          role="img"
          aria-label={text}
          {...tooltipHandlers(setTooltip, figureRef, text)}
        />
      );
    });
  }

  return (
    <figure className="chart-figure" ref={figureRef}>
      <div className="chart-plot" ref={containerRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="presentation"
          focusable="false"
        >
          {scale.ticks.map((tick) => {
            const y = MARGIN.top + PLOT_HEIGHT - (tick / scale.max) * PLOT_HEIGHT;
            return (
              <g key={tick}>
                <line
                  className="chart-gridline"
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotWidth}
                  y1={y}
                  y2={y}
                />
                <text
                  className="chart-axis-label"
                  x={MARGIN.left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {compactAxisLabel(tick)}
                </text>
              </g>
            );
          })}

          {labelIndexes.map((index) => {
            const point = seriesPoints[0]?.[index];
            if (!point) {
              return null;
            }
            return (
              <text
                key={axisLabels[index]}
                className="chart-x-label"
                x={MARGIN.left + point.x}
                y={MARGIN.top + PLOT_HEIGHT + 20}
                textAnchor={
                  index === 0
                    ? "start"
                    : index === axisLabels.length - 1
                      ? "end"
                      : "middle"
                }
              >
                {axisLabels[index]}
              </text>
            );
          })}

          {/* Older series first so the newest month draws on top. */}
          {[...months.keys()].reverse().map((slotIndex) => (
            <path
              key={months[slotIndex].month}
              d={toPath(seriesPoints[slotIndex])}
              fill="none"
              stroke={SERIES_COLORS[slotIndex]}
              strokeWidth={2}
              strokeDasharray={SERIES_LINE_DASHES[slotIndex]}
              strokeLinecap="round"
            />
          ))}

          {[...months.keys()]
            .reverse()
            .map((slotIndex) => renderPoints(months[slotIndex], slotIndex))}
        </svg>
      </div>

      <figcaption className="chart-caption">{caption}</figcaption>

      <Legend
        items={months.map((entry, slotIndex) => ({
          label: entry.yearLabel,
          color: SERIES_COLORS[slotIndex],
          marker: SERIES_LEGEND_LINE_MARKERS[slotIndex],
        }))}
      />

      <VisuallyHiddenTable
        caption={`Cumulative spending by date: ${months
          .map((entry) => entry.yearLabel)
          .join(", ")}`}
        columns={["Sample day", ...months.map((entry) => entry.yearLabel)]}
        rows={axisLabels.map((label, index) => [
          label,
          ...months.map((entry) => formatMoney(entry.cashFlow.cumulativeMinor[index])),
        ])}
      />

      <ChartTooltip tooltip={tooltip} />
    </figure>
  );
}
