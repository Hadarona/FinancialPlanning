import { useEffect, useId, useRef, useState } from "react";
import { EllipsisVertical } from "lucide-react";
import { IconButton } from "./IconButton.jsx";
import "./Menu.css";

/** A minimal popover menu. `items` is `[{ label, onSelect?, disabled? }]`. */
export function Menu({ items, triggerLabel = "More options" }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="menu" ref={containerRef}>
      <IconButton
        icon={EllipsisVertical}
        label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <ul id={menuId} role="menu" className="menu-list">
          {items.map((item) => (
            <li role="none" key={item.label}>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
