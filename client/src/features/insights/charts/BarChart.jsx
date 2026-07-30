import { useId, useRef, useState } from "react";
import { formatMoney } from "../../../lib/money.js";
import { axisScale, compactAxisLabel, barTopRoundedPath } from "./chartMath.js";
import { SERIES_COLORS } from "./chartColors.js";
import { ChartTooltip, tooltipHandlers } from "./ChartTooltip.jsx";
import { Legend } from "./Legend.jsx";
import { VisuallyHiddenTable } from "./VisuallyHiddenTable.jsx";
import { useMeasuredWidth } from "./useMeasuredWidth.js";
import "./charts.css";

const MARGIN = { top: 12, right: 8, bottom: 28, left: 48 };
const PLOT_HEIGHT = 200;
const ROTATED_LABEL_EXTRA = 24;

/**
 * Grouped monthly-comparison bar chart (Chart / Bar / Monthly comparison).
 * Current month = solid blue; previous month = yellow with a diagonal-line
 * pattern so the series differ beyond color (D-INS-D1/D2). Every bar is
 * keyboard-focusable with a tooltip and an aria-label; a hidden table
 * mirrors the data (D-INS-D3/F4).
 */
export function BarChart({ categories, monthLabel, previousMonthLabel, hasPrevious }) {
  const figureRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const patternId = useId();
  const width = useMeasuredWidth(containerRef);

  const plotWidth = Math.max(120, width - MARGIN.left - MARGIN.right);
  const groupWidth = plotWidth / categories.length;
  // Compact alternative below ~56px per label: rotate the category labels
  // so full words stay legible at 320px (D-INS-D5).
  const rotateLabels = groupWidth < 56;
  const height =
    MARGIN.top + PLOT_HEIGHT + MARGIN.bottom + (rotateLabels ? ROTATED_LABEL_EXTRA : 0);

  const allValues = categories.flatMap((category) =>
    hasPrevious
      ? [category.currentMinor, category.previousMinor]
      : [category.currentMinor],
  );
  const scale = axisScale(Math.max(0, ...allValues));

  const barWidth = Math.min(24, Math.max(10, groupWidth / 4));
  const pairGap = 2; // surface gap between the two bars of a pair

  function barGeometry(value, slotIndex, groupIndex) {
    const groupStart = MARGIN.left + groupIndex * groupWidth;
    const pairWidth = hasPrevious ? barWidth * 2 + pairGap : barWidth;
    const x =
      groupStart + (groupWidth - pairWidth) / 2 + slotIndex * (barWidth + pairGap);
    const barHeight = (value / scale.max) * PLOT_HEIGHT;
    const yTop = MARGIN.top + PLOT_HEIGHT - barHeight;
    return { x, yTop, barHeight };
  }

  const caption = hasPrevious
    ? `Spending by category, ${monthLabel} versus ${previousMonthLabel}: ${categories
        .map(
          (category) =>
            `${category.label} ${formatMoney(category.currentMinor)} vs ${formatMoney(category.previousMinor)}`,
        )
        .join("; ")}.`
    : `Spending by category in ${monthLabel}: ${categories
        .map((category) => `${category.label} ${formatMoney(category.currentMinor)}`)
        .join("; ")}. No ${previousMonthLabel} data to compare.`;

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
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill={SERIES_COLORS.previous} />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="var(--color-yellow-700)"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>

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

          {categories.map((category, groupIndex) => {
            const labelX = MARGIN.left + groupIndex * groupWidth + groupWidth / 2;
            const labelY = MARGIN.top + PLOT_HEIGHT + 20;
            const current = barGeometry(category.currentMinor, 0, groupIndex);
            const previous = hasPrevious
              ? barGeometry(category.previousMinor, 1, groupIndex)
              : null;
            return (
              <g key={category.id}>
                <path
                  className="chart-mark"
                  d={barTopRoundedPath(
                    current.x,
                    current.yTop,
                    barWidth,
                    current.barHeight,
                  )}
                  fill={SERIES_COLORS.current}
                  tabIndex={0}
                  role="img"
                  aria-label={`${category.label} — ${monthLabel}: ${formatMoney(category.currentMinor)} USD`}
                  {...tooltipHandlers(
                    setTooltip,
                    figureRef,
                    `${category.label} — ${monthLabel}: ${formatMoney(category.currentMinor)} USD`,
                  )}
                />
                {previous ? (
                  <path
                    className="chart-mark"
                    d={barTopRoundedPath(
                      previous.x,
                      previous.yTop,
                      barWidth,
                      previous.barHeight,
                    )}
                    fill={`url(#${patternId})`}
                    tabIndex={0}
                    role="img"
                    aria-label={`${category.label} — ${previousMonthLabel}: ${formatMoney(category.previousMinor)} USD`}
                    {...tooltipHandlers(
                      setTooltip,
                      figureRef,
                      `${category.label} — ${previousMonthLabel}: ${formatMoney(category.previousMinor)} USD`,
                    )}
                  />
                ) : null}
                <text
                  className="chart-x-label"
                  x={labelX}
                  y={labelY}
                  textAnchor={rotateLabels ? "end" : "middle"}
                  transform={rotateLabels ? `rotate(-35 ${labelX} ${labelY})` : undefined}
                >
                  {category.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <figcaption className="chart-caption">{caption}</figcaption>

      <Legend
        items={[
          { label: monthLabel, color: SERIES_COLORS.current, marker: "square" },
          ...(hasPrevious
            ? [
                {
                  label: previousMonthLabel,
                  color: SERIES_COLORS.previous,
                  marker: "square",
                },
              ]
            : []),
        ]}
      />

      <VisuallyHiddenTable
        caption={`Spending by category: ${monthLabel}${hasPrevious ? ` and ${previousMonthLabel}` : ""}`}
        columns={["Category", monthLabel, ...(hasPrevious ? [previousMonthLabel] : [])]}
        rows={categories.map((category) => [
          category.label,
          formatMoney(category.currentMinor),
          ...(hasPrevious ? [formatMoney(category.previousMinor)] : []),
        ])}
      />

      <ChartTooltip tooltip={tooltip} />
    </figure>
  );
}
