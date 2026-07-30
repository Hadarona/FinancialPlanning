import { Menu } from "./Menu.jsx";
import "./AppHeader.css";

/** Shared authenticated-shell header: logo, page title, and the overflow
 * menu (Edit budget / Logout). "Edit budget" stays disabled until Stage E
 * wires the plan-editing screen. */
export function AppHeader({ title, onLogout, editBudgetEnabled = false, onEditBudget }) {
  return (
    <header className="app-header">
      <img src="/logo.svg" alt="" width={32} height={32} className="app-header-logo" />
      <h1 className="app-header-title">{title}</h1>
      <Menu
        items={[
          { label: "Edit budget", disabled: !editBudgetEnabled, onSelect: onEditBudget },
          { label: "Logout", onSelect: onLogout },
        ]}
      />
    </header>
  );
}
