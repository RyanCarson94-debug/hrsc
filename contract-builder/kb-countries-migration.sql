-- KB Countries Migration — run once to add the kb_countries table
-- Safe to re-run (uses CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE)

CREATE TABLE IF NOT EXISTS kb_countries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('United Kingdom', 1);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Germany', 2);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('France', 3);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Netherlands', 4);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Switzerland', 5);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Austria', 6);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Belgium', 7);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Ireland', 8);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Sweden', 9);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Norway', 10);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Denmark', 11);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Finland', 12);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Italy', 13);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Spain', 14);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Portugal', 15);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Poland', 16);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Czech Republic', 17);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Hungary', 18);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Romania', 19);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Turkey', 20);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('South Africa', 21);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('UAE', 22);
INSERT OR IGNORE INTO kb_countries (name, sort_order) VALUES ('Saudi Arabia', 23);
