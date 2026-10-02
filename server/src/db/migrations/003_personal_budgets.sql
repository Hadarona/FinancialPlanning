-- Keep the original budget as an identity. Dated snapshots preserve history.
CREATE TABLE budget_versions (
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  effective_month text NOT NULL CHECK (effective_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  income_minor bigint NOT NULL CHECK (income_minor BETWEEN 0 AND 100000000000),
  categories jsonb NOT NULL,
  PRIMARY KEY (budget_id, effective_month)
);
INSERT INTO budget_versions SELECT id, '0001-01', income_minor,
  categories || '[{"id":"one-off","name":"One-off expenses","icon":"Sparkles","color":"coral","displayOrder":99,"plannedMinor":0}]'::jsonb
FROM budgets;
ALTER TABLE budgets ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE budgets ALTER COLUMN currency_code SET DEFAULT 'ILS';
-- Existing monetary values are never silently converted from another currency.
CREATE FUNCTION initialize_budget_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO budget_versions VALUES (NEW.id, '0001-01', NEW.income_minor, NEW.categories);
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_budget_version AFTER INSERT ON budgets
 FOR EACH ROW EXECUTE FUNCTION initialize_budget_version();

CREATE TABLE budget_members (
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  PRIMARY KEY (budget_id,user_id)
);
CREATE TABLE budget_invites (
  token_hash text PRIMARY KEY,
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
ALTER TABLE transactions ADD COLUMN import_key text;
ALTER TABLE transactions ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX transactions_import_unique ON transactions(user_id,import_key) WHERE import_key IS NOT NULL;
CREATE TABLE import_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rows jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour'
);
