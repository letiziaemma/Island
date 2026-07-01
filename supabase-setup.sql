-- ============================================================
-- Iceland Trip — Supabase Database Setup
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- 1. Daily reflections
CREATE TABLE IF NOT EXISTS reflections (
  date          TEXT        NOT NULL,
  "user"        TEXT        NOT NULL,
  moments       TEXT        DEFAULT '',
  learnings     TEXT        DEFAULT '',
  song          TEXT        DEFAULT '',
  emoji         TEXT        DEFAULT '',
  submitted_at  TIMESTAMPTZ,
  is_submitted  BOOLEAN     DEFAULT FALSE,
  PRIMARY KEY (date, "user")
);
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON reflections;
CREATE POLICY "public_all" ON reflections FOR ALL USING (true) WITH CHECK (true);

-- 2. Meals (lunch / dinner per day)
CREATE TABLE IF NOT EXISTS meals (
  date       TEXT  NOT NULL,
  meal_type  TEXT  NOT NULL,
  dish       TEXT  DEFAULT '',
  tags       JSONB DEFAULT '[]',
  PRIMARY KEY (date, meal_type)
);
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON meals;
CREATE POLICY "public_all" ON meals FOR ALL USING (true) WITH CHECK (true);

-- 3. Custom stops added to today's itinerary
CREATE TABLE IF NOT EXISTS stops (
  id    TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date  TEXT NOT NULL,
  time  TEXT,
  url   TEXT
);
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON stops;
CREATE POLICY "public_all" ON stops FOR ALL USING (true) WITH CHECK (true);

-- 4. Hidden base itinerary items
CREATE TABLE IF NOT EXISTS hidden_stops (
  date        TEXT    NOT NULL,
  stop_index  INTEGER NOT NULL,
  PRIMARY KEY (date, stop_index)
);
ALTER TABLE hidden_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON hidden_stops;
CREATE POLICY "public_all" ON hidden_stops FOR ALL USING (true) WITH CHECK (true);

-- 5. Accommodation
CREATE TABLE IF NOT EXISTS accommodation (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  person         TEXT DEFAULT '',
  check_in_date  TEXT NOT NULL,
  check_in_time  TEXT,
  check_out_date TEXT NOT NULL,
  url            TEXT
);
ALTER TABLE accommodation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON accommodation;
CREATE POLICY "public_all" ON accommodation FOR ALL USING (true) WITH CHECK (true);

-- 6. Overview stops (milestones)
CREATE TABLE IF NOT EXISTS milestones (
  id    TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date  TEXT,
  time  TEXT,
  url   TEXT
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON milestones;
CREATE POLICY "public_all" ON milestones FOR ALL USING (true) WITH CHECK (true);

-- Enable real-time sync for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE reflections;
ALTER PUBLICATION supabase_realtime ADD TABLE meals;
ALTER PUBLICATION supabase_realtime ADD TABLE stops;
ALTER PUBLICATION supabase_realtime ADD TABLE hidden_stops;
ALTER PUBLICATION supabase_realtime ADD TABLE accommodation;
ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
