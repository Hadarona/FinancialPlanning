import { ArrowLeft } from "lucide-react";
import { IconButton } from "./IconButton.jsx";
import { Menu } from "./Menu.jsx";
import "./AppHeader.css";

/**
 * Shared authenticated-shell header: logo (or a back button), page title,
 * and the overflow menu. `menuItems` are page-specific entries
 * (`[{ label, onSelect?, disabled? }]`); Logout is always appended last.
 */
export function AppHeader({
  title,
  onLogout,
  menuItems = [],
  onBack,
  backLabel = "Back",
}) {
  return (
    <header className="app-header">
      {onBack ? (
        <IconButton icon={ArrowLeft} label={backLabel} onClick={onBack} />
      ) : (
        <img src="/logo.svg" alt="" width={32} height={32} className="app-header-logo" />
      )}
      <h1 className="app-header-title">{title}</h1>
      <Menu items={[...menuItems, { label: "Logout", onSelect: onLogout }]} />
    </header>
  );
}
