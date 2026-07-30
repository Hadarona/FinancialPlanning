import { useRef } from "react";
import "./MonthTabs.css";

/**
 * Month-comparison tabs (Tabs / Month). Kit rule: the selected current
 * month is blue with white text; the selected previous month is yellow with
 * near-black text. Roving tabindex with ArrowLeft/ArrowRight/Home/End;
 * selection follows focus (D-RESP-F3, a11y checklist).
 *
 * `options`: `[{ value, label, tone: "previous" | "current" }]`.
 */
export function MonthTabs({ options, value, onChange, panelId, label = "Compare months" }) {
  const tabRefs = useRef([]);

  function focusAndSelect(index) {
    const option = options[index];
    if (!option) {
      return;
    }
    tabRefs.current[index]?.focus();
    if (option.value !== value) {
      onChange(option.value);
    }
  }

  function handleKeyDown(event, index) {
    let nextIndex = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }
    if (nextIndex !== null) {
      event.preventDefault();
      focusAndSelect(nextIndex);
    }
  }

  return (
    <div role="tablist" aria-label={label} className="month-tabs">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`month-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={`month-tab month-tab-${option.tone}${selected ? " month-tab-selected" : ""}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
