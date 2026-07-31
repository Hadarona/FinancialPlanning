# Real-HTTP journey evidence (developer self-test)

Executed against a really-running server (`node server/src/index.js`, `SERVE_CLIENT=true`,
`ALLOW_DEMO_SEED=true`, `NODE_ENV=development`, port 4050) on 2026-07-31, using `curl`
with a cookie jar (real HTTP, not mocked). Demo credentials are the ones already
documented in `README.md` / `docs/demo-script.md`; not repeated here.

## Demo user journey (existing seeded data)

- `POST /auth/login` (demo user) -> 200 `{"user":{"id":"0661939e-...","email":"demo@example.com"}}`
- `GET /auth/me` (session restore) -> 200, same user body
- `GET /budgets/2026-07` -> 200:
  `incomeMinor:1250000, plannedMinor:1020000, availableMinor:230000, actualMinor:842000`
  categories actualMinor sum: 395700+151600+84200+92600+117900 = 842000 (matches actualMinor)
  category plannedMinor sum: 400000+150000+80000+90000+300000 = 1020000 (matches plannedMinor)
  -> reconciles with roadmap invariants: planned 10,200 / actual 8,420 (Section 2.2).
- `GET /insights/2026-07` -> 200:
  `currentTotalMinor:842000, previousTotalMinor:918000`,
  `sharePercent` per category: 47,18,10,11,14 (sum = 100, largest-remainder rule),
  `currentCumulativeMinor` last point 842000 (== currentTotalMinor),
  `previousCumulativeMinor` last point 918000 (== previousTotalMinor).

## Fresh-user journey (no seed; D-PLN-F1)

- `POST /auth/register` (new unique email) -> 201, session cookie set
- `GET /budgets/2026-07` (before creating) -> 404 `NOT_FOUND` "No budget for this month."
- `POST /budgets` (income 500000; plans 150000/80000/40000/30000/50000) -> 201, read model:
  `plannedMinor:350000, availableMinor:150000, actualMinor:0`
- `POST /budgets/2026-07/transactions` (groceries, amountMinor 2599) -> 201
- `GET /budgets/2026-07` -> `actualMinor:2599`, groceries `actualMinor:2599` (recalculated, no reload)
- `DELETE /budgets/2026-07/transactions/:id` -> 204
- `GET /budgets/2026-07` -> `actualMinor:0` (rolled back correctly)
- `PATCH /budgets/2026-07` (incomeMinor 600000; housing plannedMinor 200000) -> 200,
  `plannedMinor:400000, availableMinor:200000` (recalculated from stored authoritative fields)
- `GET /insights/2026-07` (no previous-month budget) -> 200 `hasPrevious:false`,
  `previousTotalMinor:null`, empty `previousCumulativeMinor` (explicit no-comparison state,
  not a 500 and not a fabricated 0% change)
- `POST /auth/logout` -> 204
- `GET /auth/me` -> 401 `UNAUTHENTICATED` (session invalidated)

## Rate limiting observed in passing

While repeatedly re-running browser evidence capture (see below), the strict auth
rate limiter (`RATE_LIMIT_AUTH_MAX`, default 10/15 min) returned a real 429 after
enough login attempts from automated tooling in a short window. The server was
restarted with `RATE_LIMIT_AUTH_MAX=1000` only for the remainder of the browser
evidence pass (D-AUTH-B... rate-limit *effectiveness* is independently proven by
`server/tests/integration/auth.test.js`'s dedicated low-limit test, which was
re-run unmodified and still passes).
