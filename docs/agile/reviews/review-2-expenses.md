# Review 2 — Expenses (Sprint 3 / Stage D)

Substitute for the roadmap's second major-review PR (see `developer/plan.md` →
"External-tool substitutions"). Findings and resolutions from this delivery
iteration's developer build/self-test of the expenses surface.

## Scope reviewed

- `GET/POST /api/v1/budgets/:month/transactions`,
  `DELETE /api/v1/budgets/:month/transactions/:id`.
- `server/src/services/transactionService.js`,
  `server/src/repositories/transactionRepo.js`,
  `server/src/validation/schemas.js` (transaction schemas).
- `client/src/components/ui/Dialog.jsx`,
  `client/src/features/budget/{AddExpenseDialog,ExpensePanel,DeleteExpenseConfirm}.jsx`,
  Budget page wiring (`BudgetPage.jsx`), expense react-query hooks.

## Findings and resolutions

| # | Finding | Resolution |
|---|---|---|
| 1 | `Dialog`'s focus-management effect originally listed `onClose` in its dependency array. Parents recreate `onClose` on every render, so each form keystroke re-ran the effect and stole focus back to the first focusable field mid-typing (caught by the D-EXP-F1 component test: note text spilled into the amount input). | The latest `onClose` lives in a ref; the effect depends only on `open`, running exactly once per open/close transition. Focus-trap, Escape, and focus-return behavior are covered by `client/tests/AddExpenseDialog.test.jsx`. |
| 2 | A malformed `:id` (`not-a-uuid`) on DELETE would have surfaced as a Postgres `22P02` cast error (500). | The service short-circuits non-UUID ids onto the same 404 path as missing/unowned transactions — byte-identical error body, no existence/ownership leak (verified by an integration test comparing the two bodies). |
| 3 | Multi-round-trip integration journeys exceeded vitest's 5 s default test timeout against the remote Neon endpoint (create → verify aggregate → delete → verify rollback ≈ 7 HTTP calls). | Explicit 30 s per-test timeouts on the transaction journey tests; not a product change. |
| 4 | Duplicate submission protection needed to survive both rapid double-clicks and post-failure retries. | Client: the Save button is disabled while pending (one call per attempt, tested), and one `clientRequestId` is generated per submission attempt-set — reused on retry, regenerated after success. Server: the partial unique index on `(budget_period_id, client_request_id)` returns the existing row with 200 on a retry (integration-tested: one row, 201 then 200). |
| 5 | The kit's icon map has no "delete" icon, but the roadmap requires expense deletion affordances. | Lucide `Trash2` (same family, outline style, 44×44 target) used for the history rows' delete buttons; `TriangleAlert` similarly used for error/overspent signaling. Flagged for design review as kit extensions. |

No open/unresolved findings for this stage's developer-owned scope.

## Evidence

- Automated (server): `server/tests/integration/transactions.test.js` —
  create → aggregate delta → delete → aggregate rollback; precision
  (1099 + 2101 = 3200 exactly); every D-EXP-B2 rejection mutates nothing;
  cross-user add/delete 404 without leaks; idempotent `clientRequestId`;
  nonexistent vs malformed id → identical 404 bodies; pagination bounds +
  deterministic ordering; no note text in request/error logs.
  `server/tests/unit/schemas.test.js` — transaction schema strictness.
- Automated (client): `client/tests/AddExpenseDialog.test.jsx` (focus
  trap/return, validation, single submit on double click, failed save
  preserves values and retries with the same `clientRequestId`, cancel is a
  no-op), `client/tests/DeleteExpenseConfirm.test.jsx` (names the exact
  transaction, confirm deletes, cancel is a no-op, failure keeps dialog).
- Manual verification of the mobile bottom-sheet/desktop dialog rendering is
  deferred to the developer self-test phase's viewport pass (D-EXP-D1 is
  design-review-owned for final acceptance).

## Outcome

Expenses surface passes every developer-owned acceptance check in this batch
(D-EXP-D2..D5 implementation, D-EXP-F1..F6, D-EXP-B1..B6). D-EXP-D1 visual
conformance and D-EXP-Q* rows remain owned by design review and QA
respectively, per the plan's acceptance-criteria table.
