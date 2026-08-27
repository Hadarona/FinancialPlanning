import { useEffect, useState } from "react";

/**
 * Tracks an element's content width so charts render at real pixel size —
 * text stays at a fixed, legible size at every viewport instead of shrinking
 * with a scaled viewBox (D-INS-D5/F6). Falls back to `fallback` where
 * ResizeObserver does not exist (jsdom tests).
 */
export function useMeasuredWidth(ref, fallback = 560) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect?.width;
      if (measured) {
        setWidth(measured);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
