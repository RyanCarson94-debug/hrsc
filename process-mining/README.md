# HRSC Process Mining

Interactive process mining dashboard for HR Service Centres running ServiceNow HRSD and Workday.

## Quick Start

```bash
pip install -r requirements.txt
python app.py
# Opens at http://localhost:8050
```

## Deployment (Render.com)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Deploy**
5. App is live at `https://hrsc-process-mining.onrender.com`

---

## What to Export from ServiceNow

**Table:** `sn_hr_core_case`

**Fields:**
```
number, opened_at, closed_at, state, category, subcategory,
assignment_group, assigned_to, contact_type, resolved_at,
escalated, reopened_count, country, sla_due, short_description
```

**How to export:**
1. Open ServiceNow → HR Service Centre → Cases
2. Set your date range filter
3. Right-click column header → Export → CSV

---

## What to Export from Workday

**Report:** Business Process Transactions (Report Writer or custom)

**Fields:**
```
transaction_id, business_process_type, initiated_date,
completed_date, status, step_name, step_status, assignee,
country, worker_id, corrected, correction_reason
```

**How to export:**
1. Workday → Reports → Business Process Transactions
2. Set date range, click Run
3. Actions → Export → CSV or XLSX

> **Important:** Anonymise `worker_id` values before upload.

---

## Optional: Advisor Roster

Upload a CSV with columns: `advisor_id, name, tier, country, team`

This maps raw `assigned_to` values to Tier 1/2 for split analysis.

---

## Features

| Priority | Feature |
|----------|---------|
| P1 | File upload with schema validation |
| P1 | Process map (Directly-Follows Graph) |
| P1 | Variant analysis table |
| P1 | KPI strip (cases, resolution, SLA, FCR, rework) |
| P2 | SLA breach analysis by category/country |
| P2 | Bottleneck heatmap (duration mode on process map) |
| P2 | Rework detection and root cause breakdown |
| P2 | Tier 1/2 split filter |
| P3 | Conformance checker against happy_path.json |
| P3 | Deviation report |
| P3 | In-app reference model editor |
| P4 | Automation candidate scoring |
| P4 | Country comparison |
| P4 | XLSX export |

## Reference Model

Edit `reference_models/happy_path.json` or use the in-app editor on the Conformance tab.

```json
{
  "Payroll Query": ["Case Opened", "Assigned to Tier 1", "Resolved", "Case Closed"]
}
```

## Architecture

```
process-mining/
├── app.py                  Dash app (layout + callbacks)
├── ingest/
│   ├── servicenow.py       Parse SN CSV → event log
│   └── workday.py          Parse WD CSV → event log
├── mining/
│   ├── discovery.py        DFG construction + layout
│   ├── stats.py            KPI + SLA + rework calculations
│   ├── variants.py         Variant extraction and ranking
│   └── conformance.py      Sequence-based conformance scoring
├── viz/
│   ├── process_map.py      Cytoscape elements from DFG
│   └── charts.py           Plotly chart components
├── reference_models/
│   └── happy_path.json     Editable SOP reference model
└── sample_data/
    └── generate.py         Synthetic data generator (seed=42)
```
