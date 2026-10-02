import { NavLink } from "react-router-dom";
import { LanguageSwitch } from "./LanguageSwitch.jsx";
import { BudgetSwitcher } from "./BudgetSwitcher.jsx";
import { t } from "../../lib/locale.js";
import "../../styles/workspace.css";
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
    <>
      <header className="app-header">
        {onBack ? (
          <IconButton icon={ArrowLeft} label={backLabel} onClick={onBack} />
        ) : (
          <img
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            className="app-header-logo"
          />
        )}
        <h1 className="app-header-title">{title}</h1>
        <LanguageSwitch />
        <Menu
          items={[...menuItems, { label: t("Logout", "יציאה"), onSelect: onLogout }]}
        />
      </header>
      <BudgetSwitcher />
      <nav className="app-nav" aria-label={t("Main navigation", "ניווט ראשי")}>
        <NavLink to="/budget">{t("This month", "החודש שלי")}</NavLink>
        <NavLink to="/insights">{t("Insights", "תובנות")}</NavLink>
        <NavLink to="/import">{t("Import", "ייבוא")}</NavLink>
        <NavLink to="/settings">{t("Plan & share", "תכנון ושיתוף")}</NavLink>
      </nav>
    </>
  );
}
