import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { monthYearLabel } from "../../lib/dates.js";
import { copy } from "../../lib/copy.js";
import "./MonthMultiSelect.css";

/**
 * Multi-select month dropdown (CR3-2): a trigger button opening a
 * checkbox-style listbox (`aria-multiselectable`) of calendar months,
 * newest first. Selection is constrained to 1–3 months: at three, the
 * unselected options are `aria-disabled` with a visible + announced hint;
 * deselecting the last remaining month is refused with the same treatment.
 *
 * Keyboard: the open listbox holds real focus and roves with
 * `aria-activedescendant` (ArrowUp/Down, Home/End); Space/Enter toggles the
 * active option; Esc closes and returns focus to the trigger; Tab closes.
 *
 * `options`: array of "YYYY-MM" strings (newest first).
 * `selected`: array of "YYYY-MM" strings.
 * `onChange(nextSelected)`: called with the new selection, newest first.
 */
export function MonthMultiSelect({
  options,
  selected,
  onChange,
  label = copy.insights.monthSelectLabel,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hint, setHint] = useState("");
  const baseId = useId();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const atMax = selected.length >= 3;
  const summary = copy.insights.monthSelectSummary(
    monthYearLabel(selected[0]),
    selected.length - 1,
  );

  function optionId(index) {
    return `${baseId}-option-${index}`;
  }

  function openList() {
    setHint("");
    setActiveIndex(Math.max(0, options.indexOf(selected[0])));
    setOpen(true);
  }

  function closeList({ returnFocus = true } = {}) {
    setOpen(false);
    setHint("");
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }

  useEffect(() => {
    if (open) {
      listRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setHint("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggleMonth(month) {
    if (selected.includes(month)) {
      if (selected.length === 1) {
        // Refusing, not silently ignoring: the constraint is announced.
        setHint(copy.insights.minMonthsHint);
        return;
      }
      setHint("");
      onChange(selected.filter((value) => value !== month));
      return;
    }
    if (atMax) {
      setHint(copy.insights.maxMonthsHint);
      return;
    }
    setHint("");
    // Keep the selection newest-first (descending YYYY-MM string order).
    onChange([...selected, month].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)));
  }

  function handleListKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggleMonth(options[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeList();
    } else if (event.key === "Tab") {
      // Tab closes without trapping; default focus movement proceeds.
      closeList({ returnFocus: false });
    }
  }

  return (
    <div className="month-multiselect" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="month-multiselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-listbox` : undefined}
        aria-label={`${label}: ${summary}`}
        onClick={() => (open ? closeList() : openList())}
      >
        <span className="month-multiselect-summary">{summary}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div className="month-multiselect-popup">
          <ul
            ref={listRef}
            id={`${baseId}-listbox`}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            aria-activedescendant={optionId(activeIndex)}
            className="month-multiselect-list"
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
          >
            {options.map((month, index) => {
              const isSelected = selected.includes(month);
              const isDisabled = !isSelected && atMax;
              return (
                <li
                  key={month}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled || undefined}
                  className={`month-multiselect-option${
                    index === activeIndex ? " month-multiselect-option-active" : ""
                  }${isDisabled ? " month-multiselect-option-disabled" : ""}`}
                  onClick={() => {
                    setActiveIndex(index);
                    toggleMonth(month);
                  }}
                >
                  <span
                    className={`month-multiselect-check${
                      isSelected ? " month-multiselect-check-selected" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? <Check size={16} /> : null}
                  </span>
                  {monthYearLabel(month)}
                </li>
              );
            })}
          </ul>
          <p className="month-multiselect-hint" aria-live="polite">
            {hint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
