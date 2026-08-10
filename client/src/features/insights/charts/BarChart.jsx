import { useId, useRef, useState } from "react";
import { formatMoney } from "../../../lib/money.js";
import { axisScale, compactAxisLabel, barTopRoundedPath } from "./chartMath.js";
import {
  SERIES_COLORS,
  SERIES_PATTERN_STROKES,
  SERIES_BAR_PATTERNS,
} from "./chartColors.js";
import { ChartTooltip, tooltipHandlers } from "./ChartTooltip.jsx";
import { Legend } from "./Legend.jsx";
import { VisuallyHiddenTable } from "./VisuallyHiddenTable.jsx";
import { useMeasuredWidth } from "./useMeasuredWidth.js";
import "./charts.css";

const MARGIN = { top: 12, right: 8, bottom: 28, left: 48 };
const PLOT_HEIGHT = 200;
// Rotated labels descend below the axis by sin(35°) × label width; the
// longest category ("Subscriptions") needs ~48px beyond the base margin.
const ROTATED_LABEL_EXTRA = 40;
const BAR_GAP = 2; // surface gap between the bars of a group
const MIN_BAR_WIDTH = 6;
const MAX_BAR_WIDTH = 24;

/**
 * Grouped month-comparison bar chart (CR3-4): one group per category, one
 * bar per selected month (1–3, newest first). Series pair a kit color with
 * a fill pattern (plain / diagonal / dotted) so they never differ by color
 * alone. Every bar is keyboard-focusable with a tooltip and an aria-label;
 * a hidden table mirrors the data.
 *
 * `months`: `[{ month, label, yearLabel }]` (newest first).
 * `categories`: `[{ id, label, totalsMinor: number[] }]` aligned with months.
 */
export function BarChart({ months, categories }) {
  const figureRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const patternBaseId = useId();
  const width = useMeasuredWidth(containerRef);

  const seriesCount = months.length;
  const plotWidth = Math.max(120, width - MARGIN.left - MARGIN.right);
  const groupWidth = plotWidth / categories.length;
  // Compact alternative below ~56px per label: rotate the category labels
  // so full words stay legible at small widths (D-INS-D5).
  const rotateLabels = groupWidth < 56;
  const height =
    MARGIN.top + PLOT_HEIGHT + MARGIN.bottom + (rotateLabels ? ROTATED_LABEL_EXTRA : 0);

  const allValues = categories.flatMap((category) => category.totalsMinor);
  const scale = axisScale(Math.max(0, ...allValues));

  // Bars are computed from the measured width: never below 6px; the group
  // keeps a little side padding when space allows.
  const barWidth = Math.min(
    MAX_BAR_WIDTH,
    Math.max(
      MIN_BAR_WIDTH,
      (groupWidth * 0.72 - (seriesCount - 1) * BAR_GAP) / seriesCount,
    ),
  );
  const groupContentWidth = seriesCount * barWidth + (seriesCount - 1) * BAR_GAP;

  function barGeometry(value, slotIndex, groupIndex) {
    const groupStart = MARGIN.left + groupIndex * groupWidth;
    const x =
      groupStart +
      (groupWidth - groupContentWidth) / 2 +
      slotIndex * (barWidth + BAR_GAP);
    const barHeight = (value / scale.max) * PLOT_HEIGHT;
    const yTop = MARGIN.top + PLOT_HEIGHT - barHeight;
    return { x, yTop, barHeight };
  }

  function seriesFill(slotIndex) {
    const pattern = SERIES_BAR_PATTERNS[slotIndex];
    if (pattern === "plain") {
      return SERIES_COLORS[slotIndex];
    }
    return `url(#${patternBaseId}-${pattern})`;
  }

  const monthsPhrase = months.map((entry) => entry.yearLabel).join(", ");
  const caption = `Spending by category across ${monthsPhrase}: ${categories
    .map(
      (category) =>
        `${category.label} ${category.totalsMinor
          .map((value) => formatMoney(value))
          .join(" vs ")}`,
    )
    .join("; ")}.`;

  const legendMarkers = ["square", "square-diagonal", "square-dotted"];

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
              id={`${patternBaseId}-diagonal`}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill={SERIES_COLORS[1]} />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke={SERIES_PATTERN_STROKES[1]}
                strokeWidth="1.5"
              />
            </pattern>
            <pattern
              id={`${patternBaseId}-dotted`}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
            >
              <rect width="6" height="6" fill={SERIES_COLORS[2]} />
              <circle cx="3" cy="3" r="1.2" fill={SERIES_PATTERN_STROKES[2]} />
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
            return (
              <g key={category.id}>
                {months.map((monthEntry, slotIndex) => {
                  const value = category.totalsMinor[slotIndex] ?? 0;
                  const geometry = barGeometry(value, slotIndex, groupIndex);
                  const text = `${category.label} — ${monthEntry.yearLabel}: ${formatMoney(value)} USD`;
                  return (
                    <path
                      key={monthEntry.month}
                      className="chart-mark"
                      d={barTopRoundedPath(
                        geometry.x,
                        geometry.yTop,
                        barWidth,
                        geometry.barHeight,
                        Math.min(4, barWidth / 3),
                      )}
                      fill={seriesFill(slotIndex)}
                      tabIndex={0}
                      role="img"
                      aria-label={text}
                      {...tooltipHandlers(setTooltip, figureRef, text)}
                    />
                  );
                })}
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
        items={months.map((monthEntry, slotIndex) => ({
          label: monthEntry.yearLabel,
          color: SERIES_COLORS[slotIndex],
          patternStroke: SERIES_PATTERN_STROKES[slotIndex],
          marker: legendMarkers[slotIndex],
        }))}
      />

      <VisuallyHiddenTable
        caption={`Spending by category: ${monthsPhrase}`}
        columns={["Category", ...months.map((entry) => entry.yearLabel)]}
        rows={categories.map((category) => [
          category.label,
          ...category.totalsMinor.map((value) => formatMoney(value)),
        ])}
      />

      <ChartTooltip tooltip={tooltip} />
    </figure>
  );
}
