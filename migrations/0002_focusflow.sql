-- ============================================================================
-- FocusFlow — D1 Schema
-- Migration: 0002_focusflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS focusflow_users (
  id                   TEXT PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  name                 TEXT,
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  preferred_session_mins INTEGER NOT NULL DEFAULT 25,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS focusflow_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES focusflow_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS focusflow_tasks (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES focusflow_users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  bucket          TEXT NOT NULL DEFAULT 'SOON'
                  CHECK(bucket IN ('NOW','SOON','LATER')),
  effort          TEXT NOT NULL DEFAULT 'MEDIUM'
                  CHECK(effort IN ('LOW','MEDIUM','HIGH')),
  duration_mins   INTEGER NOT NULL DEFAULT 25,
  status          TEXT NOT NULL DEFAULT 'ACTIVE'
                  CHECK(status IN ('ACTIVE','COMPLETED','ARCHIVED')),
  resistance_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS focusflow_task_steps (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES focusflow_tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS focusflow_focus_sessions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES focusflow_users(id) ON DELETE CASCADE,
  task_id        TEXT NOT NULL REFERENCES focusflow_tasks(id) ON DELETE CASCADE,
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at       TEXT,
  duration_mins  INTEGER,
  status         TEXT NOT NULL DEFAULT 'ACTIVE'
                 CHECK(status IN ('ACTIVE','COMPLETED','PAUSED','ABANDONED')),
  steps_completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS focusflow_distractions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES focusflow_focus_sessions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES focusflow_users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS focusflow_scheduled_blocks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES focusflow_users(id) ON DELETE CASCADE,
  task_id    TEXT,
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ff_tasks_user     ON focusflow_tasks(user_id, status, bucket);
CREATE INDEX IF NOT EXISTS idx_ff_sessions_token ON focusflow_sessions(id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ff_steps_task     ON focusflow_task_steps(task_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ff_focus_user     ON focusflow_focus_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ff_blocks_user    ON focusflow_scheduled_blocks(user_id, date);
