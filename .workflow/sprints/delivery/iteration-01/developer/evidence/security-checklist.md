# Stage H Security & Observability Checklist (D-SEC-*)

Executed 2026-07-31 on branch `feature/budgeting-app`. Automated proof lives
in `server/tests/integration/security.test.js` and
`server/tests/unit/logRotation.test.js` unless noted otherwise.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Session cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/` | PASS | `auth.test.js` ("registers, exposes /auth/me…"); flags asserted on the register response |
| 2 | Session cookie `Secure` in production | PASS | `security.test.js` "production cookie flags": real server booted with `NODE_ENV=production` asserts `Secure` |
| 3 | Helmet security headers present; `x-powered-by` hidden | PASS | `security.test.js` "security headers": CSP, `nosniff`, `x-frame-options`, referrer-policy, CORP asserted |
| 4 | CORS: allowlisted origin gets `Access-Control-Allow-Origin` + credentials; foreign origin gets neither (simple + preflight) | PASS | `security.test.js` "CORS allowlist" (2 tests). Hardening change: foreign origins now get `callback(null, false)` (no CORS headers) instead of an opaque 500 |
| 5 | Rate limiting effective (strict auth limiter → 429 envelope) | PASS | `auth.test.js` "auth rate limiting" (from Stage B, still green) |
| 6 | Oversized body (> 32 kb) → documented `413 PAYLOAD_TOO_LARGE` envelope with requestId | PASS | `security.test.js` "input limits". Fix applied: body-parser errors mapped in `errorHandler.js`; `requestId` middleware moved before the body parser |
| 7 | Malformed JSON body → `400 VALIDATION_ERROR`, never a 500 | PASS | `security.test.js` "input limits" |
| 8 | Injection corpus (`' OR 1=1--`, `"; DROP TABLE…`, `$where`, `pg_sleep`) as email/month/category → 400 validation; as note → stored verbatim as inert text; no SQL error ever surfaces (parameterized queries only) | PASS | `security.test.js` "injection-shaped input" (2 tests); repo layer grep: every query uses `$n` placeholders, zero string interpolation of user input |
| 9 | Ownership matrix: 7 private endpoints × anonymous → 401 `UNAUTHENTICATED`; × foreign authenticated user → 404 `NOT_FOUND` with no mutation and no existence leak | PASS | `security.test.js` "ownership matrix" — GET/PATCH `/budgets/:month`, GET/POST transactions, DELETE transaction, GET `/insights/:month`, GET `/auth/me`; owner data re-verified unchanged afterwards |
| 10 | ≥1 structured log entry per request; errors logged; logs contain no passwords/tokens/cookies/notes/full bodies | PASS | `health.test.js`, `auth.test.js` (password never in logs), `transactions.test.js` (note never in logs), `errorContract.test.js` + `errorHandler.js` redaction paths in `logging/logger.js` |
| 11 | Log rotation/retention bounds file growth | PASS | `logRotation.test.js`: real pino/pino-roll path with small bounds → multiple files, family ≤ keep+1, each file ≤ size bound + one flush batch. Production bounds stay 5 MB × 5 |
| 12 | Real-HTTP integration suite against a listening server + isolated schema | PASS | all files in `server/tests/integration/` (`app.listen(0)` + Node fetch + per-run `test_*` schema) |
| 13 | Production bundle free of secrets/debug logs | PASS | `npm run build`, then marker grep over `client/dist` for `DATABASE_URL`, `JWT_SECRET`, `postgres(ql)://`, `neon.tech`, `password_hash`, session-cookie values, and `console.log/debug` → zero matches (markers only; real values never echoed) |
| 14 | Coverage ≥ 70% lines/statements/functions (branches ≥ 60) enforced by both vitest configs | PASS | final: server 96.75/92.2/99.02 (stmts/branch/funcs, 108 tests), client 84.71/82.57/79.29 (71 tests); thresholds fail the run if breached |
| 15 | Smoke journey (register → create budget → add expense → verify aggregates → insights coherence → delete → logout) against a really-running server | PASS | `server/scripts/smoke.mjs` via `npm run smoke`: 15/15 checks, exit 0; exits 1 when the server is down (verified) |
| 16 | `npm audit` review | PASS with accepted items (below) | run 2026-07-31 |

## npm audit — accepted advisories (D-SEC-F4 rationale)

`npm audit --omit=dev`: **0 critical, 0 high; 2 moderate**, both in
`react-router`/`react-router-dom` 6.x:

- GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in `<Link>`/`useNavigate`)
- GHSA-337j-9hxr-rhxg (arbitrary constructor injection via
  `deserializeErrors()` in SSR hydration)

Accepted because the only non-breaking remediation is react-router v7 (a
major upgrade out of scope for this delivery), and neither is reachable
here: every navigation target in the app is an internal constant or a
server-derived `YYYY-MM` month string (never user-supplied URLs), and the
app does not use SSR/hydration (`deserializeErrors` is never invoked in a
client-only Vite SPA).

`npm audit` (including dev): additionally 9 high, all one advisory
(GHSA-mh99-v99m-4gvg, `brace-expansion` OOM DoS) reached only through
dev-time tooling chains (`eslint`/`@eslint/config-array`/`eslint-plugin-react`
/`glob` inside `@vitest/coverage-v8`). Accepted: these packages never ship in
the product bundle or run in the server process; they execute at lint/test
time on trusted repository input only, and the proposed `npm audit fix
--force` would install breaking major versions (eslint@10) mid-hardening.
Revisit on the next dependency refresh.

## Dead code / debug logging sweep

`grep -rn "console\.|debugger" server/src client/src`: remaining uses are
intentional operator-facing CLI output only — `config.js` (fail-fast variable
names), `index.js` (startup/shutdown lines), `migrate.js`/`demoSeed.js`
(script status), and `ErrorBoundary.jsx` (`console.error` for unhandled UI
errors, standard practice). No `console.log` debugging remains in request
paths and none survives into the production bundle (checklist #13).
