import { language, changeLanguage } from "../../lib/locale.js";
export function LanguageSwitch() {
  return (
    <button
      type="button"
      className="language-switch"
      onClick={() => changeLanguage(language === "en" ? "he" : "en")}
      aria-label={language === "en" ? "Switch to Hebrew" : "Switch to English"}
    >
      {language === "en" ? "עברית" : "English"}
    </button>
  );
}
