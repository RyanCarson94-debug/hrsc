# HR Service Center Taxonomy Manager

A production-quality web application for building, maintaining, versioning, validating, and exporting an APQC-style HR Service Center process taxonomy — persisted in Cloudflare D1.

---

## What this is

This is not a generic note-taking or tree-editor tool. It is a **controlled taxonomy management system** designed for HR Service Center operations, modeled on the APQC process framework. It supports:

- Hierarchical taxonomy management (domain → process group → process → subprocess → ...)
- Full governance metadata (owner, steward, approver, effective dates)
- Rule-based validation engine (12 validation rules)
- Version snapshots with diff/compare/restore
- Excel import (XLSX/CSV) with preview, column mapping, and error reporting
- Excel export (6-sheet workbook)
- Full audit trail (change log)
- Cloudflare D1 persistence — no data in browser storage

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (dark theme) |
| State | Zustand |
| Routing | React Router v6 (HashRouter) |
| API | Cloudflare Pages Functions (JS) |
| Database | Cloudflare D1 (SQLite) |
| Excel | SheetJS (xlsx) |
| Icons | Lucide React |

---

## Project structure

```
hrsc/
├── migrations/
│   └── 0001_taxonomy.sql          # D1 schema — run once
├── functions/
│   └── taxonomy-api/
│       └── [[route]].js           # All API routes (/taxonomy-api/*)
├── taxonomy-manager/              # Frontend sub-app
│   ├── src/
│   │   ├── types/index.ts         # All TypeScript types
│   │   ├── lib/
│   │   │   ├── api.ts             # Typed API client
│   │   │   ├── utils.ts           # Tree builders, date helpers
│   │   │   └── export.ts          # Excel generation + import parsing
│   │   ├── store/index.ts         # Zustand global store
│   │   ├── components/
│   │   │   ├── ui/                # Button, Badge, Card, Modal, etc.
│   │   │   ├── layout/            # Sidebar + Layout shell
│   │   │   └── taxonomy/          # TreeView + NodeEditor
│   │   └── pages/
│   │       ├── Dashboard.tsx
│   │       ├── FrameworkExplorer.tsx
│   │       ├── ValidationCenter.tsx
│   │       ├── ImportCenter.tsx
│   │       ├── ExportCenter.tsx
│   │       └── VersionManager.tsx
│   ├── vite.config.ts             # base: /taxonomy-manager/
│   └── package.json
└── wrangler.toml                  # Cloudflare config (D1 binding)
```

---

## First-time setup

### 1. Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### 2. Create the D1 database

```bash
wrangler d1 create taxonomy-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding       = "TAXONOMY_DB"
database_name = "taxonomy-db"
database_id   = "PASTE_YOUR_ID_HERE"
```

### 3. Run the migration

```bash
# Against your remote D1 database
wrangler d1 execute taxonomy-db --file migrations/0001_taxonomy.sql

# Or for local dev
wrangler d1 execute taxonomy-db --local --file migrations/0001_taxonomy.sql
```

### 4. Install and build the frontend

```bash
cd taxonomy-manager
npm install
npm run build
```

### 5. Run locally

```bash
# From repo root — starts Cloudflare Pages dev server (includes D1 + Pages Functions)
wrangler pages dev dist --d1 TAXONOMY_DB=<your-database-id>
```

Then open: `http://localhost:8788/taxonomy-manager/`

For hot-reload frontend dev:
```bash
# Terminal 1 — wrangler (API + D1)
wrangler pages dev dist --d1 TAXONOMY_DB=<your-database-id> --port 8788

# Terminal 2 — Vite (frontend with proxy to wrangler)
cd taxonomy-manager && npm run dev
```
Open: `http://localhost:5174/taxonomy-manager/`

### 6. Load demo seed data

Once the app is running, click **"Seed Demo Data"** in the top header bar. This will create a full HRSC taxonomy with ~80 nodes across 13 domains (Workforce Administration, Benefits Administration, Payroll Support, Leave and Absence, Onboarding, Offboarding, HR Policy and Guidance, Employee Relations, HR Systems Support, Manager Support, Knowledge Management, Service Request Management, Workforce Planning).

---

## Deploy to Cloudflare Pages

```bash
# Build everything
npm run build        # from repo root

# Deploy
wrangler pages deploy dist
```

Or connect the GitHub repo to Cloudflare Pages in the dashboard, set the build command to `npm run build`, output directory to `dist`, and add the D1 binding under Settings → Functions → D1 database bindings (`TAXONOMY_DB`).

---

## Loading your own APQC taxonomy

### Option A: Excel Import (recommended)

1. Go to **Import Center**
2. Click **Download Import Template** to get the XLSX template with column instructions
3. Fill in your APQC-based hierarchy. Required columns: `code`, `name`, `node_type`. The `parent_code` column establishes hierarchy.
4. Upload the file, preview the rows, choose mode (`create` / `upsert`), then import.

Example rows for an APQC-style hierarchy:
```
code      | name                        | node_type     | parent_code | status | owner
HRSC      | HR Service Center Ops       | domain        |             | active | CHRO
WFA       | Workforce Administration    | process_group | HRSC        | active | HR Ops Lead
WFA.01    | Employee Data Management    | process       | WFA         | active | HR Ops
WFA.01.01 | Personal Info Updates       | subprocess    | WFA.01      | active | HR Ops
```

### Option B: API bulk import

POST to `/taxonomy-api/frameworks/:id/import` with:
```json
{
  "nodes": [...],
  "mode": "upsert",
  "on_duplicate": "overwrite",
  "filename": "my-apqc-taxonomy.json"
}
```

### Option C: Direct D1 SQL

For very large taxonomies, insert directly via D1:
```bash
wrangler d1 execute taxonomy-db --file my-taxonomy-seed.sql
```

---

## API reference

All routes are at `/taxonomy-api/*`. The Pages Function handles routing internally.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /dashboard | Aggregate stats |
| GET | /frameworks | List frameworks |
| POST | /frameworks | Create framework |
| GET | /frameworks/:id | Get framework |
| PUT | /frameworks/:id | Update framework |
| DELETE | /frameworks/:id | Soft-delete framework |
| GET | /frameworks/:id/nodes | All nodes (flat) |
| POST | /frameworks/:id/nodes | Create node |
| GET | /nodes/:id | Get node |
| PUT | /nodes/:id | Update node |
| DELETE | /nodes/:id | Soft-delete node |
| POST | /nodes/:id/move | Reparent node |
| GET | /frameworks/:id/search | Search nodes |
| POST | /frameworks/:id/validate | Run validation |
| GET | /frameworks/:id/issues | Get issues |
| PUT | /issues/:id/resolve | Resolve issue |
| GET | /frameworks/:id/changelog | Change log |
| POST | /frameworks/:id/snapshot | Create snapshot |
| GET | /frameworks/:id/snapshots | List snapshots |
| GET | /snapshots/:id | Get snapshot |
| POST | /snapshots/:id/restore | Restore snapshot |
| POST | /snapshots/compare | Compare two snapshots |
| POST | /frameworks/:id/import | Import nodes |
| GET | /import/jobs | Import job history |
| POST | /frameworks/:id/export | Generate export data |
| GET | /export/jobs | Export job history |
| POST | /seed | Seed demo data |

---

## Validation rules

| Rule | Severity | Description |
|------|----------|-------------|
| duplicate_code | error | Same code on multiple nodes in framework |
| retired_parent_active_child | error | Retired parent with active children |
| invalid_effective_dates | error | effective_to before effective_from |
| orphan_node | error | Parent ID points to deleted/missing node |
| duplicate_name_sibling | warning | Same name under same parent |
| missing_description | warning | Active node has no description |
| missing_owner | warning | Active node has no owner |
| level_mismatch | warning | Stored level doesn't match actual depth |
| vague_label | info | Name is Other, Misc, TBD, N/A, etc. |
| too_many_children | info | Node has >15 direct children |
| no_children_domain | info | Domain/process_group has no children |
| missing_keywords | info | Active node has no keywords |

---

## Excel export sheets

| Sheet | Contents |
|-------|----------|
| Framework_Summary | Name, description, counts, export date |
| Taxonomy_Nodes | All 26 fields, flat, one row per node |
| Hierarchy_View | Indented display name, code, path, level, parent code |
| Validation_Issues | All open issues with severity and suggested fix |
| Change_Log | Full audit trail |
| Metadata_Lists | Node type, status, severity reference values |

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| TAXONOMY_DB | wrangler.toml (D1 binding) | D1 database binding name — must match exactly |
| CLOUDFLARE_ACCOUNT_ID | wrangler CLI env | Your Cloudflare account ID |

No secrets are required beyond the D1 binding. There is no auth layer in this version — add Cloudflare Access in front of the Pages deployment if access control is needed.

---

## Assumptions and tradeoffs

1. **No Next.js** — The existing project uses Vite + Cloudflare Pages Functions. Adding Next.js would require a full stack swap. Vite + Pages Functions is architecturally equivalent for this use case and deploys more cleanly to Cloudflare Pages.

2. **No Drizzle ORM** — Pages Functions are plain JS workers; Drizzle requires a build step. The D1 native query API is used directly, which is simpler and has no bundle overhead.

3. **Client-side Excel generation** — The export endpoint returns JSON; the browser generates the `.xlsx` file using SheetJS. This avoids binary response handling complexity in the Worker and keeps the export format flexible.

4. **HashRouter** — Used instead of BrowserRouter to avoid 404 issues on deep links in Cloudflare Pages SPA deployments without a `_redirects` file.

5. **Soft deletes** — Nodes and frameworks are soft-deleted (is_deleted=1) rather than hard-deleted to preserve audit trail integrity.

6. **Single-user** — There is no multi-user auth in this version. The `changed_by` field defaults to "system" unless supplied by the client. Add Cloudflare Access for org-level access control.

7. **Snapshot data stored in D1** — Full taxonomy snapshots are stored as JSON blobs in the `snapshots` table. For very large taxonomies (>10k nodes), consider moving snapshot_data to R2 and storing only a reference in D1.
