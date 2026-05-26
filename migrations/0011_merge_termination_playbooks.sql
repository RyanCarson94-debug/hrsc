-- ============================================================================
-- Merged Global Termination Playbook
-- Migration: 0011_merge_termination_playbooks
-- Replaces: pb-termination (generic), pb-uk-term (UK), pb-mc-term (multi-country)
-- Countries: UK, Poland, Romania, UAE, Hungary, Greece, Czech Republic,
--            Slovakia, France, Israel, Croatia
-- ============================================================================

-- Deactivate the three old separate playbooks
UPDATE playbooks SET active = 0 WHERE id IN ('pb-termination', 'pb-uk-term', 'pb-mc-term');

-- New merged playbook
INSERT OR IGNORE INTO playbooks (id, slug, name, description, active) VALUES (
  'pb-term-v2',
  'termination',
  'Termination',
  'End-to-end termination process for UK, Poland, Romania, UAE, Hungary, Greece, Czech Republic, Slovakia, France, Israel and Croatia.',
  1
);

-- ── Intake Fields ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO intake_fields (id, playbook_id, field_key, label, type, options, sort_order) VALUES
  ('tv2-if-01', 'pb-term-v2', 'country',              'Employee country',                       'select',  '["UK","Poland","Romania","UAE","Hungary","Greece","Czech Republic","Slovakia","France","Israel","Croatia"]',                                                                                                                                 1),
  ('tv2-if-02', 'pb-term-v2', 'termination_type',     'Termination type',                        'select',  '["Voluntary","Involuntary"]',                                                                                                                                                                                                              2),
  ('tv2-if-03', 'pb-term-v2', 'leave_reason',         'Leave reason',                             'select',  '["Resignation","Retirement","End of Fixed-Term Contract","Death in Service","Workforce Reduction","Reorganisation / Position Elimination","Dismissal","Mutual Agreement","Medical Inability","Other"]',                                    3),
  ('tv2-if-04', 'pb-term-v2', 'good_leaver',          'Good Leaver? (STI eligible)',              'boolean', '[]',                                                                                                                                                                                                                                       4),
  ('tv2-if-05', 'pb-term-v2', 'settlement_agreement', 'Settlement agreement in place?',           'boolean', '[]',                                                                                                                                                                                                                                       5),
  ('tv2-if-06', 'pb-term-v2', 'garden_leave',         'Employee placed on garden leave? (UK)',    'boolean', '[]',                                                                                                                                                                                                                                       6),
  ('tv2-if-07', 'pb-term-v2', 'shift_worker',         'Shift worker? (affects UK Holiday Pay)',   'boolean', '[]',                                                                                                                                                                                                                                       7),
  ('tv2-if-08', 'pb-term-v2', 'sign_on_bonus',        'Sign-on bonus repayment due?',             'boolean', '[]',                                                                                                                                                                                                                                       8);

-- ── Steps ─────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO steps (id, playbook_id, sort_order, title, body, system, conditions, required, dovetail_intent) VALUES
(
  'tv2-st-01', 'pb-term-v2', 10,
  'Review case and save attachments',
  '## Review case and save attachments

Open the AskHR case in **ServiceNow** and confirm all required information is present before proceeding.

**Check the following:**
- Employee name, ID, and leave date are correct
- Termination reason matches what the manager submitted
- Resignation letter or supporting documentation is attached

**Save attachments to the employee record:**
- Voluntary: save the resignation letter
- Involuntary: save the settlement agreement or dismissal letter if provided

**Review open cases:**
- Check for any existing open termination or leaver cases for this employee
- Close or link any duplicates before continuing',
  'servicenow', '{"always":true}', 1, 'How do I review and save documents for a termination case in ServiceNow?'
),
(
  'tv2-st-02', 'pb-term-v2', 20,
  'Check leave date and notify payroll if late',
  '## Check leave date and notify payroll if late

Review the termination date. If the notification was received **after the monthly payroll cut-off**, email the relevant payroll team immediately.

**Payroll contacts by country:**

| Country | Payroll email |
|---|---|
| UK | Contact via ServiceNow / local HR |
| France | payroll.france@seqirus.com |
| Croatia | payroll.croatia@seqirus.com |
| Greece | payroll.greece@seqirus.com |
| Poland | payroll.poland@seqirus.com |
| Slovakia | payroll.slovakia@seqirus.com |
| Czech Republic | payroll.czechrepublic@seqirus.com |
| Hungary | payroll.hungary@seqirus.com |

> For Romania, UAE and Israel — check the HR intranet for the current payroll contact or raise via the local HR team.

**Email subject:** *Late Leaver Notification — [Employee Name] — [Employee ID] — Last Day [date]*

Reference the **Pay Dates Calendar** on the HR Knowledge Base to confirm cut-off dates.',
  'email', '{"always":true}', 0, NULL
),
(
  'tv2-st-03', 'pb-term-v2', 30,
  'Place employee on garden leave in Workday',
  '## Place employee on garden leave

The employee is being placed on garden leave for the duration of their notice period. Process this in Workday before calculating the annual leave balance.

**In Workday:**
1. Go to the employee profile → **Actions** → **Time Off** → **Place on Leave**
2. Select leave type: *Garden Leave*
3. Enter the start date (first day of garden leave) and expected end date (last day of employment)
4. Submit for approval

**Impact on annual leave calculation:**
- Garden leave days **must be deducted** from the remaining annual leave balance
- The balance cannot go negative — if garden leave exceeds the balance, the leave balance zeros out
- Record the deducted days in the case notes for the OTP calculation step',
  'workday', '{"country":"UK","termination_type":"Involuntary","garden_leave":"true"}', 1, 'How do I place an employee on garden leave in Workday?'
),
(
  'tv2-st-04', 'pb-term-v2', 40,
  'Review and confirm leave dates',
  '## Review and confirm leave dates

Compare the leave date recorded in **ServiceNow** against the resignation letter.

**Steps:**
1. Open the case in ServiceNow — note the **Last Day of Employment** recorded
2. Open the resignation letter saved to the employee record
3. Confirm the dates match

**If dates differ:**
- Contact the line manager to clarify the agreed leave date
- Update ServiceNow to reflect the correct date
- Document the reason for any change in the case notes

> Do not proceed to the Workday termination task until the leave date is confirmed and consistent.',
  'servicenow', '{"country":"UK","termination_type":"Voluntary"}', 1, NULL
),
(
  'tv2-st-05', 'pb-term-v2', 50,
  'Determine Good Leaver status',
  '## Determine Good Leaver status

Confirm whether this employee qualifies as a **Good Leaver** — Good Leavers may be entitled to a pro-rated STI payment.

**Standard qualifying reasons** (all countries):

| Termination type | Qualifying reasons |
|---|---|
| Voluntary | Death in Service, Retirement, End of Fixed-Term Contract |
| Involuntary | Workforce Reduction, Reorganisation, Position Elimination |

**Country exceptions — ALL leavers are Good Leavers regardless of reason:**

| Country |
|---|
| France |
| Czech Republic |
| Slovakia |

**Action:**
- If the employee qualifies → tick **Good Leaver** on this case and continue to the STI request step
- If not → skip the STI step and continue to Workday

> If unsure, escalate to the HRBP before proceeding.',
  'manual', '{"always":true}', 1, 'What qualifies an employee as a good leaver for STI purposes?'
),
(
  'tv2-st-06', 'pb-term-v2', 60,
  'Request STI payment from Compensation & Benefits',
  '## Request STI payment from Compensation & Benefits

This employee is a Good Leaver. Email the **Compensation & Benefits** team using the STI Payment for Leaver email template.

**Email subject:** *STI Payment Request — Good Leaver — [Employee Name] — [Employee ID] — [Country]*

Include:
- Employee name and ID
- Country
- Leave date and qualifying Good Leaver reason
- ServiceNow case number

**Await the calculation** from C&B before processing the STI OTP in Workday.

> If no response within 3 business days, follow up and place the case **On Hold (Awaiting STI Calculation)**.',
  'email', '{"good_leaver":"true"}', 1, 'How do I request a good leaver STI payment from compensation and benefits?'
),
(
  'tv2-st-07', 'pb-term-v2', 70,
  'Calculate annual leave payment',
  '## Calculate annual leave payment

Determine the outstanding annual leave balance to be paid out as a One Time Payment.

**Steps:**
1. Check the employee''s accrued and taken leave in Workday (Time Off tab)
2. Calculate remaining balance as at the last day of employment
3. If on garden leave — deduct garden leave days from the balance (cannot go below zero)
4. Note the final balance in the ServiceNow case notes

**Important:**
- Do **not** process the OTP if the termination date is more than **2 months** away — process it closer to the leave date instead
- If the balance is negative, notify Payroll for deduction

**OTP type (processed later):**
- Shift workers → *Holiday Pay (H)*
- All other employees → *Holiday Pay (D)*',
  'manual', '{"country":"UK"}', 1, 'How do I calculate the annual leave payment for a UK leaver?'
),
(
  'tv2-st-08', 'pb-term-v2', 80,
  'Populate and send confirmation letter via DocuSign',
  '## Populate and send confirmation letter via DocuSign

Prepare the appropriate confirmation letter and send via DocuSign.

**1. Select the correct template** (SharePoint → *HR Templates* → *Leaver Letters*):
- Resignation → *Resignation Acknowledgement Letter*
- Retirement → *Retirement Confirmation Letter*
- End of Fixed-Term → *Fixed-Term Contract Expiry Letter*

**2. Populate the letter:**
- Employee name, job title, department
- Confirmed leave date and notice period dates

**3. Send via DocuSign with the following routing:**

| Role | Action |
|---|---|
| Peer Reviewer | Review and approve |
| HRBP | Sign |
| Line Manager | Receive copy |
| Employee | Receive copy |

**4. Log the DocuSign envelope ID** in the ServiceNow case notes.',
  'email', '{"country":"UK","termination_type":"Voluntary"}', 1, 'What is the DocuSign process for a UK voluntary termination letter?'
),
(
  'tv2-st-09', 'pb-term-v2', 90,
  'Respond to manager via ServiceNow',
  '## Respond to manager via ServiceNow

Send an acknowledgement to the line manager from within the ServiceNow case confirming the resignation has been processed.

**Include:**
- Confirmation that the resignation has been accepted
- The confirmed last day of employment
- Reminder about the handover plan and outstanding tasks
- Confirmation that the leaver process is underway',
  'servicenow', '{"country":"UK","termination_type":"Voluntary"}', 1, NULL
),
(
  'tv2-st-10', 'pb-term-v2', 100,
  'Review PILON and severance payment details',
  '## Review PILON and severance payment details

Review documentation to identify any severance payments due in addition to final salary.

**Pay in Lieu of Notice (PILON):**
- Applies when notice is not being worked
- Calculate: (monthly salary ÷ working days in month) × notice days not worked

**Redundancy / Severance:**
- Check the settlement agreement or HR approval for the agreed amount
- Confirm whether statutory or enhanced (company scheme)

**Settlement agreement:**
- If in place, save to the employee record
- Confirm terms including any reference letter requirements

> Note payment amounts and types — both are processed as OTPs in a later step.',
  'manual', '{"country":"UK","termination_type":"Involuntary"}', 1, 'How do I calculate PILON and redundancy for a UK involuntary leaver?'
),
(
  'tv2-st-11', 'pb-term-v2', 110,
  'Locate and approve termination task in Workday',
  '## Locate and approve termination task in Workday

**Navigate to:** Workday → **My Tasks** inbox → search the employee name to find the open termination task.

**Steps:**
1. Open the termination task
2. Add the **ServiceNow case number** in the comments field
3. Review termination date and reason — confirm they match ServiceNow
4. Click **Approve**

**To amend before approving:**
- Select the pencil/edit icon to modify fields
- Confirm changes with the manager or HRBP first

> If not visible in My Tasks, go to the employee profile → **Actions** → **Business Process** → locate the active termination event.',
  'workday', '{"always":true}', 1, 'How do I find and approve a termination task in Workday?'
),
(
  'tv2-st-12', 'pb-term-v2', 120,
  'Check sign-on bonus repayment',
  '## Check sign-on bonus repayment

After approving the termination task, Workday may show a prompt for sign-on bonus repayment.

1. If a **prompt appears** → select **To Do** (no action required on screen) → **Submit**
2. **Review** the employment contract and bonus addendum letters for a repayment clause
3. If repayment **is required** — note the amount and process as a negative OTP (CSL Plan) in the next step
4. If **no repayment** — document this in the case notes

> Any repayment must use the **CSL Plan OTP with a minus value** — do not deduct from salary directly.',
  'manual', '{"always":true}', 0, NULL
),
(
  'tv2-st-13', 'pb-term-v2', 130,
  'Process One Time Payments in Workday',
  '## Process One Time Payments (OTP) in Workday

**Navigate to:** Employee record → **Actions** → **Compensation** → **Request One-Time Payment**

Set the **effective date** to the employee''s **termination date** for all OTPs. Add the **ServiceNow case number** in comments for every OTP.

---

### UK employees

**Annual Leave** *(always, if balance > 0 and leave date within 2 months)*
- Shift workers → Plan: *Holiday Pay (H)*
- Other employees → Plan: *Holiday Pay (D)*

**PILON** *(Involuntary only)*
- Plan: *Pay in Lieu of Notice*

**Redundancy / Severance** *(Involuntary only)*
- Plan: *Termination/Severance Payment*

**Retirement Bonus** *(Seqirus UK retirement only)*
- Plan: *SQ_UK Retirement* — Amount: £100

---

### All countries

**STI Payment** *(Good Leavers only)*
- Plan: *Global STI Plan Payment – Out of Cycle*
- Notes: *Good Leaver STI payment FY[year] – [CASE NUMBER]*
- Attach C&B calculation — only process once confirmed

**Sign-on Bonus Repayment** *(if applicable)*
- Plan: *CSL Plan*
- Notes: *Sign on bonus repayment – [CASE NUMBER]*
- Enter value with a **minus sign (–)** — deduction, not payment

---

> Place case **On Hold** until all OTPs are fully approved in Business Process History.',
  'workday', '{"always":true}', 1, 'How do I process one time payments for a leaver in Workday?'
),
(
  'tv2-st-14', 'pb-term-v2', 140,
  'Generate employment reference letter',
  '## Generate employment reference letter

A settlement agreement is in place requiring an employment reference letter.

**Steps:**
1. Open the settlement agreement — reference wording is typically on the **last pages**
2. Copy the wording **exactly** as written (do not paraphrase)
3. Transfer to the standard Reference Letter template (SharePoint → *HR Templates* → *Reference Letters*)
4. Have reviewed by the HRBP
5. Send to the employee (or solicitor) per the settlement terms

> Do not deviate from agreed wording without legal approval.',
  'manual', '{"country":"UK","termination_type":"Involuntary","settlement_agreement":"true"}', 0, NULL
),
(
  'tv2-st-15', 'pb-term-v2', 150,
  'Review Business Process History until OTPs approved',
  '## Review Business Process History

Regularly check that all OTP plans have been approved and completed.

**Navigate to:** Employee profile → **Job** → **Worker History** → **Business Process History**

**Confirm:**
- All OTP plans show **Approved / Complete**
- No steps are stuck or awaiting action

**If approvals pending:**
- Follow up with approvers listed as awaiting action
- Place ServiceNow case **On Hold** until fully approved
- Check back regularly until Business Process History is complete

> OTPs must be approved before the termination date to ensure correct payroll processing.',
  'workday', '{"always":true}', 1, 'How do I check Business Process History for OTP approval in Workday?'
),
(
  'tv2-st-16', 'pb-term-v2', 160,
  'Close HR Task in ServiceNow',
  '## Close HR Task in ServiceNow

Once all OTPs are approved, close the HR Task.

**In ServiceNow:**
1. Open the leaver case
2. Select **HR Task** → click the task number to open it
3. Change state to **Close Complete** → click **Save**

**Manager offboarding tasks (all countries):**
Closing the HR Task automatically triggers **final offboarding tasks for the manager**. The case will not close until the manager completes them.
- Place case **On Hold** after closing the HR Task
- Follow up with the manager if tasks remain open past the termination date

> Once all manager tasks are done, review any remaining open HR Tasks and close them. Move case to **Awaiting Acceptance**.',
  'servicenow', '{"always":true}', 1, NULL
),
(
  'tv2-st-17', 'pb-term-v2', 170,
  'Close contract in Workday',
  '## Close contract in Workday

Once the termination date is reached, complete the contract closure task in Workday.

**Steps:**
1. Employee profile → **Job** → **Worker History** → locate the **contract task** awaiting action
2. Select the task → **Open**
3. Confirm **Status** = *Closed* and **Contract End Date** = termination date
4. Click **Submit**
5. Select **Manage Business Process for Worker**
6. If a task reassignment screen appears, click **Submit** (no action needed)

**Final checks:**
- [ ] Workday status: **Terminated**
- [ ] Final payslip correct (confirmed with Payroll)
- [ ] P45 / local equivalent issued
- [ ] System access revoked (IT confirmation on file)
- [ ] Company property returned
- [ ] Employee file archived

> No further actions required. Move ServiceNow case to **Awaiting Acceptance**.',
  'workday', '{"always":true}', 1, 'How do I close a terminated employee contract in Workday?'
);
