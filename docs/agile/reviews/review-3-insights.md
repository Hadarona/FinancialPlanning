# Major Review 3 — Insights & Month Comparison (Sprint 5 / Stage F)

In-repo substitute for the roadmap's third major review PR (see
`developer/plan.md` → "External-tool substitutions"). Scope: the insights
aggregation API and the Insights screen with its three hand-rolled SVG
charts.

## What was reviewed

- `server/src/services/insightsService.js`, `server/src/services/calc.js`
  (`monthName`, `shortDateLabel`, `cashFlowSampleDates`, `cumulativeAtDates`),
  `server/src/repositories/transactionRepo.js` (`sumByDay`),
  `server/src/routes/insightsRoutes.js` + controller and `app.js` wiring.
- `client/src/features/insights/` (InsightsPage, charts/), the shared
  `components/ui/MonthTabs.jsx`, `api/hooks.js` (`useInsightsQuery`), and
  navigation entries (Budget menu → "View insights"; Insights back arrow
  and menu → Budget).

## Review findings and resolutions

1. **Coherence enforced with two independent aggregations.** The service
   computes the month total twice — Σ per-category sums and the last point
   of the per-day cumulative series — and refuses to respond (500 with a
   server-side diagnostic log, never a client detail) on mismatch
   (D-INS-B1/B2). Verified by the integration fixture asserting
   842,000/918,000 on both paths.
2. **Intermittent insights 500s exposed a real infrastructure bug (fixed
   in `db/pool.js`).** The coherence guard (#1) intermittently fired with
   "category total 0 != cumulative total 842000": one of the two concurrent
   aggregation queries ran against the wrong schema. Root cause: the
   Neon DATABASE_URL is the _pooled_ endpoint (pgbouncer in
   transaction-pooling mode), where batch 1's session-level
   `SET search_path` on the pool's `connect` event is silently unreliable —
   consecutive autocommit queries from one client can run on different
   server backends, and a query landing on a backend that never saw the SET
   reads the default schema. Fix: for non-`public` schemas (isolated test
   schemas), `pool.query` now wraps every statement in its own transaction
   with `SET LOCAL search_path` (`BEGIN; SET LOCAL ...` → query → `COMMIT`),
   which pins one backend for the statement. Verified with an 80-iteration
   repro harness (previously failed by attempt 3) and two consecutive fully
   green integration runs. Production/dev (`public` schema) behavior is
   unchanged. Follow-up latency effects: `budget.test.js` gained the same
   explicit 30 s timeouts the other integration files already had, and the
   insights service now runs its independent previous-month lookup in
   parallel with the current-month aggregation (perf guard: 1.6–1.8 s over
   1,000 transactions against remote Neon, within the 2 s hard cap; the
   <500 ms soft budget logs a warning as the plan's risk #2 anticipates).
3. **Donut adjacency vs the kit's double-blue.** The kit maps both Housing
   and Savings to the blue semantic. In one donut ring the two would meet
   where the ring wraps and be indistinguishable, so the Savings segment
   uses the kit's `--color-blue-700` step (validated ΔE 17 from blue-500;
   legend + hidden table carry the identities regardless). Flagged for
   design review as a recorded deviation.
4. **Palette validation (dataviz method).** The mandated kit pair
   blue-500/yellow-500 passes CVD separation (ΔE 28.3 protan / 27.2 tritan)
   and the normal-vision floor. The kit yellow sits outside the generic
   lightness band and below 3:1 contrast against the card surface —
   accepted as a kit-mandated color (D-FND-D1/D-INS-D1) with the mandatory
   relief implemented: previous-month bars carry a diagonal-line pattern,
   the previous-month line is dashed, legends and direct labels name every
   series, and every chart ships a visually-hidden data table.
5. **Sample-day semantics.** Cash-flow series sample days 1/6/11/16/21/26 +
   clamped last day per the REST contract; the previous month is sampled at
   its own days and plotted against the same seven x positions with the
   current month's labels (kit `cashFlow.labels` shows exactly this).
6. **Charts render at measured pixel width** (ResizeObserver) instead of
   scaling a fixed viewBox, so tick/category labels keep a fixed legible
   size at 320 px; bar category labels rotate below ~56 px per group and
   the line chart tightens its gutter below 240 px (D-INS-D5). The donut
   resizes 128–200 px with fixed-size center text.
7. **Desktop grid follows the kit responsive spec** (bar 8 columns + donut
   4 in one row, cash-flow full-width below). The approved desktop
   composition draws the bar chart full-width instead; the responsive-layout
   spec is the more explicit source and was chosen — flagged for design
   review. Mobile matches the composition (donut + cash-flow two-up when
   both columns keep ≥150 px, stacked at 320 px).
8. **Navigation entry points are voice-consistent extensions.** The kit
   defines no route between Budget and Insights; added "View insights" to
   the Budget menu and a back arrow (kit `ArrowLeft`, "Back to budget") on
   Insights. Flagged for design review like earlier copy extensions.
9. **`AppHeader` menu API generalized** (`menuItems` + always-appended
   Logout, optional back button) — BudgetPage behavior unchanged, covered
   by existing tests.

## Checks at review time

`npm run lint`, `npm test -w server` (52), `npm run test:integration -w
server` (37, real Neon HTTP), `npm test -w client` (51), `npm run build` —
all passing. End-to-end demo check: login as the seeded demo user, GET
`/api/v1/insights/2026-07` → July/June, 842,000/918,000, shares
[47,18,10,11,14], cumulative endpoints equal the totals. `EXPLAIN` confirms
both aggregations use `transactions_user_period_idx`.
