-- ============================================================================
-- Multi-Country Termination Playbook
-- Migration: 0009_multicountry_termination_playbook
-- Source: HROPS024 (Feb 2026)
-- Countries: Poland, Romania, UAE, Hungary, Greece, Czech Republic,
--            Slovakia, France, Israel, Croatia
-- ============================================================================

INSERT OR IGNORE INTO playbooks (id, slug, name, description, active) VALUES (
  'pb-mc-term',
  'mc-termination',
  'Termination — PL / RO / UAE / HU / GR / CZ / SK / FR / IL / HR',
  'Termination process for Poland, Romania, UAE, Hungary, Greece, Czech Republic, Slovakia, France, Israel and Croatia. Covers Workday approval, OTP processing, and contract closure.',
  1
);

-- ── Intake Fields ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO intake_fields (id, playbook_id, field_key, label, type, options, sort_order) VALUES
  ('mc-if-01', 'pb-mc-term', 'country',          'Employee country',              'select',  '["Poland","Romania","UAE","Hungary","Greece","Czech Republic","Slovakia","France","Israel","Croatia"]', 1),
  ('mc-if-02', 'pb-mc-term', 'termination_type', 'Termination type',              'select',  '["Voluntary","Involuntary"]',                                                                            2),
  ('mc-if-03', 'pb-mc-term', 'good_leaver',      'Good Leaver? (STI eligible)',   'boolean', '[]',                                                                                                     3),
  ('mc-if-04', 'pb-mc-term', 'sign_on_bonus',    'Sign-on bonus repayment due?',  'boolean', '[]',                                                                                                     4);

-- ── Steps ─────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO steps (id, playbook_id, sort_order, title, body, system, conditions, required, dovetail_intent) VALUES
(
  'mc-st-01', 'pb-mc-term', 10,
  'Save attachments to employee record',
  '## Save attachments to employee record

Open the AskHR case in **ServiceNow** and save any applicable documents to the employee record before processing the termination.

**Documents to save (as applicable):**
- Resignation letter
- Termination / dismissal letter
- Settlement or mutual agreement documentation
- Any supporting correspondence from the manager or HRBP

> Attach documents directly to the employee profile in Workday or store in the designated SharePoint folder for the country. Record the storage location in the ServiceNow case notes.',
  'servicenow', '{"always":true}', 1, 'How do I save termination documents to an employee record in Workday?'
),
(
  'mc-st-02', 'pb-mc-term', 20,
  'Check leave date and notify payroll if late',
  '## Check leave date and notify payroll if late

Review the termination date in the case. If the notification has been received **after the payroll cut-off** for that country, email the relevant payroll team immediately.

**Payroll contacts by country:**

| Country | Payroll email |
|---|---|
| France | payroll.france@seqirus.com |
| Croatia | payroll.croatia@seqirus.com |
| Greece | payroll.greece@seqirus.com |
| Poland | payroll.poland@seqirus.com |
| Slovakia | payroll.slovakia@seqirus.com |
| Czech Republic | payroll.czechrepublic@seqirus.com |
| Hungary | payroll.hungary@seqirus.com |

> For Romania, UAE and Israel — check the HR intranet for the current payroll contact or raise via the local HR team.

**Email subject:** *Late Leaver Notification — [Employee Name] — [Employee ID] — Last Day [date]*

Include the employee name, ID, leave date, and ServiceNow case number. Reference the **Pay Dates Calendar** on the HR Knowledge Base to confirm whether the cut-off has passed.',
  'email', '{"always":true}', 0, NULL
),
(
  'mc-st-03', 'pb-mc-term', 30,
  'Determine Good Leaver status',
  '## Determine Good Leaver status

Confirm whether this employee is classified as a **Good Leaver**. Good Leavers are entitled to a pro-rated Short-Term Incentive (STI) payment.

**Standard Good Leaver qualifying reasons** (all countries):
- Death
- End of Limited Contract / Fixed-Term Contract
- Retirement

**Country exceptions — always Good Leaver regardless of leave reason:**

| Country | Rule |
|---|---|
| France | All leavers are Good Leavers |
| Czech Republic | All leavers are Good Leavers |
| Slovakia | All leavers are Good Leavers |

**Action:**
- If the employee qualifies → tick **Good Leaver** on this case and proceed to the STI request step
- If the employee does not qualify → skip the STI step and continue to the Workday approval

> If unsure, escalate to the HRBP before proceeding.',
  'manual', '{"always":true}', 1, 'Which employees qualify as good leavers for STI purposes in France, Czech Republic, Slovakia, Poland and other EMEA countries?'
),
(
  'mc-st-04', 'pb-mc-term', 40,
  'Request STI payment from Compensation & Benefits',
  '## Request STI payment from Compensation & Benefits

This employee is a Good Leaver and is entitled to a pro-rated STI payment. Email the **Compensation & Benefits** team using the STI Payment for Leaver email template.

**Email subject:** *STI Payment Request — Good Leaver — [Employee Name] — [Employee ID] — [Country]*

Include:
- Employee name and ID
- Country
- Leave date
- Leave reason / qualifying Good Leaver category
- ServiceNow case number

**Await the calculation** from C&B before processing the STI OTP in Workday. The payment amount and any supporting breakdown will be sent back to you.

> If no response within 3 business days, follow up and place the case **On Hold (Awaiting STI Calculation)** in ServiceNow.',
  'email', '{"good_leaver":"true"}', 1, 'How do I request an STI payment for a good leaver in EMEA?'
),
(
  'mc-st-05', 'pb-mc-term', 50,
  'Locate and approve termination task in Workday',
  '## Locate and approve termination task in Workday

**Navigate to:** Workday → **My Tasks** inbox tray → search for the employee by name to find the open termination task.

**Steps:**
1. Select the termination task for this employee
2. Review the details — confirm termination date and reason are correct
3. Add the **ServiceNow case number** in the comments field
4. Click **Approve**

**To make an amendment:**
- Select the pencil/edit icon to modify fields before approving
- Confirm changes with the manager or HRBP before editing

> If the task is not visible in My Tasks, navigate to the employee''s profile → **Actions** → **Business Process** → locate the active termination event.',
  'workday', '{"always":true}', 1, 'How do I locate and approve a termination task in Workday?'
),
(
  'mc-st-06', 'pb-mc-term', 60,
  'Check sign-on bonus repayment',
  '## Check sign-on bonus repayment

After approving the termination task, Workday may display a prompt to review sign-on bonus repayment. Follow this process:

1. If a **prompt appears** in Workday — select **To Do** (no action required on this screen) → select **Submit**
2. **Review** the employee''s employment contract and any bonus addendum letters to determine whether a repayment clause applies and whether the employee is within the repayment window
3. If a repayment **is required** — note the amount and process it as a negative OTP in the next step (CSL Plan)
4. If **no repayment** is required — document this in the case notes and continue

> Any repayment must be processed as a **negative One Time Payment** using the CSL Plan. Do not make deductions from salary directly.',
  'manual', '{"always":true}', 0, NULL
),
(
  'mc-st-07', 'pb-mc-term', 70,
  'Process One Time Payments in Workday',
  '## Process One Time Payments (OTP) in Workday

**Navigate to:** Employee record → **Actions** → **Compensation** → **Request One-Time Payment**

Set the **effective date** to the employee''s **termination date** for all OTPs.

Add the **ServiceNow case number** in the comments/notes field for every OTP created.

---

**STI Payment** *(Good Leavers only)*
- Plan: *Global STI Plan Payment – Out of Cycle*
- Notes: *Good Leaver STI payment FY[year] – [CASE NUMBER]*
- Attach the calculation provided by Compensation & Benefits
- Only process once C&B have confirmed the amount

---

**Sign-on Bonus Repayment** *(if applicable)*
- Plan: *CSL Plan*
- Notes: *Sign on bonus repayment – [CASE NUMBER]*
- Attach a breakdown of the calculation
- Enter the value with a **minus sign (–)** to process as a deduction, not a payment

---

> If neither OTP applies, this step can be skipped. Document the reason in the case notes.',
  'workday', '{"always":true}', 0, 'How do I process a Good Leaver STI one time payment in Workday?'
),
(
  'mc-st-08', 'pb-mc-term', 80,
  'Review Business Process History until OTPs approved',
  '## Review Business Process History

Regularly check Workday to confirm all OTP plans have been approved and completed.

**Navigate to:** Employee profile → **Job** → **Worker History** → **Business Process History**

**Confirm:**
- All OTP plans show status **Approved** / **Complete**
- No steps are stuck or awaiting action

**If approvals are pending:**
- Follow up with the approver(s) listed as awaiting action
- Place the ServiceNow case **On Hold** until all OTPs are fully approved
- Check back regularly until the Business Process History is fully complete

> OTPs must be approved before the termination date to ensure they are included in the correct pay run.',
  'workday', '{"always":true}', 1, 'How do I check Business Process History for OTP approval status in Workday?'
),
(
  'mc-st-09', 'pb-mc-term', 90,
  'Close HR Task and place case On Hold for manager tasks',
  '## Close HR Task in ServiceNow

**In ServiceNow:**
1. Open the leaver case
2. Select **HR Task** and click the task number to open it
3. Change the state to **Close Complete**
4. Click **Save**

**Important — manager offboarding tasks:**
Closing the HR Task automatically triggers the creation of **final offboarding tasks for the manager** to complete. The case will **not close** until the manager has finished these tasks.

- Place the case **On Hold** (awaiting manager completion) after closing the HR Task
- Monitor the case and follow up with the manager if tasks remain open beyond the termination date

> Once the manager completes their tasks, the case will move forward automatically. Review any remaining open HR Tasks and close them before moving the case to **Awaiting Acceptance**.',
  'servicenow', '{"always":true}', 1, NULL
),
(
  'mc-st-10', 'pb-mc-term', 100,
  'Close contract in Workday',
  '## Close contract in Workday

Once the termination date has been reached, an additional task will appear in Workday to close the employee''s contract.

**Steps:**
1. Navigate to the employee profile → **Job** → **Worker History**
2. Locate the **contract task** awaiting action and select it
3. Select **Open**
4. Confirm the **Status** is set to *Closed* and the **Contract End Date** is populated as the termination date
5. Click **Submit**
6. Select **Manage Business Process for Worker**
7. If there are outstanding actions in the employee''s Workday inbox, a step to **reassign tasks** may appear — no action is required, simply click **Submit**

**Final check:**
- Confirm Workday worker status shows **Terminated**
- Confirm no future-dated payments remain in the Pay tab
- Move the ServiceNow case to **Awaiting Acceptance**

> No further actions are required once this step is complete.',
  'workday', '{"always":true}', 1, 'How do I close a terminated employee''s contract in Workday?'
);
