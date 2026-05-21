-- ============================================================================
-- HRSC Playbook — Schema
-- Migration: 0006_playbook
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbooks (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intake_fields (
  id          TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  field_key   TEXT NOT NULL,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('select','text','date','boolean')),
  options     TEXT NOT NULL DEFAULT '[]',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS steps (
  id          TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  system      TEXT NOT NULL DEFAULT 'manual' CHECK(system IN ('workday','servicenow','email','manual')),
  conditions  TEXT NOT NULL DEFAULT '{"always":true}',
  required    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS components (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  body   TEXT NOT NULL DEFAULT '',
  system TEXT NOT NULL DEFAULT 'manual',
  tags   TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS cases (
  id              TEXT PRIMARY KEY,
  playbook_id     TEXT NOT NULL REFERENCES playbooks(id),
  intake_data     TEXT NOT NULL DEFAULT '{}',
  completed_steps TEXT NOT NULL DEFAULT '[]',
  created_by      TEXT NOT NULL DEFAULT 'anonymous',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pb_fields_playbook ON intake_fields(playbook_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pb_steps_playbook  ON steps(playbook_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pb_cases_playbook  ON cases(playbook_id);
CREATE INDEX IF NOT EXISTS idx_pb_cases_user      ON cases(created_by);
CREATE INDEX IF NOT EXISTS idx_pb_cases_updated   ON cases(updated_at DESC);

-- ── Seed: Termination Playbook ────────────────────────────────────────────────

INSERT OR IGNORE INTO playbooks (id, slug, name, description, active) VALUES (
  'pb-termination',
  'termination',
  'Employee Termination',
  'End-to-end guidance for terminating an employee — from approval through system offboarding.',
  1
);

INSERT OR IGNORE INTO intake_fields (id, playbook_id, field_key, label, type, options, sort_order) VALUES
  ('if-term-01', 'pb-termination', 'termination_type', 'Termination type',       'select',  '["Voluntary","Involuntary"]',                    1),
  ('if-term-02', 'pb-termination', 'country',           'Employee country',        'select',  '["UK","DE","FR","ES","NL","IE","Other"]',         2),
  ('if-term-03', 'pb-termination', 'employee_type',     'Employment type',         'select',  '["Full-time","Part-time","Fixed-term"]',          3),
  ('if-term-04', 'pb-termination', 'notice_waived',     'Notice period waived?',   'boolean', '[]',                                             4),
  ('if-term-05', 'pb-termination', 'last_day',          'Last day of employment',  'date',    '[]',                                             5);

INSERT OR IGNORE INTO steps (id, playbook_id, sort_order, title, body, system, conditions, required) VALUES
(
  'st-term-01', 'pb-termination', 1,
  'Confirm termination approval',
  '## Confirm termination approval

Before proceeding, verify the termination has been formally approved.

**What you need:**
- Line manager approval (email or written confirmation)
- HRBP sign-off (required for involuntary terminations)
- Legal sign-off if the employee is on a protected characteristic leave (maternity, long-term sick, etc.)

**Check before continuing:**
- [ ] Termination reason is clearly documented
- [ ] No active grievance or disciplinary process is ongoing without HR review
- [ ] Employment contract reviewed for notice period, garden leave, and restrictive covenant clauses
- [ ] Payroll notified of expected last day',
  'manual', '{"always":true}', 1
),
(
  'st-term-02', 'pb-termination', 2,
  'Initiate termination in Workday',
  '## Initiate termination in Workday

**Navigate to:** Workday → *Worker* profile → *Actions* → *Job Change* → *Terminate Employee*

**Complete the termination form:**

1. **Termination Date** — enter the employee''s confirmed last day
2. **Reason for Termination** — select from the dropdown (must match the approved reason)
3. **Regrettable?** — indicate Y/N as agreed with the HRBP
4. **Primary Reason** — choose the most specific reason available
5. Review all details, then **Submit**

> **Important:** Workday will automatically trigger offboarding tasks to the manager and IT. Do not close the browser tab until you see the green confirmation screen.

**After submitting:**
- Note the Workday transaction ID for your records
- Confirm the effective date shown matches the agreed last day',
  'workday', '{"always":true}', 1
),
(
  'st-term-03', 'pb-termination', 3,
  'Send voluntary resignation acknowledgement',
  '## Send resignation acknowledgement

The employee has resigned voluntarily. Send a formal acknowledgement email within **2 business days** of receiving the resignation.

**Email template (adapt as needed):**

> Dear [Name],
>
> Thank you for your resignation letter dated [date]. I confirm your last day of employment with [Company] will be **[last day]**.
>
> Your notice period of [X weeks/months] runs from [start date] to [end date]. Please ensure a full handover is completed with your manager by [handover deadline].
>
> We will be in touch shortly with details about your final pay, P45, and any outstanding benefits.
>
> Kind regards,
> HR Services

**Send from:** Your HRSC shared mailbox
**CC:** Line manager, Payroll team

> Keep a copy of this email in the employee''s HR file.',
  'email', '{"termination_type":"Voluntary"}', 1
),
(
  'st-term-04', 'pb-termination', 4,
  'Raise offboarding case in ServiceNow',
  '## Raise offboarding case in ServiceNow

**Navigate to:** ServiceNow → *HR Service Delivery* → *Cases* → *Create New Case*

**Complete the case form:**

1. **Category:** Offboarding
2. **Subcategory:** Employee Termination
3. **Employee:** Search and select the employee by name or ID
4. **Last Day:** Enter the confirmed last day from Workday
5. **Termination Type:** Match to the value captured at intake
6. **Assign to:** HRSC Offboarding queue

**What happens automatically:**
- ServiceNow triggers IT deprovisioning tasks
- Leaver survey is scheduled and sent to the employee
- Manager receives offboarding checklist

> Note the ServiceNow case number and add it to your HR case notes. All correspondence about this termination should reference this case number.',
  'servicenow', '{"always":true}', 1
),
(
  'st-term-05', 'pb-termination', 5,
  'Complete German Works Council (Betriebsrat) notification',
  '## Works Council notification — Germany

German law (**BetrVG §102**) requires the Works Council (Betriebsrat) to be consulted **before** a dismissal takes effect. Failure to comply renders the dismissal void.

**Steps:**

1. Prepare the §102 consultation letter — use the standard HRSC template (SharePoint → *DE Templates* → *Betriebsrat Anhörung*)
2. Deliver to the Betriebsrat chair by **recorded delivery or signed receipt**
3. Allow the statutory objection period before the termination date:
   - **Ordinary dismissal:** 1 week
   - **Extraordinary (summary) dismissal:** 3 days

> **Do not set the Workday termination effective date until the objection period has elapsed.**

**Document in ServiceNow:**
- Date the notification was delivered
- Receipt confirmation or delivery reference
- Date the objection period expired',
  'manual', '{"country":"DE"}', 1
),
(
  'st-term-06', 'pb-termination', 6,
  'Arrange immediate system access revocation',
  '## Immediate system access revocation

The employee is being terminated involuntarily with notice waived. System access must be revoked **at the agreed time on or before the last day** — typically at the start of the termination meeting.

**Coordinate with IT:**

1. Raise an urgent IT request in ServiceNow (link to the offboarding case created in the previous step)
2. Agree a specific cut-off time with IT and the line manager
3. Ensure access revocation covers:
   - Corporate email and calendar
   - Workday self-service
   - Slack / Microsoft Teams
   - VPN and remote access
   - Any role-specific system access (Salesforce, Workday HCM, etc.)

**HR responsibility at the termination meeting:**
- Collect company property: laptop, phone, key fob, ID badge
- Confirm with IT (via phone or message) that all access is disabled before the employee leaves the building
- Log the exact time of access revocation in the ServiceNow case',
  'manual', '{"termination_type":"Involuntary","notice_waived":"true"}', 1
),
(
  'st-term-07', 'pb-termination', 7,
  'Confirm final pay with Payroll',
  '## Confirm final pay with Payroll

**Email Payroll** (payroll@company.com) with the subject line: *Final Pay — [Employee Name] — [Employee ID] — [Last Day]*

Include in your email:
- Employee name and ID
- Confirmed last day of employment
- Notice period dates — or confirmation that notice is waived
- Outstanding annual leave balance to pay out (check with line manager)
- Any deductions: overpaid salary, season ticket loan, etc.
- Whether a Settlement Agreement affects pay calculations

**Check in Workday:**

Navigate to the employee profile → *Pay* → review any pending one-time payments. Confirm they are correct and remove any that are no longer applicable.

> **Payroll cutoff:** If the last day falls after the monthly payroll cutoff, coordinate with Payroll on whether to process in the current or following payroll run.',
  'workday', '{"always":true}', 1
),
(
  'st-term-08', 'pb-termination', 8,
  'Archive employee file and close case',
  '## Archive employee file and close case

**Workday:**
- Confirm the termination event status shows **Complete**
- Download the employee''s signed contract and any amendment letters from their Documents tab
- Store in: SharePoint → *HR Archive* → *Leavers* → [Year] → [Employee Name]

**ServiceNow:**
- Confirm all sub-tasks are complete (IT deprovisioning ✓, leaver survey sent ✓)
- Add final case notes: termination date confirmed, reason, documents stored, payroll notified
- Set case status to **Resolved**

**Final checklist before closing:**
- [ ] Workday termination event in Complete status
- [ ] P45 (UK) or equivalent issued — confirmed with Payroll
- [ ] Final payslip reviewed and correct
- [ ] System access confirmed revoked
- [ ] Company property returned and logged
- [ ] Employee file archived in SharePoint
- [ ] ServiceNow case closed',
  'manual', '{"always":true}', 0
);
