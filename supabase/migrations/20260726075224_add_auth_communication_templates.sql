/*
# Auth, Communication, and Templates schema

1. New Tables
- `app_users` — simple team authentication (name, password_hash, role, avatar_color)
- `communications` — communication tracking log (channel, subject, contact, direction, status, project_id, notes, date)
- `templates` — quick-access templates (name, type, tool, url, project_id, description)

2. Security
- RLS enabled on all new tables; single-tenant so anon + authenticated have full CRUD.
*/

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  avatar_color text NOT NULL DEFAULT '#2563eb',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_users" ON app_users;
CREATE POLICY "anon_select_users" ON app_users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON app_users;
CREATE POLICY "anon_insert_users" ON app_users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON app_users;
CREATE POLICY "anon_update_users" ON app_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON app_users;
CREATE POLICY "anon_delete_users" ON app_users FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'email',
  direction text NOT NULL DEFAULT 'outbound',
  subject text NOT NULL DEFAULT '',
  contact text DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_name text DEFAULT '',
  notes text DEFAULT '',
  comm_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_comms" ON communications;
CREATE POLICY "anon_select_comms" ON communications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_comms" ON communications;
CREATE POLICY "anon_insert_comms" ON communications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_comms" ON communications;
CREATE POLICY "anon_update_comms" ON communications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_comms" ON communications;
CREATE POLICY "anon_delete_comms" ON communications FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'design',
  tool text NOT NULL DEFAULT 'canva',
  url text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  description text DEFAULT '',
  thumbnail text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_tpl" ON templates;
CREATE POLICY "anon_select_tpl" ON templates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tpl" ON templates;
CREATE POLICY "anon_insert_tpl" ON templates FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tpl" ON templates;
CREATE POLICY "anon_update_tpl" ON templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tpl" ON templates;
CREATE POLICY "anon_delete_tpl" ON templates FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_comms_date ON communications(comm_date DESC);
CREATE INDEX IF NOT EXISTS idx_tpl_project ON templates(project_id);

-- Seed default users (Julien and Nils)
INSERT INTO app_users (name, password, role, avatar_color)
VALUES ('Julien', '456', 'admin', '#2563eb'),
       ('Nils', '123', 'member', '#dc2626')
ON CONFLICT (name) DO NOTHING;

-- Seed a few starter templates
INSERT INTO templates (name, type, tool, url, description) VALUES
('Présentation Pro — Canva', 'design', 'canva', 'https://www.canva.com/design', 'Modèle de présentation professionnelle pour pitch client'),
('Affiche Évènement — Canva', 'design', 'canva', 'https://www.canva.com/posters', 'Affiche pour évènements sport automobile'),
('Logo Kit — Photoshop', 'design', 'photoshop', 'https://www.adobe.com/products/photoshop.html', 'Kit de création de logo sur Photoshop'),
('Rapport Mensuel — Canva', 'document', 'canva', 'https://www.canva.com/reports', 'Template de rapport mensuel d''activité'),
('Mockup Produit — Photoshop', 'design', 'photoshop', 'https://www.adobe.com/products/photoshop.html', 'Mockup produit sur Photoshop')
ON CONFLICT DO NOTHING;
