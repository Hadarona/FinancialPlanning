import "./charts.css";

/**
 * Single shared tooltip surface, positioned near the hovered/focused datum
 * by the owning chart (a11y checklist: tooltips work through keyboard focus
 * as well as pointer hover). `tooltip` is `{ text, x, y } | null` with
 * coordinates relative to the chart figure.
 */
export function ChartTooltip({ tooltip }) {
  if (!tooltip) {
    return null;
  }
  return (
    <div
      className="chart-tooltip"
      role="status"
      style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
    >
      {tooltip.text}
    </div>
  );
}

/**
 * Shared hover/focus handler factory for chart data marks. Returns props
 * spreading `onFocus/onBlur/onMouseEnter/onMouseLeave` that position the
 * tooltip above the mark, relative to the chart figure element.
 */
export function tooltipHandlers(setTooltip, figureRef, text) {
  function show(event) {
    const figure = figureRef.current;
    if (!figure) {
      setTooltip({ text, x: 0, y: 0 });
      return;
    }
    const markRect = event.currentTarget.getBoundingClientRect();
    const figureRect = figure.getBoundingClientRect();
    setTooltip({
      text,
      x: markRect.left + markRect.width / 2 - figureRect.left,
      y: markRect.top - figureRect.top,
    });
  }
  function hide() {
    setTooltip(null);
  }
  return { onFocus: show, onBlur: hide, onMouseEnter: show, onMouseLeave: hide };
}
