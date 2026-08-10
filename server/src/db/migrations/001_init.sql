CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month         text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  currency_code text NOT NULL DEFAULT 'USD',
  income_minor  bigint NOT NULL CHECK (income_minor >= 0),
  categories    jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_periods_user_month_unique UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS budget_periods_user_idx ON budget_periods (user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_period_id  uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  category_id       text NOT NULL,
  type              text NOT NULL DEFAULT 'expense' CHECK (type = 'expense'),
  amount_minor      bigint NOT NULL CHECK (amount_minor > 0),
  occurred_on       date NOT NULL,
  note              text CHECK (note IS NULL OR char_length(note) <= 200),
  client_request_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_dedupe_idx
  ON transactions (budget_period_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_user_period_idx
  ON transactions (user_id, budget_period_id);
CREATE INDEX IF NOT EXISTS transactions_period_date_idx
  ON transactions (budget_period_id, occurred_on);
