-- ============================================================================
-- Work HQ — Meetings schema
-- Migration: 0005_workhq_meetings
-- ============================================================================

CREATE TABLE IF NOT EXISTS workhq_meetings (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  date        TEXT,
  attendees   TEXT,
  area        TEXT NOT NULL DEFAULT 'Other'
              CHECK(area IN ('HRSC Ops','Projects','People','Strategy','Admin','Other')),
  status      TEXT NOT NULL DEFAULT 'Upcoming'
              CHECK(status IN ('Upcoming','In Progress','Done')),
  prep_notes  TEXT,
  notes       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workhq_talking_points (
  id          TEXT PRIMARY KEY,
  meeting_id  TEXT NOT NULL REFERENCES workhq_meetings(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Link tasks to a meeting (optional — populated when actions are captured)
ALTER TABLE workhq_tasks ADD COLUMN meeting_id TEXT REFERENCES workhq_meetings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wh_meetings_date   ON workhq_meetings(date);
CREATE INDEX IF NOT EXISTS idx_wh_tps_meeting     ON workhq_talking_points(meeting_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_wh_tasks_meeting   ON workhq_tasks(meeting_id);
