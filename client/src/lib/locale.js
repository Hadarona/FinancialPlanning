export const language = localStorage.getItem("budget-language") === "he" ? "he" : "en";
export const t = (english, hebrew) => (language === "he" ? hebrew : english);
export const locale = language === "he" ? "he-IL" : "en-IL";
export const categoryName = (c) =>
  language === "he"
    ? ({
        Housing: "דיור",
        Groceries: "מזון וקניות",
        Transport: "תחבורה",
        Fun: "פנאי",
        Savings: "חיסכון",
        Subscriptions: "מנויים",
        Utilities: "חשבונות",
        "One-off expenses": "הוצאות חד פעמיות",
      }[c.name] ?? c.name)
    : c.name;
export function changeLanguage(value) {
  localStorage.setItem("budget-language", value);
  window.location.reload();
}
document.documentElement.lang = language;
document.documentElement.dir = language === "he" ? "rtl" : "ltr";
