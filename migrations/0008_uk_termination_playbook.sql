-- ============================================================================
-- UK Termination Playbook
-- Migration: 0008_uk_termination_playbook
-- Sources: HROPS014, HROPS015, HROPS017, HROPS018
-- ============================================================================

INSERT OR IGNORE INTO playbooks (id, slug, name, description, active) VALUES (
  'pb-uk-term',
  'uk-termination',
  'UK Termination',
  'End-to-end process for UK voluntary and involuntary terminations — resignation handling, DocuSign letters, Workday approvals, and OTP processing.',
  1
);

-- ── Intake Fields ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO intake_fields (id, playbook_id, field_key, label, type, options, sort_order) VALUES
  ('uk-if-01', 'pb-uk-term', 'termination_type',    'Termination type',                   'select',  '["Voluntary","Involuntary"]',                                                                                     1),
  ('uk-if-02', 'pb-uk-term', 'leave_reason',         'Leave reason',                        'select',  '["Resignation","Retirement","End of Fixed-Term Contract","Death in Service","Workforce Reduction","Reorganisation / Position Elimination","Dismissal","Mutual Agreement","Medical Inability","Other"]', 2),
  ('uk-if-03', 'pb-uk-term', 'good_leaver',          'Good Leaver? (STI eligible)',         'boolean', '[]',                                                                                                              3),
  ('uk-if-04', 'pb-uk-term', 'settlement_agreement', 'Settlement agreement in place?',      'boolean', '[]',                                                                                                              4),
  ('uk-if-05', 'pb-uk-term', 'garden_leave',         'Employee placed on garden leave?',    'boolean', '[]',                                                                                                              5),
  ('uk-if-06', 'pb-uk-term', 'shift_worker',         'Shift worker? (affects Holiday Pay)', 'boolean', '[]',                                                                                                              6);

-- ── Steps ─────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO steps (id, playbook_id, sort_order, title, body, system, conditions, required, dovetail_intent) VALUES
(
  'uk-st-01', 'pb-uk-term', 10,
  'Review case and save attachments',
  '## Review case and save attachments

Open the AskHR case in **ServiceNow** and confirm all required information is present before proceeding.

**Check the following:**
- Employee name, ID, and leave date are correct
- Termination reason matches what the manager submitted
- Resignation letter or supporting documentation is attached

**Save attachments to the employee record:**
- Voluntary: save the resignation letter to the employee profile
- Involuntary: save the settlement agreement or dismissal letter if provided

**Review open termination cases:**
- Check for any existing open termination or leaver cases for this employee
- Close or link any duplicates before continuing',
  'servicenow', '{"always":true}', 1, 'How do I review and manage a UK termination case in ServiceNow?'
),
(
  'uk-st-02', 'pb-uk-term', 20,
  'Notify payroll if resignation received after payroll cut-off',
  '## Notify payroll of late-received resignation

The resignation was received close to or after the monthly payroll cut-off date. Payroll must be notified immediately so they can plan the final pay run.

**Email payroll** with subject: *Late Resignation — [Employee Name] — [Employee ID] — Last Day [date]*

Include:
- Employee name and ID
- Confirmed last day of employment
- Date the resignation was received
- Any known annual leave balance to be paid out

> **Payroll cut-off dates** are published on the HR intranet. If you are unsure whether the cut-off has passed, contact payroll directly.',
  'email', '{"termination_type":"Voluntary"}', 0, NULL
),
(
  'uk-st-03', 'pb-uk-term', 30,
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
- Record the deducted days in the case notes for the OTP calculation in a later step',
  'workday', '{"termination_type":"Involuntary","garden_leave":"true"}', 1, 'How do I place an employee on garden leave in Workday?'
),
(
  'uk-st-04', 'pb-uk-term', 40,
  'Review and confirm leave dates',
  '## Review and confirm leave dates

Compare the leave date recorded in **ServiceNow** against the employee''s resignation letter to ensure they match.

**Steps:**
1. Open the case in ServiceNow — note the **Last Day of Employment** recorded
2. Open the resignation letter saved to the employee record
3. Confirm the dates match

**If dates differ:**
- Contact the line manager to clarify the agreed leave date
- Update ServiceNow to reflect the correct date
- Document the reason for any change in the case notes

> Do not proceed to the Workday termination task until the leave date is confirmed and consistent across all systems.',
  'servicenow', '{"termination_type":"Voluntary"}', 1, NULL
),
(
  'uk-st-05', 'pb-uk-term', 50,
  'Determine Good Leaver status',
  '## Determine Good Leaver status

Confirm whether this employee qualifies as a **Good Leaver**. Good Leavers may be entitled to a pro-rated Short-Term Incentive (STI) payment.

**Good Leaver qualifying reasons:**

| Termination type | Qualifying reasons |
|---|---|
| Voluntary | Death in Service, Retirement, End of Fixed-Term Contract |
| Involuntary | Workforce Reduction, Reorganisation, Position Elimination |

**If the employee IS a Good Leaver:**
- Proceed to the next step to request STI payment from Compensation & Benefits
- Note Good Leaver status in the ServiceNow case

**If the employee is NOT a Good Leaver:**
- Skip the STI step
- Continue to the annual leave calculation

> If unsure, escalate to the HRBP before proceeding.',
  'manual', '{"always":true}', 1, 'What qualifies an employee as a good leaver for STI purposes in the UK?'
),
(
  'uk-st-06', 'pb-uk-term', 60,
  'Request STI payment from Compensation & Benefits',
  '## Request STI payment from Compensation & Benefits

This employee is a Good Leaver and may be entitled to a pro-rated STI payment. Email the **Compensation & Benefits** team to initiate the calculation.

**Email C&B** with subject: *STI Payment Request — Good Leaver — [Employee Name] — [Employee ID]*

Include:
- Employee name and ID
- Leave date
- Qualifying reason (e.g. Retirement, Workforce Reduction)
- ServiceNow case number

**Await confirmation** from C&B before processing the STI One Time Payment in Workday. The STI OTP will be processed in a later step once the amount is confirmed.

> Track this in ServiceNow — place the case **On Hold (Awaiting STI Calculation)** if you need to wait for the C&B response.',
  'email', '{"good_leaver":"true"}', 1, 'How do I request an STI payment for a good leaver in the UK?'
),
(
  'uk-st-07', 'pb-uk-term', 70,
  'Calculate annual leave payment',
  '## Calculate annual leave payment

Determine the employee''s outstanding annual leave balance to be paid out as a One Time Payment.

**Steps:**
1. Check the employee''s accrued and taken leave in Workday (Time Off tab)
2. Calculate remaining balance as at the last day of employment
3. If on garden leave — deduct garden leave days from the balance (cannot go below zero)
4. Note the final balance in the ServiceNow case

**Important:**
- Do **not** process the OTP if the termination date is more than **2 months** in the future — process it closer to the leave date instead
- If the balance is negative (e.g. employee has taken more leave than accrued), record the overpayment and notify payroll for deduction

**OTP type to use (processed in a later step):**
- Shift workers → *Holiday Pay (H)*
- All other employees → *Holiday Pay (D)*',
  'manual', '{"always":true}', 1, 'How do I calculate the annual leave payment for a UK leaver?'
),
(
  'uk-st-08', 'pb-uk-term', 80,
  'Populate and send confirmation letter via DocuSign',
  '## Populate and send the confirmation letter via DocuSign

Prepare the appropriate confirmation letter based on the employee''s leave reason and send it for signature via DocuSign.

**1. Select the correct letter template** (SharePoint → *HR Templates* → *Leaver Letters*):
- Resignation → *Resignation Acknowledgement Letter*
- Retirement → *Retirement Confirmation Letter*
- End of Fixed-Term → *Fixed-Term Contract Expiry Letter*
- Death in Service → follow the dedicated bereavement process

**2. Populate the letter:**
- Employee name, job title, and department
- Leave date (confirmed in the previous step)
- Notice period dates
- Any specific terms agreed with the manager

**3. Send via DocuSign with the following routing:**

| Role | Action |
|---|---|
| Peer Reviewer | Review and approve |
| HRBP | Sign |
| Line Manager | Receive copy |
| Employee | Receive copy |

**4. Log the DocuSign envelope ID** in the ServiceNow case notes.

> Chase the HRBP for signature if not returned within **2 business days**.',
  'email', '{"termination_type":"Voluntary"}', 1, 'What is the DocuSign process for sending a voluntary termination letter in the UK?'
),
(
  'uk-st-09', 'pb-uk-term', 90,
  'Respond to manager via ServiceNow',
  '## Respond to manager via ServiceNow

Send an acknowledgement to the line manager from within the ServiceNow case to confirm the resignation has been received and processed.

**In ServiceNow:**
1. Open the case
2. Click **Reply to Requester**
3. Include in your message:
   - Confirmation that the resignation has been accepted
   - The employee''s confirmed last day of employment
   - Reminder about the handover plan and any outstanding tasks
   - Confirmation that the leaver process is underway

> Keep the communication professional and factual. Do not discuss any payment amounts or confidential HR details via this email.',
  'servicenow', '{"termination_type":"Voluntary"}', 1, NULL
),
(
  'uk-st-10', 'pb-uk-term', 100,
  'Review PILON and severance payment details',
  '## Review PILON and severance payment details

Review the case documentation to identify any severance payments due to the employee in addition to their final salary.

**Pay in Lieu of Notice (PILON):**
- Applies when notice is not being worked — confirm the notice period from the employment contract
- Calculate PILON = (monthly salary ÷ working days in month) × notice days not worked

**Redundancy / Severance payment:**
- Check the settlement agreement or HR approval for the agreed severance amount
- Confirm whether the payment is statutory redundancy or enhanced (company scheme)
- Note the payment amount in the ServiceNow case

**Settlement agreement:**
- If a settlement agreement is in place, save it to the employee record
- Confirm the terms of the agreement, including any reference letter requirements

> Both PILON and redundancy payments are processed as OTPs in a later step. Note amounts and payment types here.',
  'manual', '{"termination_type":"Involuntary"}', 1, 'How do I calculate PILON and redundancy payments for a UK involuntary leaver?'
),
(
  'uk-st-11', 'pb-uk-term', 110,
  'Locate and approve termination task in Workday',
  '## Locate and approve the termination task in Workday

**Navigate to:** Workday → **My Team Tasks** (or **Actions Awaiting Me**) → locate the termination business process for this employee.

**Steps:**
1. Open the termination task
2. Add the **ServiceNow case number** in the comments field
3. Review the termination details:
   - Termination date matches the agreed last day
   - Termination reason matches what is recorded in ServiceNow
4. Click **Approve**

> If the task is not visible, search the employee''s profile → **View Business Process** → find the active termination event and approve from there.',
  'workday', '{"always":true}', 1, 'How do I find and approve a termination task in Workday?'
),
(
  'uk-st-12', 'pb-uk-term', 120,
  'Check sign-on bonus repayment',
  '## Check sign-on bonus repayment

Review the employee''s employment contract and any sign-on bonus letter to determine if a repayment is required.

**Criteria for repayment:**
- Employee received a sign-on or joining bonus
- A repayment clause exists (typically if leaving within 1–2 years of receipt)
- The employee is within the repayment window

**If repayment is required:**
- Confirm the amount with Payroll or the original bonus letter
- Process as a **CSL Plan** OTP in Workday (enter the amount as a **negative** value)
- Inform the employee and confirm the deduction in writing

**If no repayment is required:**
- Document in the case notes that this was checked and no repayment applies',
  'manual', '{"always":true}', 0, NULL
),
(
  'uk-st-13', 'pb-uk-term', 130,
  'Process One Time Payments in Workday',
  '## Process One Time Payments (OTP) in Workday

**Navigate to:** Employee profile → **Actions** → **Pay** → **Create One-Time Payment**

Process each applicable OTP for this employee. Add the **ServiceNow case number** in the comments field for every OTP.

---

**Annual Leave**
- Shift workers → Plan: *Holiday Pay (H)*
- All other employees → Plan: *Holiday Pay (D)*
- Amount: use the balance calculated earlier
- ⚠️ Do not process if termination date is more than 2 months away

---

**STI Payment** *(Good Leavers only)*
- Plan: *Global STI Plan Payment – Out of Cycle*
- Amount: as confirmed by Compensation & Benefits

---

**Pay in Lieu of Notice (PILON)** *(Involuntary only)*
- Plan: *Pay in Lieu of Notice*
- Amount: calculated in the previous step

---

**Redundancy / Severance** *(Involuntary only)*
- Plan: *Termination/Severance Payment*
- Amount: as confirmed in the settlement agreement or HR approval

---

**Retirement Bonus** *(Seqirus UK employees retiring only)*
- Plan: *SQ_UK Retirement*
- Amount: £100

---

**Sign-on Bonus Repayment** *(if applicable)*
- Plan: *CSL Plan*
- Amount: enter as a **negative** value (add a minus sign)

> OTPs route to Manager +1, then Compensation Partner for approval. Place the case **On Hold** until all OTPs are approved.',
  'workday', '{"always":true}', 1, 'How do I process one time payments for a UK leaver in Workday?'
),
(
  'uk-st-14', 'pb-uk-term', 140,
  'Generate employment reference letter',
  '## Generate employment reference letter

A settlement agreement is in place that requires an employment reference letter. Generate this letter now.

**Steps:**
1. Open the settlement agreement — the agreed reference wording is typically on the **last pages**
2. Copy the wording **exactly** as written in the agreement (do not paraphrase)
3. Transfer the wording to the standard Reference Letter template (SharePoint → *HR Templates* → *Reference Letters*)
4. Have the letter reviewed by the HRBP
5. Send to the employee (or their solicitor) as per the terms agreed in the settlement

> Do not deviate from the agreed wording without legal approval. If the wording in the settlement is unclear, escalate to the HRBP before issuing the letter.',
  'manual', '{"termination_type":"Involuntary","settlement_agreement":"true"}', 0, NULL
),
(
  'uk-st-15', 'pb-uk-term', 150,
  'Review Business Process History and manage On Hold',
  '## Review Business Process History

**In Workday:** Employee profile → **Business Process History** → locate the termination and OTP processes.

**Confirm:**
- Termination event status: **Complete** or **In Progress** (awaiting approvals)
- All OTP plans are listed and in **Approved** status
- No processes are stuck or in **Error** state

**If awaiting approvals:**
- Place the ServiceNow case **On Hold** with a reason:
  - *Awaiting OTP Approval* — check back when all OTPs approved
  - *Awaiting STI Calculation* — follow up with C&B
  - *Awaiting Compensation Approval* — check Business Process History regularly
- Set a follow-up reminder in ServiceNow

> Review Business Process History regularly for On Hold cases. Most OTPs must be approved before the termination date.',
  'workday', '{"always":true}', 1, 'How do I check Business Process History in Workday for a leaver?'
),
(
  'uk-st-16', 'pb-uk-term', 160,
  'Close HR Task in ServiceNow',
  '## Close HR Task in ServiceNow

Once all OTPs are approved and the Business Process History confirms everything is complete, close the HR task.

**In ServiceNow:**
1. Open the leaver case
2. Add a final case note confirming:
   - Termination date confirmed in Workday
   - All OTPs processed and approved
   - Confirmation letter sent (voluntary) or settlement terms met (involuntary)
   - Employee record archived
3. Set the case status to **Resolved / Closed**

> Do not close the case if any OTPs are still pending approval. Place On Hold and return once all approvals are confirmed.',
  'servicenow', '{"always":true}', 1, NULL
),
(
  'uk-st-17', 'pb-uk-term', 170,
  'Close contract in Workday on termination date',
  '## Close contract in Workday

Once the termination date is reached, confirm the contract is fully closed in Workday.

**In Workday:**
1. Navigate to the employee profile
2. Confirm the worker status shows **Terminated**
3. Check the **Pay** tab — confirm no future-dated salary payments exist
4. Confirm the termination event in Business Process History shows **Complete**

**Final checks:**
- [ ] Workday status: Terminated
- [ ] Final payslip correct (confirm with Payroll)
- [ ] P45 issued — confirmed with Payroll
- [ ] All system access revoked (IT confirmation on file)
- [ ] Company property returned (laptop, ID badge, key fob)
- [ ] Employee file archived in SharePoint

> This is the final step. Once confirmed, the case is fully closed.',
  'workday', '{"always":true}', 1, NULL
);
