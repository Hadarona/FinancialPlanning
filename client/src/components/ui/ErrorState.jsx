import { TriangleAlert } from "lucide-react";
import { Button } from "./Button.jsx";
import "./StatePanel.css";

/** Inline error panel with a retry action. Rendered inside the
 * authenticated shell so a network failure never erases it (D-BUD-F5). */
export function ErrorState({ title, description, onRetry, retryLabel = "Try again" }) {
  return (
    <div className="state-panel" role="alert">
      <TriangleAlert className="state-panel-icon state-panel-icon-error" size={40} aria-hidden="true" />
      <h2 className="state-panel-title">{title}</h2>
      {description ? <p className="state-panel-description">{description}</p> : null}
      {onRetry ? (
        <Button onClick={onRetry} className="state-panel-action">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
