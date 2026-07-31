-- CR-001 (docs/product/change-request-001.md), CR1-BUDGET: replace the
-- per-month budget_periods model with exactly ONE budget per user, applied
-- identically to every month. Expenses stay recorded per month, scoped by
-- occurred_on date ranges instead of budget_period_id.
--
-- migrate.js runs every migration file inside ONE transaction, so this whole
-- transform (create + backfill + re-index + drops) is atomic. Backfill rule:
-- latest month wins (the newest per-month plan is the user's latest statement
-- of intent; older variations are deliberately discarded — plan Risk 2).

-- 1. The new single-budget table: one row per user, enforced by UNIQUE.
CREATE TABLE IF NOT EXISTS budgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency_code text NOT NULL DEFAULT 'USD',
  income_minor  bigint NOT NULL CHECK (income_minor >= 0),
  categories    jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Backfill from budget_periods — latest month wins — extending the stored
--    five categories with the two new CR2 categories (Subscriptions,
--    Utilities) so every budget carries the fixed set of seven.
INSERT INTO budgets (user_id, currency_code, income_minor, categories)
SELECT DISTINCT ON (user_id) user_id, currency_code, income_minor,
       categories || '[
         {"id":"subscriptions","name":"Subscriptions","icon":"Repeat","color":"coral","displayOrder":6,"plannedMinor":60000},
         {"id":"utilities","name":"Utilities","icon":"Plug","color":"green","displayOrder":7,"plannedMinor":120000}
       ]'::jsonb
FROM budget_periods
ORDER BY user_id, month DESC;

-- 3. Users who never created any budget get the documented default budget
--    (income 1,250,000 minor; the seven default plans totalling 1,200,000).
--    Together with auto-provisioning at registration (CR1-9) this makes the
--    budget row an invariant for every account.
INSERT INTO budgets (user_id, income_minor, categories)
SELECT id, 1250000, '[
  {"id":"housing","name":"Housing","icon":"House","color":"blue","displayOrder":1,"plannedMinor":400000},
  {"id":"groceries","name":"Groceries","icon":"ShoppingCart","color":"green","displayOrder":2,"plannedMinor":150000},
  {"id":"transport","name":"Transport","icon":"CarFront","color":"yellow","displayOrder":3,"plannedMinor":80000},
  {"id":"fun","name":"Fun","icon":"PartyPopper","color":"coral","displayOrder":4,"plannedMinor":90000},
  {"id":"savings","name":"Savings","icon":"PiggyBank","color":"blue","displayOrder":5,"plannedMinor":300000},
  {"id":"subscriptions","name":"Subscriptions","icon":"Repeat","color":"coral","displayOrder":6,"plannedMinor":60000},
  {"id":"utilities","name":"Utilities","icon":"Plug","color":"green","displayOrder":7,"plannedMinor":120000}
]'::jsonb
FROM users
WHERE id NOT IN (SELECT user_id FROM budgets);

-- 4. Re-scope transaction idempotency from (budget_period_id,
--    client_request_id) to (user_id, client_request_id). Dedupe first:
--    cross-period duplicates are theoretically possible; the oldest row
--    keeps its client_request_id.
UPDATE transactions t SET client_request_id = NULL
WHERE client_request_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM transactions e
  WHERE e.user_id = t.user_id
    AND e.client_request_id = t.client_request_id
    AND (e.created_at, e.id) < (t.created_at, t.id));

DROP INDEX IF EXISTS transactions_dedupe_idx, transactions_user_period_idx, transactions_period_date_idx;

-- 5. Month membership is fully derivable from occurred_on (always validated
--    to lie inside the requested month), so the stored month link would be
--    redundant denormalized state: drop it (its FK goes with the column).
ALTER TABLE transactions DROP COLUMN budget_period_id;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_dedupe_idx
  ON transactions (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions (user_id, occurred_on);

-- 6. The per-month model is gone (last, after backfill, same transaction).
DROP TABLE budget_periods;
