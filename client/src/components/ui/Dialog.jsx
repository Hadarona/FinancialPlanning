import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./Dialog.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusable(container) {
  return Array.from(container?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []);
}

/**
 * Modal dialog (D-EXP-D1/D5): portal-rendered, `role="dialog"` +
 * `aria-modal`, labelled by its title; focus moves in on open, Tab is
 * trapped in a cycle, Escape closes, and focus returns to the opener on
 * close. Bottom-sheet styling below 768px, centered 480px card above.
 */
export function Dialog({ open, onClose, title, children }) {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();

  // The effect below must run exactly once per open/close transition. A new
  // `onClose` identity is created on every parent re-render (each form
  // keystroke), and re-running the effect would steal focus back to the
  // first field mid-typing — so the latest callback lives in a ref instead
  // of the dependency array.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    previouslyFocusedRef.current = document.activeElement;
    const panel = panelRef.current;
    const initialFocusables = getFocusable(panel);
    (initialFocusables[0] ?? panel).focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      // Return focus to the element that opened the dialog (D-EXP-D5).
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="dialog-backdrop">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog-panel"
        tabIndex={-1}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
