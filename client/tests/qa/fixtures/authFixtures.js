// QA-owned client fixtures for auth responses, matching the documented
// envelopes exactly (docs/api.md / server/src/errors.js STATUS_BY_CODE).

export function user(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email: "qa-user@example.com",
    ...overrides,
  };
}

export function meResponse(overrides = {}) {
  return { user: user(overrides) };
}

export function anonymousMeResponse() {
  return { user: null };
}

/** `{ error: { code, message, fieldErrors?, requestId } }` — the single
 * error envelope documented for every failure class. */
export function errorEnvelope({
  code,
  message,
  fieldErrors,
  requestId = "req-fixture-1",
}) {
  return {
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      requestId,
    },
  };
}

export function validationErrorEnvelope(fieldErrors) {
  return errorEnvelope({
    code: "VALIDATION_ERROR",
    message: "Please check the highlighted fields.",
    fieldErrors,
  });
}

export function conflictErrorEnvelope(
  message = "An account with that email already exists.",
) {
  return errorEnvelope({ code: "CONFLICT", message });
}

export function unauthenticatedErrorEnvelope(message = "Incorrect email or password.") {
  return errorEnvelope({ code: "UNAUTHENTICATED", message });
}

export function notFoundErrorEnvelope(message = "No budget for this month.") {
  return errorEnvelope({ code: "NOT_FOUND", message });
}

export function internalErrorEnvelope(
  message = "Something went wrong. Please try again.",
) {
  return errorEnvelope({ code: "INTERNAL", message });
}
