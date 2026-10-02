import { useBudgetRole } from "../../api/useBudgetRole.js";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import { apiClient } from "../../api/client.js";
import { useMonthQuery } from "../../api/hooks.js";
import { currentMonth } from "../../lib/dates.js";
import { minorToInputValue, parseMoneyToMinor } from "../../lib/money.js";
import { t } from "../../lib/locale.js";
import "../../styles/workspace.css";

function PlanEditor({ budget, month, onSaved }) {
  const [income, setIncome] = useState(minorToInputValue(budget.incomeMinor));
  const [rows, setRows] = useState(
    budget.categories.map((c) => ({ ...c, amount: minorToInputValue(c.plannedMinor) })),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function update(id, patch) {
    setRows(rows.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function save(e) {
    e.preventDefault();
    setError("");
    const incomeMinor = parseMoneyToMinor(income);
    const categories = rows.map((c) => ({
      id: c.id,
      name: c.name,
      plannedMinor: c.id === "one-off" ? 0 : parseMoneyToMinor(c.amount),
      archived: !!c.archived,
    }));
    if (
      incomeMinor === null ||
      incomeMinor < 0 ||
      categories.some(
        (c) => !c.name.trim() || c.plannedMinor === null || c.plannedMinor < 0,
      )
    ) {
      setError(
        t(
          "Enter a name and a valid non-negative amount for each category.",
          "יש להזין שם וסכום תקין שאינו שלילי לכל קטגוריה.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await apiClient.patch("/budget", {
        effectiveMonth: month,
        revision: budget.revision,
        incomeMinor,
        categories,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="workspace-form">
      <p className="notice">
        {t(
          "Changes apply from this month onward, replacing later scheduled plans. Earlier months stay unchanged.",
          "השינויים יחולו מהחודש שנבחר והלאה ויחליפו תכניות עתידיות. חודשים קודמים לא ישתנו.",
        )}
      </p>
      <label>
        {t("Monthly income (ILS)", "הכנסה חודשית (₪)")}
        <input
          inputMode="decimal"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
        />
      </label>
      <div className="category-editor">
        {rows.map((c) => (
          <div className="category-edit-row" key={c.id}>
            <label>
              {t("Category name", "שם הקטגוריה")}
              <input
                maxLength={60}
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
              />
            </label>
            <label>
              {t("Monthly plan (ILS)", "תקציב חודשי (₪)")}
              <input
                inputMode="decimal"
                value={c.amount}
                disabled={c.id === "one-off"}
                onChange={(e) => update(c.id, { amount: e.target.value })}
              />
            </label>
            {c.id === "one-off" ? (
              <small>{t("Always budgeted at zero", "תמיד מתוקצב באפס")}</small>
            ) : (
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!c.archived}
                  onChange={(e) => update(c.id, { archived: e.target.checked })}
                />
                {t("Archive", "ארכיון")}
              </label>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="secondary"
        disabled={rows.length >= 50}
        onClick={() =>
          setRows([
            ...rows,
            { id: crypto.randomUUID(), name: "", amount: "0", plannedMinor: 0 },
          ])
        }
      >
        {t("+ Add category", "+ הוספת קטגוריה")}
      </button>
      <small>
        {t(
          "Archived categories keep their history. You can unarchive them later.",
          "קטגוריות בארכיון שומרות על ההיסטוריה. אפשר להחזיר אותן בהמשך.",
        )}
      </small>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} type="submit">
        {busy
          ? t("Saving…", "שומר…")
          : t("Save from selected month", "שמירה מהחודש שנבחר")}
      </button>
    </form>
  );
}
function Sharing() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("editor"),
    [invite, setInvite] = useState(""),
    [token, setToken] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["members"],
    queryFn: () => apiClient.get("/sharing/members"),
  });
  async function act(fn) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-card">
      <h2>{t("Share your budget", "שיתוף התקציב")}</h2>
      <p>
        {t(
          "Invite someone by email. They create an account and paste the invitation code below.",
          "הזמינו שותף לפי כתובת האימייל שלו. לאחר יצירת חשבון, עליו להדביק כאן את קוד ההזמנה.",
        )}
      </p>
      {query.data?.role === "owner" && (
        <form
          className="workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const data = await apiClient.post("/sharing/invite", { email, role });
              setInvite(data.token);
            });
          }}
        >
          <label>
            {t("Their email", "האימייל שלהם")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t("Access", "הרשאה")}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">{t("Can edit", "עריכה")}</option>
              <option value="viewer">{t("Can view", "צפייה")}</option>
            </select>
          </label>
          <button disabled={busy}>{t("Create invitation", "יצירת הזמנה")}</button>
        </form>
      )}
      {invite && (
        <div className="notice">
          <p>
            {t(
              "Send this code to your invitee. It expires in 7 days.",
              "שלחו את הקוד לשותף. הוא תקף ל־7 ימים.",
            )}
          </p>
          <input aria-label={t("Invitation code", "קוד הזמנה")} readOnly value={invite} />
          <button
            className="secondary"
            onClick={() =>
              act(async () => {
                await navigator.clipboard.writeText(invite);
                setMessage(t("Copied", "הועתק"));
              })
            }
          >
            {t("Copy code", "העתקת קוד")}
          </button>
        </div>
      )}
      <ul>
        {query.data?.members.map((m) => (
          <li key={m.id}>
            {m.email} ·{" "}
            {m.role === "editor" ? t("Can edit", "עריכה") : t("Can view", "צפייה")}{" "}
            {query.data.role === "owner" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(() => apiClient.delete(`/sharing/members/${m.id}`))}
              >
                {t("Remove access", "הסרת גישה")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="workspace-form"
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            await apiClient.post("/sharing/accept", { token: token.trim() });
            setToken("");
            setMessage(
              t(
                "Budget joined. Choose it in the budget menu.",
                "הצטרפת לתקציב. אפשר לבחור אותו בתפריט התקציבים.",
              ),
            );
            await queryClient.invalidateQueries({ queryKey: ["sharing"] });
          });
        }}
      >
        <label>
          {t("Have an invitation? Paste the code", "קיבלתם הזמנה? הדביקו את הקוד")}
          <input required value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        <button disabled={busy}>{t("Join budget", "הצטרפות לתקציב")}</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function SettingsPage() {
  const readOnly = useBudgetRole() === "viewer";
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth()),
    [message, setMessage] = useState("");
  const query = useMonthQuery(month);
  return (
    <>
      <AppHeader title={t("Budget settings", "הגדרות תקציב")} onLogout={logout} />
      <main className="workspace">
        <section className="workspace-card">
          <h1>{t("Make the plan yours", "התקציב שמתאים לכם")}</h1>
          <p>
            {t(
              "One recurring plan, with changes that preserve your past months. All amounts are in ILS.",
              "תכנית קבועה אחת, עם שינויים ששומרים על העבר. כל הסכומים בשקלים.",
            )}
          </p>
          <label>
            {t("Effective from", "החל מחודש")}
            <input
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value);
                  setMessage("");
                }
              }}
            />
          </label>
          {query.isLoading ? (
            <p>{t("Loading…", "טוען…")}</p>
          ) : query.isError ? (
            <p role="alert">{query.error.message}</p>
          ) : (
            <fieldset disabled={readOnly} className="plan-fields">
              {readOnly && (
                <p className="notice">
                  {t(
                    "You have view-only access to this budget.",
                    "יש לכם הרשאת צפייה בלבד בתקציב זה.",
                  )}
                </p>
              )}
              <PlanEditor
                key={`${month}-${query.data.budget.revision}`}
                month={month}
                budget={query.data.budget}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["month"] });
                  queryClient.invalidateQueries({ queryKey: ["insights"] });
                  setMessage(
                    t(
                      "Plan saved. Earlier months are unchanged.",
                      "התכנית נשמרה. חודשים קודמים לא השתנו.",
                    ),
                  );
                }}
              />
            </fieldset>
          )}
          {message && <p role="status">{message}</p>}
        </section>
        <Sharing />
      </main>
    </>
  );
}
