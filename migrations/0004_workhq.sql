-- ============================================================================
-- Work HQ — D1 Schema
-- Migration: 0004_workhq
-- ============================================================================

CREATE TABLE IF NOT EXISTS workhq_tasks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  area        TEXT NOT NULL DEFAULT 'Other'
              CHECK(area IN ('HRSC Ops','Projects','People','Strategy','Admin','Other')),
  priority    TEXT NOT NULL DEFAULT 'Medium'
              CHECK(priority IN ('High','Medium','Low')),
  status      TEXT NOT NULL DEFAULT 'To Do'
              CHECK(status IN ('To Do','Active','Done','Blocked','Delegated')),
  due_date    TEXT,
  notes       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workhq_projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner       TEXT NOT NULL DEFAULT 'Ryan',
  priority    TEXT NOT NULL DEFAULT 'Medium'
              CHECK(priority IN ('High','Medium','Low')),
  status      TEXT NOT NULL DEFAULT 'Planning'
              CHECK(status IN ('Planning','Active','On Hold','Complete')),
  deadline    TEXT,
  next_action TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3 persistent focus slots (one row per slot, always exists)
CREATE TABLE IF NOT EXISTS workhq_focus_slots (
  slot_index  INTEGER PRIMARY KEY,   -- 0 = Top Priority, 1 = Medium, 2 = Quick Win
  task_id     TEXT REFERENCES workhq_tasks(id) ON DELETE SET NULL,
  done        INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO workhq_focus_slots (slot_index) VALUES (0), (1), (2);

CREATE INDEX IF NOT EXISTS idx_wh_tasks_status   ON workhq_tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_wh_tasks_due      ON workhq_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_wh_projects_status ON workhq_projects(status, priority);
