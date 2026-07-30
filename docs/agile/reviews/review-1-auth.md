# Review 1 — Auth (Sprint 1 / Stage B)

Substitute for the roadmap's first major-review PR (see `developer/plan.md` →
"External-tool substitutions"). Findings and resolutions from this delivery
iteration's developer build/self-test of the auth surface.

## Scope reviewed

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`,
  `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- Session cookie (`bb_session`, HttpOnly, `SameSite=Lax`, `Secure` in
  production, 24h JWT).
- `client/src/pages/LoginPage.jsx`, `RegisterPage.jsx`,
  `client/src/app/AuthProvider.jsx`, `ProtectedRoute.jsx`,
  `PublicOnlyRoute.jsx`.

## Findings and resolutions

| # | Finding | Resolution |
|---|---|---|
| 1 | Neon's pooled connection endpoint rejects the `options=-c search_path=…` startup parameter used for per-test schema isolation. | `server/src/db/pool.js` sets `search_path` via a `SET` query on the pool's `connect` event instead of a connection-string startup option. |
| 2 | A bare (non-transactional) `SET search_path` on a plain `pg.Client` can silently fail to apply under concurrent connection establishment against Neon's pooled endpoint (observed as a migration landing in `public` instead of the isolated test schema, causing a spurious unique-constraint error). | `server/src/db/migrate.js` now wraps schema creation, `SET LOCAL search_path`, and every migration statement inside one transaction, which Postgres/PgBouncer-style pooling guarantees stays on one backend connection. Verified via a direct concurrent-`migrate()` repro (2/2 succeed, repeated 3x) and via `npm run coverage -w server`, which runs test files without `--no-file-parallelism`. |
| 3 | An eagerly-created module-level `config` singleton (created as an import side effect) locked in whatever `process.env` looked like at first import — before test-specific `DB_SCHEMA`/`LOG_DIR` overrides were set — silently defeating test isolation. | `config.js` now only exports `loadConfig()`; every consumer (real process, test harness) calls it explicitly with its own env. `db/pool.js` and `logging/logger.js` became factories (`createPool(config)`, `createLoggers(config)`) built once per `createApp(config)` call instead of shared singletons. |
| 4 | Mutating the shared `process.env` in the test harness (`startTestServer`) to pass `DB_SCHEMA`/`LOG_DIR` to the next dynamic import raced when multiple test files' `beforeAll` hooks interleaved under file-level parallelism. | `tests/integration/helpers/testServer.js` builds a local env object (`{ ...process.env, DB_SCHEMA, LOG_DIR, ... }`) and passes it directly to `loadConfig()`, never writing back to `process.env`. |
| 5 | `pino-http`'s default `req`/`res` serializers would have logged headers (including `Cookie`/`Authorization`) into `requests.log`. | Serializers are overridden to `undefined` (omitted entirely) and only explicit metadata fields (`requestId`, `userId`, `method`, `route`, `status`, `durationMs`) are logged — verified by an integration test asserting the log contains neither the request password nor the DB connection string/JWT secret. |

No open/unresolved findings for this stage's developer-owned scope.

## Evidence

- Automated: `server/tests/unit/{schemas,authService,authMiddleware}.test.js`,
  `server/tests/integration/auth.test.js` (register → me → logout → me 401;
  duplicate email 409; byte-identical unknown-email/wrong-password error
  bodies; malformed body 400; strict auth rate limit 429; no password in
  logs) — all passing, see
  `.workflow/sprints/delivery/iteration-01/developer/build-report.md`.
- Client: `client/tests/{LoginPage,RegisterPage,PasswordInput,Menu}.test.jsx`
  (validation messages, double-submit blocked, 409 mapped to the email
  field, password-visibility toggle keeps focus on the toggle, Logout menu
  item).
- Manual verification pending final design-review pass (D-AUTH-D1..D6 are
  design-reviewer-owned per the plan's acceptance-criteria table); the
  developer-owned portions of those rows (labels outside fields, toggle
  behavior, ≥44px targets, 320px/200% zoom layout) were implemented per the
  design kit and are recorded as implemented, not yet independently
  verified by design review.

## Outcome

Auth surface passes every developer-owned acceptance check in this batch
(D-AUTH-F1..F7, D-AUTH-B1..B7). D-AUTH-D* and D-AUTH-Q* rows remain owned by
design review and QA respectively, per the plan's acceptance-criteria table.
