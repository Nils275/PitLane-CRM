/*
# Create financial_forecasts table

1. New Tables
- `financial_forecasts`
  - `id` (uuid, primary key)
  - `label` (text, not null) — description of the forecast entry
  - `type` (text, not null) — 'income' or 'expense'
  - `amount` (numeric, not null, default 0) — forecasted amount in euros
  - `category` (text, default '') — e.g. Salaires, Marketing, Matériel
  - `month` (date, not null) — first day of the target month
  - `recurring` (boolean, default false) — whether this repeats monthly
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `financial_forecasts`.
- Allow anon + authenticated CRUD (single-tenant, no auth app).
*/

CREATE TABLE IF NOT EXISTS financial_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  amount numeric NOT NULL DEFAULT 0,
  category text DEFAULT '',
  month date NOT NULL DEFAULT CURRENT_DATE,
  recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financial_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_forecasts" ON financial_forecasts;
CREATE POLICY "anon_select_forecasts" ON financial_forecasts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_forecasts" ON financial_forecasts;
CREATE POLICY "anon_insert_forecasts" ON financial_forecasts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_forecasts" ON financial_forecasts;
CREATE POLICY "anon_update_forecasts" ON financial_forecasts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_forecasts" ON financial_forecasts;
CREATE POLICY "anon_delete_forecasts" ON financial_forecasts FOR DELETE
  TO anon, authenticated USING (true);
