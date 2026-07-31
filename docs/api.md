# Budgeting App — REST API Reference

Base URL: `/api/v1` (development: `http://localhost:4000/api/v1`). All
request and response bodies are JSON. All money values are **integer minor
units (cents)** — fields are suffixed `Minor`. All examples below are
sanitized captures from the integration suite (`server/tests/integration/`),
which runs every endpoint against a real listening server.

> **Contract revision — CR-001** (`docs/product/change-request-001.md`,
> applied by migration `002_single_budget.sql`, still `/api/v1`): each user
> now has exactly ONE recurring budget applied to every month
> (`/budget`, `/months/:month`), the fixed category set grew to seven
> (`subscriptions`, `utilities` added), and insights compare 1–3 selected
> months via `GET /insights?months=…`. The former per-month
> `/budgets/:month` endpoints are gone and answer `404`.

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

| Code                | Status | When                                                        |
| ------------------- | ------ | ----------------------------------------------------------- |
| `VALIDATION_ERROR`  | 400    | Invalid body/params/query, including unparseable JSON       |
| `UNAUTHENTICATED`   | 401    | Missing/invalid/expired session                             |
| `NOT_FOUND`         | 404    | Unknown route, missing resource, or another user's resource |
| `CONFLICT`          | 409    | Duplicate email, budget already exists                      |
| `PAYLOAD_TOO_LARGE` | 413    | Body over 32 kb                                             |
| `RATE_LIMITED`      | 429    | Rate limit exceeded                                         |
| `INTERNAL`          | 500    | Unexpected server error (safe generic message)              |

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

Registration also provisions the account's **default budget** (income
12,500.00; the seven default category plans) in the same request, so a new
user's Budget screen is populated immediately.

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

## Budget (single, recurring)

Each user has exactly **one** budget: an income plus planned amounts for the
seven fixed categories (`housing`, `groceries`, `transport`, `fun`,
`savings`, `subscriptions`, `utilities`). The same plans apply to every
calendar month; only actual spending is per month. Category names, icons,
colors, and order are server constants — clients send only
`{ id, plannedMinor }` pairs.

### Budget plan model (returned by `/budget` endpoints)

```json
{
  "budget": {
    "id": "a2936f20-…",
    "currencyCode": "USD",
    "incomeMinor": 1250000,
    "plannedMinor": 1200000,
    "availableMinor": 50000,
    "categories": [
      {
        "id": "housing",
        "name": "Housing",
        "icon": "House",
        "color": "blue",
        "displayOrder": 1,
        "plannedMinor": 400000
      }
    ]
  }
}
```

- No `month` and no actuals: the budget is month-independent (see
  `GET /months/:month` for the month read model).
- `plannedMinor` (top level) = Σ category plans; `availableMinor` = income −
  planned (may be **negative** — over-allocation is allowed and the UI warns).
- Default plans (minor units): housing 400000, groceries 150000, transport
  80000, fun 90000, savings 300000, subscriptions 60000, utilities 120000
  (total 1,200,000) with income 1,250,000.

### `GET /budget`

`200` plan model. `404` only in the defensive data-anomaly case (every
account is provisioned at registration).

### `POST /budget`

**No body** (any supplied key is rejected — the defaults are server
constants). `201` plan model. `409 CONFLICT` while a budget exists — this is
the defensive re-create path; the DB `UNIQUE (user_id)` constraint
arbitrates concurrent creates (one `201`, one `409`).

### `PATCH /budget`

Body (strict): `incomeMinor` and/or `categories` (a 1–7 element subset of
`{ id, plannedMinor }`, unique ids). At least one of the two must be present.
Amounts must be non-negative integers.

```json
{
  "incomeMinor": 1300000,
  "categories": [{ "id": "utilities", "plannedMinor": 90000 }]
}
```

`200` with the fully recalculated plan model. Untouched categories keep
their plans; the fixed set never shrinks or grows.

---

## Months (read model)

### `GET /months/:month`

`:month` strictly `YYYY-MM`. `200`: the single budget's plans plus THAT
month's actuals — every month shares identical plans and differs only in
actuals (a month with no expenses is a normal all-zero month, not a 404):

```json
{
  "budget": {
    "month": "2026-07",
    "id": "a2936f20-…",
    "currencyCode": "USD",
    "incomeMinor": 1250000,
    "plannedMinor": 1200000,
    "availableMinor": 50000,
    "actualMinor": 842000,
    "categories": [
      {
        "id": "housing",
        "name": "Housing",
        "icon": "House",
        "color": "blue",
        "displayOrder": 1,
        "plannedMinor": 400000,
        "actualMinor": 323600,
        "progressPercent": 81,
        "state": "normal"
      }
    ]
  }
}
```

- `progressPercent` = `Math.round(actual / planned × 100)`; values over 100
  are preserved.
- `state`: `"normal"` | `"overspent"` (actual > planned) | `"unplanned"`
  (planned = 0 and actual > 0 — then `progressPercent` is `null`).

## Transactions (expenses)

Expenses stay **per month**: month membership is derived from `occurredOn`
(date-range scoped queries — transactions no longer link to a budget row).

### `GET /months/:month/transactions?limit&offset`

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

### `POST /months/:month/transactions`

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
  creating a duplicate. Idempotency is scoped per
  `(user, clientRequestId)`.

`201` `{ "transaction": { … } }` (same shape as the list rows). `400` for an
unknown category, out-of-month date, non-positive/non-integer amount, or
oversized note — nothing is stored on rejection. `404` only in the
defensive missing-budget anomaly case.

### `DELETE /months/:month/transactions/:id`

`204` on success. Missing, unowned, malformed, and out-of-`:month` ids all
share one `404` body (no existence leak).

---

## Insights

### `GET /insights?months=YYYY-MM[,YYYY-MM[,YYYY-MM]]`

Multi-month comparison (CR-001 item 3): `months` is **required** — 1 to 3
unique `YYYY-MM` values, comma-separated. 0, 4+, duplicate, or malformed
values answer `400 VALIDATION_ERROR`. Response months are normalized
**newest-first** regardless of query order.

`200` (requires the user's budget row, else the defensive `404`):

```json
{
  "insights": {
    "months": [
      {
        "month": "2026-07",
        "label": "July",
        "yearLabel": "July 2026",
        "totalMinor": 842000,
        "cashFlow": {
          "labels": ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
          "cumulativeMinor": [98000, 213000, 313000, 500600, 640500, 754400, 842000]
        }
      },
      {
        "month": "2026-06",
        "label": "June",
        "yearLabel": "June 2026",
        "totalMinor": 918000,
        "cashFlow": {
          "labels": ["Jun 1", "Jun 6", "Jun 11", "Jun 16", "Jun 21", "Jun 26", "Jun 30"],
          "cumulativeMinor": [110000, 235000, 345000, 545000, 692000, 818000, 918000]
        }
      }
    ],
    "categories": [
      {
        "id": "housing",
        "label": "Housing",
        "color": "blue",
        "totalsMinor": [323600, 350000],
        "combinedMinor": 673600,
        "sharePercent": 38
      }
    ],
    "combinedTotalMinor": 1760000
  }
}
```

- `categories[].totalsMinor` aligns index-for-index with `insights.months`;
  `combinedMinor` is the sum across the selected months.
- **Per-month coherence guarantee:** for every selected month,
  Σ `categories[].totalsMinor[i]` = `months[i].totalMinor` = last
  `cumulativeMinor` point. The server refuses to respond (500) if its own
  aggregations disagree.
- `sharePercent` = the category's share of **combined** spending across the
  selection (largest-remainder method — integers totalling exactly **100**;
  an all-zero selection is all-zero). This drives the donut chart.
- Cash-flow samples: days 1, 6, 11, 16, 21, 26, and each month's own last
  day; series align by sample index.
- Cross-year selections (e.g. `2025-12,2026-01`) work by plain string month
  math.
- A selected month with no expenses returns zeros (zero total, flat zero
  cumulative series) — never an error.
- Only the authenticated user's transactions ever enter the aggregation.
- The former `GET /insights/:month` (fixed current + previous comparison)
  is superseded and no longer routed.

---

## Static serving (production convenience)

With `SERVE_CLIENT=true`, Express serves `client/dist` and answers every
non-`/api` GET with `index.html` (SPA fallback), so refreshing `/budget`,
`/insights`, etc. works without a separate web server. API routes are never
swallowed by the fallback (`server/tests/integration/serveClient.test.js`).
