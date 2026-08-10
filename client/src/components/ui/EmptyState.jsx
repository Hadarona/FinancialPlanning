import { Button } from "./Button.jsx";
import "./StatePanel.css";

/** Friendly empty state with an optional primary action. */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="state-panel">
      {Icon ? <Icon className="state-panel-icon" size={40} aria-hidden="true" /> : null}
      <h2 className="state-panel-title">{title}</h2>
      {description ? <p className="state-panel-description">{description}</p> : null}
      {actionLabel ? (
        <Button onClick={onAction} className="state-panel-action">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
