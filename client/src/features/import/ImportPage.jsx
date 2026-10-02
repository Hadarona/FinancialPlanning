import { useBudgetRole } from "../../api/useBudgetRole.js";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import { apiClient, uploadWorkbook } from "../../api/client.js";
import { useMonthQuery } from "../../api/hooks.js";
import { currentMonth } from "../../lib/dates.js";
import { formatMoney } from "../../lib/money.js";
import { t, categoryName } from "../../lib/locale.js";
import "../../styles/workspace.css";

export function ImportPage() {
  const readOnly = useBudgetRole() === "viewer";
  const { logout } = useAuth(),
    cache = useQueryClient(),
    budget = useMonthQuery(currentMonth());
  const [file, setFile] = useState(null),
    [basis, setBasis] = useState("purchase"),
    [preview, setPreview] = useState(null),
    [selected, setSelected] = useState({}),
    [mapping, setMapping] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [page, setPage] = useState(0);
  const categories = budget.data?.budget.categories.filter((c) => !c.archived) ?? [];
  async function review(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    setPreview(null);
    try {
      const data = await uploadWorkbook(file, basis);
      setPreview(data);
      setPage(0);
      setSelected(
        Object.fromEntries(
          data.rows.map((r) => [r.index, !r.duplicate && !r.manualMatches?.length]),
        ),
      );
      setMapping(
        Object.fromEntries(data.rows.map((r) => [r.metadata.sourceCategory, "one-off"])),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const rows = preview.rows
        .filter((r) => selected[r.index] && !r.duplicate)
        .map((r) => ({
          index: r.index,
          categoryId: mapping[r.metadata.sourceCategory] || "one-off",
          ...(r.manualMatches?.length ? { allowManualMatch: true } : {}),
        }));
      const data = await apiClient.post("/imports/commit", {
        previewId: preview.previewId,
        rows,
      });
      setResult(data);
      setPreview(null);
      await cache.invalidateQueries({
        predicate: (q) => ["month", "transactions", "insights"].includes(q.queryKey[0]),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const chosen = preview?.rows.filter((r) => selected[r.index] && !r.duplicate) ?? [];
  return (
    <>
      <AppHeader title={t("Import transactions", "ייבוא עסקאות")} onLogout={logout} />
      <main className="workspace">
        <section className="workspace-card">
          <h1>{t("From your statement to your budget", "מדף העסקאות אל התקציב")}</h1>
          <p>
            {t(
              "Upload Excel, review the transactions, then choose their categories. Nothing is added until you confirm.",
              "העלו קובץ אקסל, בדקו את העסקאות ובחרו קטגוריות. שום דבר לא יתווסף לפני האישור שלכם.",
            )}
          </p>
          {readOnly && (
            <p className="notice">
              {t(
                "You have view-only access. Choose an editable budget to import transactions.",
                "יש לכם הרשאת צפייה בלבד. בחרו תקציב שניתן לעריכה כדי לייבא עסקאות.",
              )}
            </p>
          )}
          <form className="workspace-form" onSubmit={review}>
            <label>
              {t("Excel statement (.xlsx, up to 5 MB)", "קובץ עסקאות (xlsx, עד 5 MB)")}
              <input
                type="file"
                accept=".xlsx"
                required
                onChange={(e) => {
                  setFile(e.target.files[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
              />
            </label>
            <label>
              {t("Assign expenses to the month of", "שיוך ההוצאות לחודש לפי")}
              <select
                value={basis}
                onChange={(e) => {
                  setBasis(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="purchase">
                  {t("Purchase date (recommended)", "תאריך העסקה (מומלץ)")}
                </option>
                <option value="billing">{t("Billing date", "תאריך החיוב")}</option>
              </select>
            </label>
            <small>
              {t(
                "Installments use the billed amount. Both worksheets in Israeli card exports are supported.",
                "בתשלומים נשתמש בסכום החיוב. נתמכים שני הגיליונות בייצוא כרטיס אשראי ישראלי.",
              )}
            </small>
            <button disabled={readOnly || !file || busy}>
              {busy ? t("Working…", "מעבד…") : t("Preview transactions", "תצוגה מקדימה")}
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
          {result && (
            <p role="status">
              {t("Imported", "יובאו")} {result.imported} ·{" "}
              {t("Duplicates skipped", "כפילויות שדולגו")}: {result.duplicates}
            </p>
          )}
        </section>
        {preview && (
          <section className="workspace-card">
            <h2>{t("Review & categorize", "בדיקה ושיוך קטגוריות")}</h2>
            <p>
              {preview.rows.length} {t("transactions found", "עסקאות נמצאו")} ·{" "}
              {preview.rows.filter((r) => r.duplicate).length}{" "}
              {t("already imported", "כבר יובאו")}
            </p>
            {preview.rows.some((r) => !r.duplicate && r.manualMatches?.length) && (
              <p className="notice">
                {t(
                  "Possible duplicates match a manual expense's exact amount and purchase date. They are unchecked. Select a row only if it is a separate purchase; your existing expenses will stay unchanged.",
                  "כפילויות אפשריות תואמות בדיוק לסכום ולתאריך העסקה של הוצאה שהוזנה ידנית. הן לא מסומנות לייבוא. סמנו שורה רק אם זו רכישה נפרדת; ההוצאות הקיימות לא ישתנו.",
                )}
              </p>
            )}
            {preview.issues.length > 0 && (
              <details className="notice">
                <summary>
                  {preview.issues.length}{" "}
                  {t(
                    "rows need review and will not be imported",
                    "שורות דורשות בדיקה ולא ייובאו",
                  )}
                </summary>
                <ul>
                  {preview.issues.map((issue, i) => (
                    <li key={i}>
                      {issue.sheet} · {t("row", "שורה")} {issue.row}: {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p>
              {t(
                "Map statement categories once for this import. One-off expenses always have a zero budget.",
                "שייכו כל קטגוריה מהקובץ פעם אחת לייבוא הנוכחי. הוצאות חד פעמיות תמיד מתוקצבות באפס.",
              )}
            </p>
            <div className="category-editor">
              {Object.keys(mapping).map((source) => (
                <label key={source}>
                  {source || t("Uncategorized", "ללא קטגוריה")}
                  <select
                    value={mapping[source]}
                    onChange={(e) => setMapping({ ...mapping, [source]: e.target.value })}
                  >
                    {(preview.categoryOptions?.[source] ?? categories).map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryName(c)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={preview.rows
                    .filter((r) => !r.duplicate && !r.manualMatches?.length)
                    .every((r) => selected[r.index])}
                  onChange={(e) =>
                    setSelected(
                      Object.fromEntries(
                        preview.rows.map((r) => [
                          r.index,
                          e.target.checked && !r.duplicate && !r.manualMatches?.length,
                        ]),
                      ),
                    )
                  }
                />
                {t("Select all new transactions", "בחירת כל העסקאות החדשות")}
              </label>
            </p>
            <div className="import-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Import", "ייבוא")}</th>
                    <th>{t("Date", "תאריך")}</th>
                    <th>{t("Description", "תיאור")}</th>
                    <th>ILS ₪</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(page * 100, (page + 1) * 100).map((r) => (
                    <tr key={r.index} className={r.duplicate ? "muted" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${t("Import row", "ייבוא שורה")} ${r.sourceRow}`}
                          disabled={r.duplicate || busy}
                          checked={!!selected[r.index] && !r.duplicate}
                          onChange={(e) =>
                            setSelected({ ...selected, [r.index]: e.target.checked })
                          }
                        />
                        {r.duplicate && t("Duplicate", "כפילות")}
                        {!r.duplicate && !!r.manualMatches?.length && (
                          <div>
                            <strong>{t("Possible duplicate", "כפילות אפשרית")}</strong>
                            <ul>
                              {r.manualMatches.map((match) => (
                                <li key={match.id} dir="auto">
                                  {match.note || t("Manual expense", "הוצאה ידנית")}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td>{r.occurredOn}</td>
                      <td dir="auto">{r.note}</td>
                      <td>{formatMoney(r.amountMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 100 && (
              <p>
                <button
                  className="secondary"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  {t("Previous", "הקודם")}
                </button>{" "}
                {page + 1}/{Math.ceil(preview.rows.length / 100)}{" "}
                <button
                  className="secondary"
                  disabled={(page + 1) * 100 >= preview.rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  {t("Next", "הבא")}
                </button>
              </p>
            )}
            <p>
              {t("Selected", "נבחרו")}: {chosen.length} · ₪
              {formatMoney(chosen.reduce((n, r) => n + r.amountMinor, 0))}
            </p>
            <button disabled={busy || !chosen.length} onClick={commit}>
              {busy ? t("Importing…", "מייבא…") : t("Confirm import", "אישור הייבוא")}
            </button>
          </section>
        )}
      </main>
    </>
  );
}
