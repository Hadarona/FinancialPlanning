// Same-origin by default (`VITE_API_BASE` empty) so the Express-served
// production build never needs a hard-coded machine URL; in dev, Vite's
// proxy forwards /api to the server (see vite.config.js).
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// Requests whose own 401 means "not signed in yet" rather than "your
// session just expired" — the session-expired event is only useful for
// calls made while the app believes the user is already authenticated.
const AUTH_BOOTSTRAP_PATHS = new Set(["/auth/me", "/auth/login", "/auth/register"]);

export class ApiError extends Error {
  constructor({ code, status, message, fieldErrors, requestId }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
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
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
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
