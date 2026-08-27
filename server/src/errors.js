const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(code, message, { fieldErrors, status } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code] ?? 500;
    this.fieldErrors = fieldErrors;
  }
}

export { STATUS_BY_CODE };
