-- HRSC Contract Builder — D1 Schema
-- Run: npx wrangler d1 execute hrsc-contract-builder --file=schema.sql

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL          -- JSON blob
);

CREATE TABLE IF NOT EXISTS templates (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,    -- full JSON object
  country    TEXT,
  entity_id  TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clauses (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  is_global  INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rules (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  country    TEXT,
  entity_id  TEXT,
  priority   INTEGER DEFAULT 1,
  active     INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed: initial settings (entities + dropdowns)
INSERT OR IGNORE INTO settings (key, value) VALUES (
  'main',
  '{
    "entities": [
      {"id":"e1","name":"CSL Behring Ltd","countries":["United Kingdom","Germany","Netherlands","Belgium","Switzerland","Austria"],"shortCode":"CSL-B"},
      {"id":"e2","name":"CSL Seqirus Ltd","countries":["United Kingdom","Italy","Germany"],"shortCode":"CSL-S"},
      {"id":"e3","name":"CSL Plasma GmbH","countries":["Germany","Austria","Hungary","Czech Republic"],"shortCode":"CSL-P"},
      {"id":"e4","name":"CSL Vifor Ltd","countries":["Switzerland","Austria","Germany","France"],"shortCode":"CSL-V"}
    ],
    "dropdowns": {
      "businessUnits": [
        {"id":"bu1","label":"Commercial","entityIds":["e1","e2","e3","e4"],"global":false},
        {"id":"bu2","label":"R&D","entityIds":["e1","e2"],"global":false},
        {"id":"bu3","label":"Manufacturing","entityIds":["e1","e3"],"global":false},
        {"id":"bu4","label":"Finance","entityIds":[],"global":true},
        {"id":"bu5","label":"HR","entityIds":[],"global":true},
        {"id":"bu6","label":"IT","entityIds":[],"global":true},
        {"id":"bu7","label":"Legal","entityIds":[],"global":true},
        {"id":"bu8","label":"Medical Affairs","entityIds":["e1","e2"],"global":false}
      ],
      "employmentTypes": [
        {"id":"et1","label":"Full-time","global":true,"entityIds":[]},
        {"id":"et2","label":"Part-time","global":true,"entityIds":[]},
        {"id":"et3","label":"Fixed-term","global":true,"entityIds":[]},
        {"id":"et4","label":"Contractor","global":true,"entityIds":[]}
      ],
      "managerLevels": [
        {"id":"ml1","label":"Individual Contributor","global":true,"entityIds":[]},
        {"id":"ml2","label":"Team Lead","global":true,"entityIds":[]},
        {"id":"ml3","label":"Manager","global":true,"entityIds":[]},
        {"id":"ml4","label":"Senior Manager","global":true,"entityIds":[]},
        {"id":"ml5","label":"Director","global":true,"entityIds":[]},
        {"id":"ml6","label":"VP","global":true,"entityIds":[]},
        {"id":"ml7","label":"SVP","global":true,"entityIds":[]},
        {"id":"ml8","label":"C-Suite","global":true,"entityIds":[]}
      ]
    }
  }'
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_name TEXT NOT NULL,
  user_name   TEXT NOT NULL DEFAULT 'Unknown',
  detail      TEXT,
  timestamp   TEXT NOT NULL
);

-- Document generation snapshots
CREATE TABLE IF NOT EXISTS document_generations (
  id            TEXT PRIMARY KEY,
  template_name TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  country       TEXT,
  user_name     TEXT NOT NULL DEFAULT 'Unknown',
  generated_at  TEXT NOT NULL,
  snapshot      TEXT NOT NULL
);

-- Clause version history (snapshot on each content save)
CREATE TABLE IF NOT EXISTS clause_versions (
  id         TEXT PRIMARY KEY,
  clause_id  TEXT NOT NULL,
  content    TEXT NOT NULL,
  name       TEXT,
  saved_by   TEXT NOT NULL DEFAULT 'Unknown',
  saved_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users (for role-based access management)
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'Adviser',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- KNOWLEDGE BASE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_articles (
  id              TEXT PRIMARY KEY,
  article_num     TEXT UNIQUE NOT NULL,          -- KB-0001 sequential reference
  article_type    TEXT NOT NULL DEFAULT 'kcs',   -- kcs | qrg | sop
  title           TEXT NOT NULL,
  -- Section labels vary by type:
  --   KCS:  Issue | Environment | Resolution | Cause
  --   QRG:  Purpose | Prerequisites | Steps | Notes
  --   SOP:  Purpose & Scope | Roles & Responsibilities | Procedure | Related Documents
  section1        TEXT NOT NULL DEFAULT '',
  section2        TEXT NOT NULL DEFAULT '',
  section3        TEXT NOT NULL DEFAULT '',
  section4        TEXT DEFAULT '',
  workday_path    TEXT DEFAULT '',               -- QRG only: e.g. "Menu > Payroll > Run Payroll"
  category_id     TEXT DEFAULT '',
  countries       TEXT DEFAULT '["All EMEA"]',   -- JSON array
  tags            TEXT DEFAULT '[]',             -- JSON array
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | review | published | archived
  author_name     TEXT NOT NULL DEFAULT 'Unknown',
  reviewed_by     TEXT DEFAULT '',
  view_count      INTEGER DEFAULT 0,
  helpful_yes     INTEGER DEFAULT 0,
  helpful_no      INTEGER DEFAULT 0,
  last_reviewed_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kb_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#00A28A',
  icon        TEXT DEFAULT '',
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kb_feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  TEXT NOT NULL,
  helpful     INTEGER NOT NULL,   -- 1 = yes, 0 = no
  comment     TEXT DEFAULT '',
  user_name   TEXT DEFAULT 'Unknown',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kb_related (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  TEXT NOT NULL,
  related_id  TEXT NOT NULL,
  UNIQUE(article_id, related_id)
);

CREATE TABLE IF NOT EXISTS kb_versions (
  id          TEXT PRIMARY KEY,
  article_id  TEXT NOT NULL,
  snapshot    TEXT NOT NULL,   -- JSON of full article data before edit
  saved_by    TEXT NOT NULL DEFAULT 'Unknown',
  saved_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kb_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Unknown',
  comment     TEXT NOT NULL,
  resolved    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kb_favourites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(article_id, user_name)
);

CREATE TABLE IF NOT EXISTS kb_search_misses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  query       TEXT NOT NULL,
  user_name   TEXT DEFAULT 'Unknown',
  searched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed KB categories
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES
  ('kbc1',  'Onboarding & Offboarding',   'New starter and leaver processes',            '#00A28A', '🚀', 1),
  ('kbc2',  'Payroll & Compensation',      'Pay, salary changes, deductions',             '#0E56A5', '💰', 2),
  ('kbc3',  'Benefits & Wellbeing',        'Employee benefits, EAP, health schemes',      '#00A28A', '🌿', 3),
  ('kbc4',  'Leave & Absence',             'Annual leave, sick leave, parental leave',    '#F5C017', '📅', 4),
  ('kbc5',  'Performance & Development',  'Appraisals, objectives, learning',            '#0E56A5', '📈', 5),
  ('kbc6',  'Policies & Compliance',       'HR policies, GDPR, employment law',           '#808284', '📋', 6),
  ('kbc7',  'Workday Guides & QRGs',       'Step-by-step Workday how-to guides',          '#FC1921', '💻', 7),
  ('kbc8',  'SOPs',                        'Standard Operating Procedures',               '#231F20', '📄', 8),
  ('kbc9',  'Recruitment & Hiring',        'Vacancy management, offers, onboarding',      '#00A28A', '🎯', 9),
  ('kbc10', 'EMEA Country Guides',         'Country-specific HR rules and practices',     '#0E56A5', '🌍', 10),
  ('kbc11', 'General HR Queries',          'Miscellaneous HR questions and answers',      '#808284', '❓', 11);