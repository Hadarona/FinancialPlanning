import { useRef, useState } from "react";
import { formatMoney } from "../../../lib/money.js";
import { axisScale, compactAxisLabel, linePoints } from "./chartMath.js";
import { SERIES_COLORS } from "./chartColors.js";
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

/**
 * Cumulative cash-flow comparison (Chart / Line / Cash flow). Current month
 * = solid blue line; previous month = dashed yellow line (never color
 * alone, D-INS-D1/D2). The seven sample points of each series are
 * keyboard-focusable with tooltips; a hidden table mirrors the data.
 */
export function LineChart({
  labels,
  currentSeries,
  previousSeries,
  monthLabel,
  previousMonthLabel,
  hasPrevious,
}) {
  const figureRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const width = useMeasuredWidth(containerRef);

  const MARGIN = marginsFor(width);
  const plotWidth = Math.max(90, width - MARGIN.left - MARGIN.right);
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;

  const allValues = [...currentSeries, ...(hasPrevious ? previousSeries : [])];
  const scale = axisScale(Math.max(0, ...allValues));

  const plotOptions = { max: scale.max, width: plotWidth, height: PLOT_HEIGHT };
  const currentPoints = linePoints(currentSeries, plotOptions);
  const previousPoints = hasPrevious ? linePoints(previousSeries, plotOptions) : [];

  function toPath(points) {
    return points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${MARGIN.left + point.x},${MARGIN.top + point.y}`,
      )
      .join(" ");
  }

  // First / middle / last x labels keep the axis readable at 320px.
  const labelIndexes = [0, Math.floor((labels.length - 1) / 2), labels.length - 1];

  const currentEnd = currentSeries[currentSeries.length - 1] ?? 0;
  const previousEnd = hasPrevious
    ? (previousSeries[previousSeries.length - 1] ?? 0)
    : null;
  const caption = hasPrevious
    ? `Cumulative spending through ${monthLabel} reached ${formatMoney(currentEnd)}, versus ${formatMoney(previousEnd)} through ${previousMonthLabel}.`
    : `Cumulative spending through ${monthLabel} reached ${formatMoney(currentEnd)}. No ${previousMonthLabel} data to compare.`;

  function renderPoints(points, series, seriesLabel, color) {
    return points.map((point, index) => {
      const text = `${labels[index]} — ${seriesLabel}: ${formatMoney(series[index])} USD`;
      return (
        <circle
          key={`${seriesLabel}-${labels[index]}`}
          className="chart-mark"
          cx={MARGIN.left + point.x}
          cy={MARGIN.top + point.y}
          r={4.5}
          fill={color}
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
            const point = currentPoints[index];
            if (!point) {
              return null;
            }
            return (
              <text
                key={labels[index]}
                className="chart-x-label"
                x={MARGIN.left + point.x}
                y={MARGIN.top + PLOT_HEIGHT + 20}
                textAnchor={
                  index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"
                }
              >
                {labels[index]}
              </text>
            );
          })}

          {hasPrevious ? (
            <path
              d={toPath(previousPoints)}
              fill="none"
              stroke={SERIES_COLORS.previous}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          ) : null}
          <path
            d={toPath(currentPoints)}
            fill="none"
            stroke={SERIES_COLORS.current}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {hasPrevious
            ? renderPoints(
                previousPoints,
                previousSeries,
                previousMonthLabel,
                SERIES_COLORS.previous,
              )
            : null}
          {renderPoints(currentPoints, currentSeries, monthLabel, SERIES_COLORS.current)}
        </svg>
      </div>

      <figcaption className="chart-caption">{caption}</figcaption>

      <Legend
        items={[
          { label: monthLabel, color: SERIES_COLORS.current, marker: "line" },
          ...(hasPrevious
            ? [
                {
                  label: previousMonthLabel,
                  color: SERIES_COLORS.previous,
                  marker: "dashed-line",
                },
              ]
            : []),
        ]}
      />

      <VisuallyHiddenTable
        caption={`Cumulative spending by date: ${monthLabel}${hasPrevious ? ` and ${previousMonthLabel}` : ""}`}
        columns={["Date", monthLabel, ...(hasPrevious ? [previousMonthLabel] : [])]}
        rows={labels.map((label, index) => [
          label,
          formatMoney(currentSeries[index]),
          ...(hasPrevious ? [formatMoney(previousSeries[index])] : []),
        ])}
      />

      <ChartTooltip tooltip={tooltip} />
    </figure>
  );
}
