# Budgeting App — REST API Reference

Base URL: `/api/v1` (development: `http://localhost:4000/api/v1`). All
request and response bodies are JSON. All money values are **integer minor
units (cents)** — fields are suffixed `Minor`. All examples below are
sanitized captures from the integration suite (`server/tests/integration/`),
which runs every endpoint against a real listening server.

## Conventions

- **Authentication:** a signed JWT (HS256, 24 h) in an HTTP-only,
  `SameSite=Lax` cookie named `bb_session` (`Secure` in production). Cookies
  are set by `POST /auth/register` and `POST /auth/login` and cleared by
  `POST /auth/logout`. There are no bearer tokens.
- **Request correlation:** every response carries an `X-Request-Id` header;
  error bodies repeat it as `error.requestId`.
- **Validation:** request bodies are strict — unknown keys are rejected.
- **Body limit:** 32 kb; larger bodies get `413 PAYLOAD_TOO_LARGE`.
- **Rate limits:** 300 requests / 15 min generally, 10 / 15 min on
  `/auth/*` (configurable via env). Exceeding them returns `429 RATE_LIMITED`.
- **Dates:** plain calendar strings — months are `YYYY-MM`, dates are
  `YYYY-MM-DD`. No timezone math anywhere.
- **Ownership:** every private resource is filtered by the session user.
  Another user's resources answer `404 NOT_FOUND` — never `403`, and never
  any hint that the resource exists.

## Error contract

Every failure — including 404s and 500s — uses one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Safe, human-readable text.",
    "fieldErrors": { "email": "Enter a valid email address." },
    "requestId": "0b0e9c9a-6a4e-4f57-9f3e-1f6a4a2b7c1d"
  }
}
```

`fieldErrors` appears only on validation failures. Stack traces, SQL/driver
text, and file paths never reach a client.

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid body/params/query, including unparseable JSON |
| `UNAUTHENTICATED` | 401 | Missing/invalid/expired session |
| `NOT_FOUND` | 404 | Unknown route, missing resource, or another user's resource |
| `CONFLICT` | 409 | Duplicate email, duplicate budget month |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 32 kb |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL` | 500 | Unexpected server error (safe generic message) |

---

## Health

### `GET /health`

No auth. Returns `200`:

```json
{ "status": "ok", "uptimeSeconds": 42 }
```

---

## Auth

### `POST /auth/register`

Body (strict): `{ "email": "you@example.com", "password": "min 8, max 72 chars" }`
— email is trimmed and lowercased.

`201` + `Set-Cookie: bb_session=…`:

```json
{ "user": { "id": "7e6f0d8e-…", "email": "you@example.com" } }
```

Errors: `400` (invalid email/password, unknown keys), `409 CONFLICT` when
the normalized email already exists. Passwords are bcrypt-hashed and never
returned or logged.

### `POST /auth/login`

Body (strict): `{ "email": "you@example.com", "password": "…" }`

`200` + cookie, same `{ "user": … }` shape. Invalid credentials always get
the identical `401` body whether the email exists or not.

### `POST /auth/logout`

`204`, clears the session cookie. Requires auth.

### `GET /auth/me`

`200` `{ "user": { "id": "…", "email": "…" } }` or `401`.

---

## Budgets

One budget per user per calendar month; exactly the five fixed categories
(`housing`, `groceries`, `transport`, `fun`, `savings`). Category names,
icons, colors, and order are server constants — clients send only
`{ id, plannedMinor }` pairs.

### Budget read model (returned by all budget endpoints)

```json
{
  "budget": {
    "id": "b2a1…",
    "month": "2026-07",
    "currencyCode": "USD",
    "incomeMinor": 1250000,
    "plannedMinor": 1020000,
    "availableMinor": 230000,
    "actualMinor": 842000,
    "categories": [
      {
        "id": "housing",
        "name": "Housing",
        "icon": "House",
        "color": "blue",
        "displayOrder": 1,
        "plannedMinor": 400000,
        "actualMinor": 395700,
        "progressPercent": 99,
        "state": "normal"
      }
    ]
  }
}
```

- `plannedMinor` (top level) = Σ category plans; `availableMinor` = income −
  planned (may be **negative** — over-allocation is allowed and the UI warns).
- `progressPercent` = `Math.round(actual / planned × 100)`; values over 100
  are preserved.
- `state`: `"normal"` | `"overspent"` (actual > planned) | `"unplanned"`
  (planned = 0 and actual > 0 — then `progressPercent` is `null`).

### `GET /budgets/:month`

`:month` strictly `YYYY-MM`. `200` read model, `404` when the user has no
budget for that month.

### `POST /budgets`

Body (strict): month, income, and **exactly the five category ids once each**:

```json
{
  "month": "2026-07",
  "incomeMinor": 1250000,
  "categories": [
    { "id": "housing", "plannedMinor": 400000 },
    { "id": "groceries", "plannedMinor": 150000 },
    { "id": "transport", "plannedMinor": 80000 },
    { "id": "fun", "plannedMinor": 90000 },
    { "id": "savings", "plannedMinor": 300000 }
  ]
}
```

`201` read model. `409 CONFLICT` if the month already exists for this user
(the DB unique constraint arbitrates concurrent creates: one `201`, one
`409`). Amounts must be non-negative integers.

### `PATCH /budgets/:month`

Body (strict): `incomeMinor` and/or `categories` (a 1–5 element subset of
`{ id, plannedMinor }`, unique ids). At least one of the two must be present.
`200` with the fully recalculated read model; `404` for a month the user
does not own.

---

## Transactions (expenses)

### `GET /budgets/:month/transactions?limit&offset`

Query: `limit` 1–200 (default 50), `offset` ≥ 0 (default 0). Ordering is
deterministic: `occurred_on DESC, created_at DESC, id DESC`.

`200`:

```json
{
  "transactions": [
    {
      "id": "5f9a…",
      "categoryId": "groceries",
      "amountMinor": 4250,
      "occurredOn": "2026-07-15",
      "note": "Weekly shop",
      "createdAt": "2026-07-15T12:34:56.789Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### `POST /budgets/:month/transactions`

Body (strict):

```json
{
  "categoryId": "groceries",
  "amountMinor": 4250,
  "occurredOn": "2026-07-15",
  "note": "Weekly shop",
  "clientRequestId": "b0a3fbc6-88a5-4f5e-9d63-cf4f9a2a51d0"
}
```

- `amountMinor`: positive integer cents.
- `occurredOn`: must fall inside `:month` (validation error otherwise).
- `note`: optional, ≤ 200 chars (trimmed; never written to logs).
- `clientRequestId`: optional UUID for idempotent retries — a repeat with
  the same id returns the **existing** transaction with `200` instead of
  creating a duplicate.

`201` `{ "transaction": { … } }` (same shape as the list rows). `400` for an
unknown category, out-of-month date, non-positive/non-integer amount, or
oversized note — nothing is stored on rejection. `404` when the user has no
budget for `:month`.

### `DELETE /budgets/:month/transactions/:id`

`204` on success. Missing, unowned, and malformed ids all share one `404`
body (no existence leak).

---

## Insights

### `GET /insights/:month`

`200` (requires a budget for `:month`, else `404`):

```json
{
  "insights": {
    "month": "2026-07",
    "monthLabel": "July",
    "previousMonth": "2026-06",
    "previousMonthLabel": "June",
    "hasPrevious": true,
    "currentTotalMinor": 842000,
    "previousTotalMinor": 918000,
    "categories": [
      {
        "id": "housing",
        "label": "Housing",
        "color": "blue",
        "currentMinor": 395700,
        "previousMinor": 430000,
        "sharePercent": 47
      }
    ],
    "cashFlow": {
      "labels": ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
      "currentCumulativeMinor": [120000, 250000, 390000, 500000, 640000, 760000, 842000],
      "previousCumulativeMinor": [130000, 270000, 420000, 550000, 700000, 830000, 918000]
    }
  }
}
```

- Guaranteed coherence: Σ `categories[].currentMinor` =
  `currentTotalMinor` = last `currentCumulativeMinor` point (same for
  previous). The server refuses to respond (500) if its own aggregations
  disagree.
- `sharePercent` values are percentages of actual spending computed with the
  largest-remainder method, so they always total exactly **100** (all-zero
  months are all-zero).
- Cash-flow samples: days 1, 6, 11, 16, 21, 26, and the month's last day.
- January compares with December of the previous year.
- No previous-month budget → `hasPrevious: false`,
  `previousTotalMinor: null`, `previousMinor: null` per category, and an
  empty previous series — clients must show an explicit no-comparison state.
- Only the authenticated user's transactions ever enter the aggregation.

---

## Static serving (production convenience)

With `SERVE_CLIENT=true`, Express serves `client/dist` and answers every
non-`/api` GET with `index.html` (SPA fallback), so refreshing `/budget`,
`/insights`, etc. works without a separate web server. API routes are never
swallowed by the fallback (`server/tests/integration/serveClient.test.js`).
