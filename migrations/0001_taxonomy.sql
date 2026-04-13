-- ============================================================================
-- HR Service Center Taxonomy Manager — D1 Schema
-- Migration: 0001_taxonomy
-- ============================================================================

PRAGMA journal_mode=WAL;

-- ----------------------------------------------------------------------------
-- Frameworks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS frameworks (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  framework_type    TEXT NOT NULL DEFAULT 'hrsc_taxonomy',
  source_basis      TEXT DEFAULT 'APQC-style HRSC',
  version_label     TEXT DEFAULT '1.0',
  status       TEXT NOT NULL DEFAULT 'draft'
                CHECK(status IN ('draft','active','archived')),
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Taxonomy Nodes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxonomy_nodes (
  id           TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  node_type    TEXT NOT NULL DEFAULT 'process'
                CHECK(node_type IN (
                  'domain','process_group','process','subprocess',
                  'service','service_category','case_category','request_type',
                  'knowledge_category','lifecycle_event','policy_topic',
                  'resolver_group','tag','custom'
                )),
  level        INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  full_path    TEXT,
  status       TEXT NOT NULL DEFAULT 'draft'
                CHECK(status IN ('draft','active','retired')),
  owner        TEXT,
  steward      TEXT,
  approver     TEXT,
  effective_from TEXT,
  effective_to   TEXT,
  version_label  TEXT,
  synonyms     TEXT NOT NULL DEFAULT '[]',
  keywords     TEXT NOT NULL DEFAULT '[]',
  region_applicability        TEXT,
  country_applicability       TEXT,
  business_unit_applicability TEXT,
  notes            TEXT,
  source_reference TEXT,
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(framework_id, code)
);

-- ----------------------------------------------------------------------------
-- Node Relationships  (non-hierarchical cross-links)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS node_relationships (
  id               TEXT PRIMARY KEY,
  framework_id     TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  source_node_id   TEXT NOT NULL REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  target_node_id   TEXT NOT NULL REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'related',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Change Log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_log (
  id           TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  node_id      TEXT,
  action_type  TEXT NOT NULL
                CHECK(action_type IN (
                  'created','updated','deleted','moved','status_changed',
                  'snapshot_created','imported','restored','bulk_import'
                )),
  field_changed TEXT,
  old_value    TEXT,
  new_value    TEXT,
  change_note  TEXT,
  changed_by   TEXT NOT NULL DEFAULT 'system',
  changed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Validation Issues
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validation_issues (
  id           TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  node_id      TEXT,
  severity     TEXT NOT NULL DEFAULT 'warning'
                CHECK(severity IN ('error','warning','info')),
  issue_type   TEXT NOT NULL,
  description  TEXT NOT NULL,
  suggested_fix TEXT,
  is_resolved  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);

-- ----------------------------------------------------------------------------
-- Import Jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_jobs (
  id             TEXT PRIMARY KEY,
  framework_id   TEXT REFERENCES frameworks(id),
  filename       TEXT,
  import_type    TEXT NOT NULL DEFAULT 'xlsx',
  status         TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','processing','preview','completed','failed')),
  row_count      INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count  INTEGER NOT NULL DEFAULT 0,
  error_count    INTEGER NOT NULL DEFAULT 0,
  summary        TEXT NOT NULL DEFAULT '{}',
  errors         TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at   TEXT
);

-- ----------------------------------------------------------------------------
-- Export Jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS export_jobs (
  id           TEXT PRIMARY KEY,
  framework_id TEXT REFERENCES frameworks(id),
  export_type  TEXT NOT NULL DEFAULT 'xlsx',
  filename     TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','processing','completed','failed')),
  node_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- ----------------------------------------------------------------------------
-- Snapshots / Versions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
  id             TEXT PRIMARY KEY,
  framework_id   TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  version_label  TEXT NOT NULL,
  node_count     INTEGER NOT NULL DEFAULT 0,
  snapshot_data  TEXT NOT NULL DEFAULT '{}',
  snapshot_notes TEXT,
  created_by     TEXT NOT NULL DEFAULT 'system',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_nodes_framework  ON taxonomy_nodes(framework_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_nodes_parent     ON taxonomy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status     ON taxonomy_nodes(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_nodes_code       ON taxonomy_nodes(framework_id, code);
CREATE INDEX IF NOT EXISTS idx_nodes_type       ON taxonomy_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_changelog_fw     ON change_log(framework_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_changelog_node   ON change_log(node_id);
CREATE INDEX IF NOT EXISTS idx_validation_fw    ON validation_issues(framework_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_snapshots_fw     ON snapshots(framework_id, created_at);
CREATE INDEX IF NOT EXISTS idx_imports_fw       ON import_jobs(framework_id, created_at);
CREATE INDEX IF NOT EXISTS idx_exports_fw       ON export_jobs(framework_id, created_at);
