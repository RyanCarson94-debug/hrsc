# HRSC Contract Builder

Employment contract and addendum generation tool for CSL's HR Service Centre, covering 23 EMEA countries.

Built with React + Vite, deployed on Cloudflare Pages, data stored in Cloudflare D1.

---

## One-time setup

### 1. Clone and install

```bash
git clone https://github.com/RyanCarson94-debug/hrsc.git
cd hrsc
npm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create hrsc-contract-builder
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hrsc-contract-builder"
database_id = "PASTE_YOUR_ID_HERE"
```

### 3. Initialise the database schema and seed data

```bash
# Local (for development)
npx wrangler d1 execute hrsc-contract-builder --local --file=schema.sql

# Remote (production)
npx wrangler d1 execute hrsc-contract-builder --file=schema.sql
```

### 4. Connect the repo to Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select the `RyanCarson94-debug/hrsc` repository
3. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Save and deploy — Cloudflare will build and deploy automatically on every push to `main`

### 5. Bind D1 to the Pages project

In the Cloudflare dashboard:

1. Go to your Pages project → **Settings** → **Functions** → **D1 database bindings**
2. Add binding: **Variable name** = `DB`, **D1 database** = `hrsc-contract-builder`
3. Redeploy (trigger a new push or use the **Retry deployment** button)

### 6. (Optional) Gate with Cloudflare Access / Entra ID SSO

1. Go to **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. Set the application domain to your Pages URL (e.g. `hrsc.pages.dev`)
3. Add an identity provider — choose **Microsoft Entra ID (Azure AD)**
4. Follow the Microsoft app registration steps Cloudflare shows you
5. Set a policy: allow `@csl.com` email domains (or a specific group)

This means anyone hitting the URL is automatically redirected to the CSL Microsoft login — no code changes needed.

---

## Local development

Run the Vite dev server and the Workers API together:

```bash
# Terminal 1 — React frontend (http://localhost:5173)
npm run dev

# Terminal 2 — Cloudflare Workers + D1 local emulation (http://localhost:8788)
npx wrangler pages dev dist --d1=DB --port=8788
```

The Vite config proxies `/api/*` to port 8788, so the frontend and API work together seamlessly in dev.

For local D1, Wrangler creates a SQLite file under `.wrangler/state/` — you can inspect it with any SQLite browser.

---

## Project structure

```
hrsc/
├── functions/
│   └── api/
│       └── [[route]].js      ← Cloudflare Pages Function (all API routes)
├── src/
│   ├── components/
│   │   ├── shared.jsx         ← Shared styles, primitives, helpers
│   │   ├── GenerateTab.jsx
│   │   ├── TemplatesTab.jsx
│   │   ├── ClausesTab.jsx
│   │   ├── RulesTab.jsx
│   │   └── SettingsTab.jsx
│   ├── api.js                 ← fetch() wrapper for all API calls
│   ├── useAppState.js         ← Central data hook (load + save helpers)
│   ├── defaults.js            ← Seed data (used as fallback on first load)
│   ├── App.jsx
│   └── main.jsx
├── public/
│   └── favicon.svg
├── index.html
├── schema.sql                 ← D1 schema + seed INSERT
├── wrangler.toml              ← Cloudflare config
├── vite.config.js
└── package.json
```

---

## API routes

All routes are handled by `functions/api/[[route]].js` and bound to D1 via the `DB` environment variable.

| Method | Path                  | Description              |
|--------|-----------------------|--------------------------|
| GET    | `/api/settings`       | Fetch settings blob      |
| PUT    | `/api/settings`       | Save settings blob       |
| GET    | `/api/templates`      | List all templates       |
| POST   | `/api/templates`      | Create template          |
| PUT    | `/api/templates/:id`  | Update template          |
| DELETE | `/api/templates/:id`  | Delete template          |
| GET    | `/api/clauses`        | List all clauses         |
| POST   | `/api/clauses`        | Create clause            |
| PUT    | `/api/clauses/:id`    | Update clause            |
| DELETE | `/api/clauses/:id`    | Delete clause            |
| GET    | `/api/rules`          | List all rules           |
| POST   | `/api/rules`          | Create rule              |
| PUT    | `/api/rules/:id`      | Update rule              |
| DELETE | `/api/rules/:id`      | Delete rule              |

---

## Clause numbering syntax

In clause content, use these blocks to insert auto-numbered lists:

```
@num{
Item one
Item two
Item three
}
```

Available formats:

| Syntax     | Output          |
|------------|-----------------|
| `@num{}`   | 1. 2. 3.        |
| `@alpha{}` | a. b. c.        |
| `@ALPHA{}` | A. B. C.        |
| `@roman{}` | i. ii. iii.     |
| `@ROMAN{}` | I. II. III.     |

Section-title numbering (flat or hierarchical) is configured per template and applied automatically at document generation time.

---

## Data model

All records are stored as JSON blobs in D1. The schema has four tables: `settings`, `templates`, `clauses`, `rules`. Each record carries its full JSON object plus a few indexed columns (country, entity_id, priority, active) to support future server-side filtering.

Settings (legal entities, dropdown lists) are stored as a single JSON blob under the key `main` in the `settings` table.
