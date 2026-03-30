-- KB Migration — run once to add knowledge base tables
-- Safe to re-run (all statements use CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE)

CREATE TABLE IF NOT EXISTS kb_articles (
  id              TEXT PRIMARY KEY,
  article_num     TEXT UNIQUE NOT NULL,
  article_type    TEXT NOT NULL DEFAULT 'kcs',
  title           TEXT NOT NULL,
  section1        TEXT NOT NULL DEFAULT '',
  section2        TEXT NOT NULL DEFAULT '',
  section3        TEXT NOT NULL DEFAULT '',
  section4        TEXT DEFAULT '',
  workday_path    TEXT DEFAULT '',
  category_id     TEXT DEFAULT '',
  countries       TEXT DEFAULT '["All EMEA"]',
  tags            TEXT DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft',
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
  helpful     INTEGER NOT NULL,
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
  snapshot    TEXT NOT NULL,
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

INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc1', 'Onboarding & Offboarding', 'New starter and leaver processes', '#00A28A', '', 1);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc2', 'Payroll & Compensation', 'Pay, salary changes, deductions', '#0E56A5', '', 2);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc3', 'Benefits & Wellbeing', 'Employee benefits, EAP, health schemes', '#00A28A', '', 3);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc4', 'Leave & Absence', 'Annual leave, sick leave, parental leave', '#F5C017', '', 4);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc5', 'Performance & Development', 'Appraisals, objectives, learning', '#0E56A5', '', 5);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc6', 'Policies & Compliance', 'HR policies, GDPR, employment law', '#808284', '', 6);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc7', 'Workday Guides & QRGs', 'Step-by-step Workday how-to guides', '#FC1921', '', 7);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc8', 'SOPs', 'Standard Operating Procedures', '#231F20', '', 8);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc9', 'Recruitment & Hiring', 'Vacancy management, offers, onboarding', '#00A28A', '', 9);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc10', 'EMEA Country Guides', 'Country-specific HR rules and practices', '#0E56A5', '', 10);
INSERT OR IGNORE INTO kb_categories (id, name, description, color, icon, sort_order) VALUES ('kbc11', 'General HR Queries', 'Miscellaneous HR questions and answers', '#808284', '', 11);
