-- EMEA Law Monitor — D1 schema additions
-- Run against the existing D1 database:
--   npx wrangler d1 execute hrsc-contract-builder --remote --file=law-monitor-schema.sql

CREATE TABLE IF NOT EXISTS law_sources (
  id           TEXT PRIMARY KEY,
  country      TEXT NOT NULL,
  region       TEXT NOT NULL,        -- Europe | Middle East | Africa | International
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,        -- Official source page URL
  feed_url     TEXT,                 -- RSS/Atom feed URL (NULL = HTML monitor)
  feed_type    TEXT NOT NULL,        -- rss | atom | html
  last_checked TEXT,                 -- ISO datetime of last successful check
  content_hash TEXT,                 -- SHA-256 of page body (HTML sources only)
  active       INTEGER DEFAULT 1,    -- 1 = monitored, 0 = paused
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS law_changes (
  id           TEXT PRIMARY KEY,     -- SHA-256 derived from source_id + link
  source_id    TEXT NOT NULL REFERENCES law_sources(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  summary      TEXT,
  link         TEXT,                 -- URL to the specific change/document
  published_at TEXT,                 -- Publication date from feed (may be NULL)
  detected_at  TEXT DEFAULT (datetime('now')),
  category     TEXT DEFAULT 'general', -- minimum_wage | working_time | termination | leave | equality | health_safety | pensions | collective_rights | immigration | general
  is_read      INTEGER DEFAULT 0,
  is_starred   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_law_changes_detected  ON law_changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_law_changes_source    ON law_changes(source_id);
CREATE INDEX IF NOT EXISTS idx_law_changes_category  ON law_changes(category);
CREATE INDEX IF NOT EXISTS idx_law_changes_read      ON law_changes(is_read);
CREATE INDEX IF NOT EXISTS idx_law_sources_region    ON law_sources(region);
CREATE INDEX IF NOT EXISTS idx_law_sources_country   ON law_sources(country);
