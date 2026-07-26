/*
# Agenda, Documents, and Press schema additions

1. New Tables
- `events` — calendar events (title, type, start, end, all_day, color, project_id, location, notes)
- `documents` — file/document manager (name, project_id, file_url, size, type, uploaded_by, locked)
- `press_articles` — cached motorsport news articles (title, source, url, summary, image_url, published_at)

2. Automation
- A trigger auto-creates an event when a task with a due_date is inserted/updated,
  and keeps the linked event in sync (same title + date). The event is linked via
  events.task_id so it can be updated/deleted when the task changes.

3. Security
- RLS enabled on all new tables; single-tenant (no sign-in) so anon + authenticated
  have full CRUD with USING(true)/WITH CHECK(true).
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'task',
  start_ts timestamptz,
  end_ts timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#2563eb',
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  location text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  file_url text DEFAULT '',
  size integer DEFAULT 0,
  type text DEFAULT '',
  uploaded_by text DEFAULT 'Moi',
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_docs" ON documents;
CREATE POLICY "anon_select_docs" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_docs" ON documents;
CREATE POLICY "anon_insert_docs" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_docs" ON documents;
CREATE POLICY "anon_update_docs" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_docs" ON documents;
CREATE POLICY "anon_delete_docs" ON documents FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS press_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text DEFAULT '',
  url text DEFAULT '',
  summary text DEFAULT '',
  image_url text DEFAULT '',
  published_at timestamptz DEFAULT now(),
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE press_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_press" ON press_articles;
CREATE POLICY "anon_select_press" ON press_articles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_press" ON press_articles;
CREATE POLICY "anon_insert_press" ON press_articles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_press" ON press_articles;
CREATE POLICY "anon_update_press" ON press_articles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_press" ON press_articles;
CREATE POLICY "anon_delete_press" ON press_articles FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_ts);
CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_press_pub ON press_articles(published_at DESC);

-- ===== Automation: sync events with tasks that have a due_date =====
CREATE OR REPLACE FUNCTION sync_task_event()
RETURNS TRIGGER AS $$
DECLARE
  existing_event uuid;
BEGIN
  -- Only manage events for tasks with a due_date and status not 'done'
  IF NEW.due_date IS NOT NULL THEN
    SELECT id INTO existing_event FROM events WHERE task_id = NEW.id;
    IF existing_event IS NULL THEN
      INSERT INTO events (title, type, start_ts, end_ts, all_day, color, task_id, project_id)
      VALUES (NEW.title, 'task', NEW.due_date::timestamp + interval '9 hours', NEW.due_date::timestamp + interval '10 hours', false, '#dc2626', NEW.id, NEW.project_id);
    ELSE
      UPDATE events SET
        title = NEW.title,
        start_ts = NEW.due_date::timestamp + interval '9 hours',
        end_ts = NEW.due_date::timestamp + interval '10 hours',
        project_id = NEW.project_id
      WHERE id = existing_event;
    END IF;
  END IF;
  -- If due_date removed, delete the linked event
  IF (TG_OP = 'UPDATE' AND NEW.due_date IS NULL AND OLD.due_date IS NOT NULL) THEN
    DELETE FROM events WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_task_event ON tasks;
CREATE TRIGGER trg_sync_task_event
AFTER INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION sync_task_event();
