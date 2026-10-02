import { t, language } from "../lib/locale.js";
// Same-origin by default (`VITE_API_BASE` empty) so the Express-served
// production build never needs a hard-coded machine URL; in dev, Vite's
// proxy forwards /api to the server (see vite.config.js).
export const getSelectedBudget = () => sessionStorage.getItem("selected-budget") || "";
export const setSelectedBudget = (id) => sessionStorage.setItem("selected-budget", id);
const budgetHeaders = () =>
  getSelectedBudget() ? { "X-Budget-Id": getSelectedBudget() } : {};
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// Requests whose own 401 means "not signed in yet" rather than "your
// session just expired" — the session-expired event is only useful for
// calls made while the app believes the user is already authenticated.
const AUTH_BOOTSTRAP_PATHS = new Set(["/auth/me", "/auth/login", "/auth/register"]);

export class ApiError extends Error {
  constructor({ code, status, message, fieldErrors, requestId }) {
    super(localizeError(message, code));
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors =
      fieldErrors &&
      Object.fromEntries(
        Object.entries(fieldErrors).map(([field, value]) => [
          field,
          localizeError(value, "VALIDATION_ERROR"),
        ]),
      );
    this.requestId = requestId;
  }
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    credentials: "include",
    headers: {
      ...budgetHeaders(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const errorPayload = payload?.error ?? {};
    if (response.status === 401 && !AUTH_BOOTSTRAP_PATHS.has(path)) {
      window.dispatchEvent(new CustomEvent("session-expired"));
    }
    throw new ApiError({
      code: errorPayload.code ?? "INTERNAL",
      status: response.status,
      message: errorPayload.message ?? "Something went wrong. Please try again.",
      fieldErrors: errorPayload.fieldErrors,
      requestId: errorPayload.requestId,
    });
  }

  return payload;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

/**
 * Maps a caught auth error into `{ fieldErrors, formError }` for a form to
 * render. `conflictField` names the field a bare (fieldErrors-less) 409
 * CONFLICT should attach to, e.g. "email" for a duplicate-account error.
 */
export function describeAuthError(err, { conflictField } = {}) {
  if (!(err instanceof ApiError)) {
    return { fieldErrors: {}, formError: "Something went wrong. Please try again." };
  }
  if (err.fieldErrors) {
    return { fieldErrors: err.fieldErrors, formError: "" };
  }
  if (err.code === "CONFLICT" && conflictField) {
    return { fieldErrors: { [conflictField]: err.message }, formError: "" };
  }
  return { fieldErrors: {}, formError: err.message };
}

export async function uploadWorkbook(file, dateBasis = "purchase") {
  if (file.size > 5 * 1024 * 1024)
    throw new Error(t("Choose a file smaller than 5 MB.", "יש לבחור קובץ קטן מ־5 MB."));
  const response = await fetch(
    `${API_BASE}/api/v1/imports/preview?dateBasis=${dateBasis}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        ...budgetHeaders(),
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: file,
    },
  );
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("session-expired"));
    throw new ApiError({
      status: response.status,
      code: data?.error?.code,
      message: data?.error?.message ?? "Import failed. Try again.",
    });
  }
  return data;
}

function localizeError(message, code) {
  if (language !== "he") return message;
  const messages = {
    "Incorrect email or password.": "האימייל או הסיסמה שגויים.",
    "An account with that email already exists.": "כבר קיים חשבון עם כתובת האימייל הזאת.",
    "The budget changed. Refresh before saving.":
      "התקציב השתנה. רעננו את התכנית לפני השמירה.",
    "This budget is read-only.": "יש לכם הרשאת צפייה בלבד בתקציב הזה.",
    "Preview expired. Choose the file again.":
      "התצוגה המקדימה פגה. יש לבחור שוב את הקובץ.",
    "No supported transaction sheet found. Expected Date, Merchant and Amount columns.":
      "לא נמצא גיליון עסקאות נתמך. נדרשות עמודות תאריך עסקה, בית עסק וסכום חיוב.",
    "This is not a valid XLSX workbook.": "זה אינו קובץ אקסל תקין מסוג XLSX.",
    "Choose an XLSX file up to 5 MB.": "יש לבחור קובץ XLSX בגודל עד 5 MB.",
  };
  return (
    messages[message] ??
    {
      UNAUTHENTICATED: "יש להתחבר מחדש.",
      FORBIDDEN: "אין הרשאה לפעולה הזאת.",
      NOT_FOUND: "הפריט אינו זמין או שאין לכם גישה אליו.",
      CONFLICT: "הנתונים השתנו. רעננו ונסו שוב.",
      VALIDATION_ERROR: "בדקו שהפרטים שהזנתם תקינים.",
      RATE_LIMITED: "בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
    }[code] ??
    "משהו השתבש. נסו שוב."
  );
}
