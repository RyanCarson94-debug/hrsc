import { uuid, now, logChange } from './_helpers.js'

// ─── Demo HRSC taxonomy seed data ─────────────────────────────────────────────
const SEED = [
  { code:'HRSC', name:'HR Service Center Operations', type:'domain', desc:'Top-level domain for all HR Service Center operations, processes, and services.', owner:'Chief People Officer', children:[
    { code:'WFA', name:'Workforce Administration', type:'process_group', desc:'Core HR administrative transactions for employee data, positions, and workforce changes.', owner:'HR Operations Lead', children:[
      { code:'WFA.01', name:'Employee Data Management', type:'process', desc:'Maintaining accurate employee personal and employment records throughout the employee lifecycle.', owner:'HR Data Steward', children:[
        { code:'WFA.01.01', name:'Personal Information Updates', type:'subprocess', desc:'Processing changes to employee personal data including name, address, and contact details.' },
        { code:'WFA.01.02', name:'Address and Contact Changes', type:'subprocess', desc:'Updating employee home address, phone, and emergency contact information.' },
        { code:'WFA.01.03', name:'Banking and Payment Details', type:'subprocess', desc:'Managing direct deposit setup, changes, and pay card administration.' },
        { code:'WFA.01.04', name:'Document Management', type:'subprocess', desc:'Maintaining personnel files, employment verification letters, and HR document storage.' },
      ]},
      { code:'WFA.02', name:'Position and Job Management', type:'process', desc:'Administration of positions, job codes, and organizational structure.', owner:'HR Operations Lead', children:[
        { code:'WFA.02.01', name:'Job Code Administration', type:'subprocess', desc:'Creating and maintaining job codes, titles, and classification records.' },
        { code:'WFA.02.02', name:'Org Chart Maintenance', type:'subprocess', desc:'Updating organisational hierarchies and reporting structures in HRIS.' },
        { code:'WFA.02.03', name:'Reporting Line Updates', type:'subprocess', desc:'Processing changes to manager/direct-report relationships.' },
      ]},
      { code:'WFA.03', name:'Worker Type Administration', type:'process', desc:'Managing transitions between employment types including FTE, part-time, and contractor.', owner:'HR Operations Lead', children:[
        { code:'WFA.03.01', name:'FTE and Part-Time Changes', type:'subprocess', desc:'Processing changes to scheduled hours and FTE percentage.' },
        { code:'WFA.03.02', name:'Contractor to Employee Conversion', type:'subprocess', desc:'Managing the conversion process from contingent worker to direct employee.' },
      ]},
    ]},
    { code:'BEN', name:'Benefits Administration', type:'process_group', desc:'Management of employee benefit enrolment, changes, and queries across health, retirement, and supplemental programmes.', owner:'Benefits Manager', children:[
      { code:'BEN.01', name:'Health and Welfare Benefits', type:'process', desc:'Administration of medical, dental, vision, and ancillary benefit plans.', owner:'Benefits Analyst', children:[
        { code:'BEN.01.01', name:'Medical Plan Enrolment', type:'subprocess', desc:'Processing new enrolments and changes to medical plan elections during open enrolment and qualifying life events.' },
        { code:'BEN.01.02', name:'Dental and Vision Enrolment', type:'subprocess', desc:'Managing dental and vision plan elections and changes.' },
        { code:'BEN.01.03', name:'Life Insurance Administration', type:'subprocess', desc:'Processing life and AD&D insurance elections, beneficiary designations, and EOI requirements.' },
        { code:'BEN.01.04', name:'FSA and HSA Administration', type:'subprocess', desc:'Managing flexible spending account and health savings account elections and contributions.' },
        { code:'BEN.01.05', name:'Wellness Programme Administration', type:'subprocess', desc:'Enrolment and tracking for wellness programmes, incentives, and EAP access.' },
      ]},
      { code:'BEN.02', name:'Retirement and Savings', type:'process', desc:'Administration of 401k, pension, and other retirement savings plans.', owner:'Benefits Analyst', children:[
        { code:'BEN.02.01', name:'401k Enrolment and Changes', type:'subprocess', desc:'Processing retirement plan enrolment, contribution rate changes, and investment elections.' },
        { code:'BEN.02.02', name:'Pension Administration', type:'subprocess', desc:'Managing defined benefit pension plan queries, calculations, and records.' },
        { code:'BEN.02.03', name:'Beneficiary Designations', type:'subprocess', desc:'Processing and maintaining retirement plan beneficiary records.' },
      ]},
      { code:'BEN.03', name:'Leave of Absence Administration', type:'process', desc:'Administration of statutory and company leave of absence programmes.', owner:'Leave Administrator', children:[
        { code:'BEN.03.01', name:'FMLA Administration', type:'subprocess', desc:'Processing FMLA requests, tracking entitlement, and coordinating with payroll.' },
        { code:'BEN.03.02', name:'Military Leave Processing', type:'subprocess', desc:'Administering USERRA-compliant military leave requests and pay differentials.' },
        { code:'BEN.03.03', name:'Personal Leave Processing', type:'subprocess', desc:'Managing company-approved personal and voluntary leave requests.' },
        { code:'BEN.03.04', name:'Disability Leave Coordination', type:'subprocess', desc:'Coordinating short-term and long-term disability leave with insurance carriers.' },
      ]},
    ]},
    { code:'LAV', name:'Leave and Absence Management', type:'process_group', desc:'Day-to-day administration of time off, accruals, holiday schedules, and extended leave.', owner:'HR Operations Lead', children:[
      { code:'LAV.01', name:'Time Off Administration', type:'process', desc:'Managing PTO requests, accrual inquiries, and leave balances.', owner:'HR Tier 1 Lead', children:[
        { code:'LAV.01.01', name:'PTO Balance Inquiries', type:'subprocess', desc:'Responding to employee queries about vacation, sick, and personal time balances.' },
        { code:'LAV.01.02', name:'Vacation Accrual Questions', type:'subprocess', desc:'Explaining accrual policies, rates, and maximum carry-forward rules.' },
        { code:'LAV.01.03', name:'Sick Leave Administration', type:'subprocess', desc:'Processing sick leave requests and advising on policy requirements.' },
        { code:'LAV.01.04', name:'Holiday Schedule Administration', type:'subprocess', desc:'Communicating company holiday calendars and floating holiday processes.' },
      ]},
      { code:'LAV.02', name:'Extended Leave Management', type:'process', desc:'Coordination of long-term disability, workers compensation, and extended absence.', owner:'Leave Administrator', children:[
        { code:'LAV.02.01', name:'Short-Term Disability Coordination', type:'subprocess', desc:'Processing STD claims and coordinating with the insurance carrier.' },
        { code:'LAV.02.02', name:'Long-Term Disability Coordination', type:'subprocess', desc:'Managing LTD claim submissions and ongoing case coordination.' },
        { code:'LAV.02.03', name:'Workers Compensation Liaison', type:'subprocess', desc:'Coordinating workers compensation claims, medical certifications, and return-to-work plans.' },
      ]},
    ]},
    { code:'PAY', name:'Payroll Support', type:'process_group', desc:'Handling payroll inquiries, corrections, and year-end activities.', owner:'Payroll Manager', children:[
      { code:'PAY.01', name:'Payroll Inquiry Handling', type:'process', desc:'First-line support for employee payroll questions and discrepancy research.', owner:'Payroll Specialist', children:[
        { code:'PAY.01.01', name:'Pay Stub Inquiries', type:'subprocess', desc:'Explaining earnings, deductions, and net pay on employee pay statements.' },
        { code:'PAY.01.02', name:'Tax Withholding Questions', type:'subprocess', desc:'Assisting employees with W-4 elections, withholding calculations, and state tax forms.' },
        { code:'PAY.01.03', name:'Direct Deposit Setup', type:'subprocess', desc:'Processing new direct deposit instructions and split-deposit arrangements.' },
        { code:'PAY.01.04', name:'Garnishment Inquiries', type:'subprocess', desc:'Responding to employee questions about wage garnishments and child support withholding.' },
      ]},
      { code:'PAY.02', name:'Payroll Corrections', type:'process', desc:'Processing adjustments for underpayments, overpayments, and retroactive changes.', owner:'Payroll Specialist', children:[
        { code:'PAY.02.01', name:'Overpayment Recovery', type:'subprocess', desc:'Identifying, documenting, and recovering payroll overpayments.' },
        { code:'PAY.02.02', name:'Underpayment Resolution', type:'subprocess', desc:'Issuing off-cycle payments for confirmed underpayments.' },
        { code:'PAY.02.03', name:'Retroactive Pay Processing', type:'subprocess', desc:'Calculating and processing retroactive salary adjustments and back pay.' },
      ]},
      { code:'PAY.03', name:'Year-End Payroll', type:'process', desc:'W-2 distribution, year-end tax updates, and annual payroll close activities.', owner:'Payroll Manager', children:[
        { code:'PAY.03.01', name:'W-2 Distribution and Corrections', type:'subprocess', desc:'Managing W-2 distribution, online access, and W-2c correction requests.' },
        { code:'PAY.03.02', name:'Year-End Tax Updates', type:'subprocess', desc:'Processing state UI rate updates and year-end tax configuration changes.' },
      ]},
    ]},
    { code:'ONB', name:'Onboarding', type:'process_group', desc:'End-to-end new hire onboarding from offer acceptance through first-day orientation.', owner:'Onboarding Manager', children:[
      { code:'ONB.01', name:'Pre-Employment Processing', type:'process', desc:'Completing compliance and documentation requirements before the employee start date.', owner:'Onboarding Coordinator', children:[
        { code:'ONB.01.01', name:'Background Check Coordination', type:'subprocess', desc:'Initiating and tracking pre-employment background screening through third-party provider.' },
        { code:'ONB.01.02', name:'I-9 and E-Verify Processing', type:'subprocess', desc:'Completing Form I-9 identity and work authorisation verification and E-Verify submission.' },
        { code:'ONB.01.03', name:'New Hire Paperwork', type:'subprocess', desc:'Collecting and processing tax forms, direct deposit, handbook acknowledgements, and policy attestations.' },
        { code:'ONB.01.04', name:'System Access Provisioning', type:'subprocess', desc:'Coordinating IT access requests for HRIS, email, and role-specific systems.' },
      ]},
      { code:'ONB.02', name:'First Day and Orientation', type:'process', desc:'Welcome and orientation activities for new employees on and around their start date.', owner:'Onboarding Coordinator', children:[
        { code:'ONB.02.01', name:'Orientation Scheduling', type:'subprocess', desc:'Scheduling and communicating new hire orientation sessions and agendas.' },
        { code:'ONB.02.02', name:'Equipment and Badge Setup', type:'subprocess', desc:'Coordinating issuance of laptop, access badges, and desk assignments.' },
        { code:'ONB.02.03', name:'Benefits Enrolment Window', type:'subprocess', desc:'Advising new hires on benefits enrolment deadlines and options.' },
      ]},
    ]},
    { code:'OFF', name:'Offboarding', type:'process_group', desc:'Managing all separation activities for voluntary and involuntary terminations.', owner:'HR Operations Lead', children:[
      { code:'OFF.01', name:'Separation Processing', type:'process', desc:'Administrative processing of employee separations by type.', owner:'HR Specialist', children:[
        { code:'OFF.01.01', name:'Resignation Processing', type:'subprocess', desc:'Accepting and processing voluntary resignation notifications and final day confirmation.' },
        { code:'OFF.01.02', name:'Termination Processing', type:'subprocess', desc:'Executing involuntary termination transactions in HRIS and notifying stakeholders.' },
        { code:'OFF.01.03', name:'Retirement Processing', type:'subprocess', desc:'Managing retirement notifications, pension calculation requests, and final pay arrangements.' },
      ]},
      { code:'OFF.02', name:'Final Pay and Benefits', type:'process', desc:'Calculating and delivering final compensation and benefit continuation information.', owner:'Payroll Specialist', children:[
        { code:'OFF.02.01', name:'Final Paycheck Processing', type:'subprocess', desc:'Ensuring timely delivery of final pay in compliance with state final pay laws.' },
        { code:'OFF.02.02', name:'COBRA Administration', type:'subprocess', desc:'Sending COBRA election notices and processing continuation coverage elections.' },
        { code:'OFF.02.03', name:'PTO Payout Calculation', type:'subprocess', desc:'Calculating accrued and unused PTO payouts per company policy and state law.' },
      ]},
      { code:'OFF.03', name:'Knowledge Transfer and Exit', type:'process', desc:'Facilitating knowledge transfer, exit interviews, and access revocation.', owner:'HR Specialist', children:[
        { code:'OFF.03.01', name:'Exit Interview Coordination', type:'subprocess', desc:'Scheduling and administering voluntary exit interviews or surveys.' },
        { code:'OFF.03.02', name:'System Access Deprovisioning', type:'subprocess', desc:'Submitting IT access revocation requests and verifying timely removal.' },
        { code:'OFF.03.03', name:'Asset Return Processing', type:'subprocess', desc:'Coordinating return of company equipment, badges, and property.' },
      ]},
    ]},
    { code:'POL', name:'HR Policy and Guidance', type:'process_group', desc:'Providing policy interpretation, guidance, and regulatory compliance support.', owner:'HR Policy Lead', children:[
      { code:'POL.01', name:'Policy Administration', type:'process', desc:'Responding to policy inquiries and managing policy exceptions and updates.', owner:'HR Policy Analyst', children:[
        { code:'POL.01.01', name:'Policy Inquiry Response', type:'subprocess', desc:'Answering employee and manager questions on HR policies via the service centre.' },
        { code:'POL.01.02', name:'Policy Exception Handling', type:'subprocess', desc:'Reviewing and escalating requests for policy exceptions through appropriate approval channels.' },
        { code:'POL.01.03', name:'Policy Update Notifications', type:'subprocess', desc:'Communicating policy changes and updates to employees and managers.' },
      ]},
      { code:'POL.02', name:'Compliance and Regulatory Support', type:'process', desc:'Supporting employment law compliance, EEO reporting, and accommodation requests.', owner:'HR Compliance Specialist', children:[
        { code:'POL.02.01', name:'EEO and Affirmative Action', type:'subprocess', desc:'Supporting EEO-1 reporting, AAP administration, and accommodation inquiries.' },
        { code:'POL.02.02', name:'FLSA Classification Inquiries', type:'subprocess', desc:'Responding to questions on exempt/non-exempt classification and overtime rules.' },
        { code:'POL.02.03', name:'Accommodation Requests', type:'subprocess', desc:'Intake and triage of ADA and religious accommodation requests.' },
      ]},
    ]},
    { code:'ER', name:'Employee Relations Intake', type:'process_group', desc:'First-line intake, triage, and routing of employee relations cases.', owner:'ER Manager', children:[
      { code:'ER.01', name:'Case Intake and Triage', type:'process', desc:'Receiving, classifying, and routing employee relations matters.', owner:'ER Specialist', children:[
        { code:'ER.01.01', name:'Grievance Intake', type:'subprocess', desc:'Receiving and logging formal and informal employee grievances.' },
        { code:'ER.01.02', name:'Performance Management Support', type:'subprocess', desc:'Advising managers on PIP processes, documentation, and formal warnings.' },
        { code:'ER.01.03', name:'Workplace Conflict Escalation', type:'subprocess', desc:'Triaging interpersonal conflict reports and escalating to ER investigators.' },
        { code:'ER.01.04', name:'Harassment and Misconduct Reports', type:'subprocess', desc:'Initial intake and routing of harassment, discrimination, and misconduct allegations.' },
      ]},
    ]},
    { code:'SYS', name:'HR Systems Support', type:'process_group', desc:'First-line support for HRIS, self-service portals, and HR technology tools.', owner:'HR Technology Lead', children:[
      { code:'SYS.01', name:'HRIS Support', type:'process', desc:'Resolving employee and manager issues with HR system access and transactions.', owner:'HRIS Support Analyst', children:[
        { code:'SYS.01.01', name:'Self-Service Password Resets', type:'subprocess', desc:'Assisting employees with HRIS and portal password resets and account unlocks.' },
        { code:'SYS.01.02', name:'Employee Self-Service Navigation', type:'subprocess', desc:'Guiding employees through ESS transactions for personal data, pay, and benefits.' },
        { code:'SYS.01.03', name:'Manager Self-Service Support', type:'subprocess', desc:'Assisting managers with MSS transactions including approvals, reports, and team views.' },
        { code:'SYS.01.04', name:'System Error Escalation', type:'subprocess', desc:'Capturing and escalating HRIS system errors and data integrity issues to Tier 3.' },
      ]},
      { code:'SYS.02', name:'Reporting and Analytics Support', type:'process', desc:'Fulfilling standard and ad-hoc HR reporting requests.', owner:'HR Analytics Analyst', children:[
        { code:'SYS.02.01', name:'Standard Report Requests', type:'subprocess', desc:'Running and distributing standard HRIS reports per scheduled or ad-hoc requests.' },
        { code:'SYS.02.02', name:'Custom Report Coordination', type:'subprocess', desc:'Scoping and routing custom reporting requests to HR Analytics.' },
      ]},
    ]},
    { code:'MGR', name:'Manager Support', type:'process_group', desc:'Dedicated HR support for people manager transactions and inquiries.', owner:'HR Business Partner Lead', children:[
      { code:'MGR.01', name:'Manager HR Transactions', type:'process', desc:'Processing manager-initiated HR actions for their team members.', owner:'HR Specialist', children:[
        { code:'MGR.01.01', name:'Transfer and Promotion Processing', type:'subprocess', desc:'Processing internal transfers, promotions, and lateral moves.' },
        { code:'MGR.01.02', name:'Compensation Change Requests', type:'subprocess', desc:'Initiating merit increases, off-cycle adjustments, and equity review requests.' },
        { code:'MGR.01.03', name:'Performance Review Administration', type:'subprocess', desc:'Supporting goal-setting, mid-year, and annual review cycle administration.' },
      ]},
    ]},
    { code:'KM', name:'Knowledge Management', type:'process_group', desc:'Creating, maintaining, and optimising the HR knowledge base for service delivery.', owner:'Knowledge Manager', children:[
      { code:'KM.01', name:'Knowledge Base Operations', type:'process', desc:'Day-to-day operations for HR knowledge article creation, review, and retirement.', owner:'Knowledge Coordinator', children:[
        { code:'KM.01.01', name:'Article Creation and Review', type:'subprocess', desc:'Authoring new knowledge articles and conducting periodic review cycles.' },
        { code:'KM.01.02', name:'Knowledge Gap Identification', type:'subprocess', desc:'Analysing case data and agent feedback to identify knowledge content gaps.' },
        { code:'KM.01.03', name:'FAQ Maintenance', type:'subprocess', desc:'Maintaining and publishing the employee-facing HR FAQ repository.' },
      ]},
    ]},
    { code:'SRM', name:'Service Request Management', type:'process_group', desc:'Management of the HR service request lifecycle including ticket operations and channel management.', owner:'Service Centre Manager', children:[
      { code:'SRM.01', name:'Ticket Operations', type:'process', desc:'End-to-end management of HR service request tickets from intake to resolution.', owner:'Tier 1 Team Lead', children:[
        { code:'SRM.01.01', name:'Tier 1 Resolution', type:'subprocess', desc:'First-contact resolution of HR inquiries within defined Tier 1 scope.' },
        { code:'SRM.01.02', name:'Tier 2 Escalation', type:'subprocess', desc:'Escalating complex cases to Tier 2 specialists with full documentation.' },
        { code:'SRM.01.03', name:'SLA Monitoring', type:'subprocess', desc:'Tracking and reporting on service level compliance and breach risk.' },
        { code:'SRM.01.04', name:'Customer Satisfaction Surveys', type:'subprocess', desc:'Deploying and analysing post-resolution satisfaction surveys.' },
      ]},
      { code:'SRM.02', name:'Channel Management', type:'process', desc:'Operating and optimising the multi-channel HR service delivery model.', owner:'Service Centre Manager', children:[
        { code:'SRM.02.01', name:'Phone Channel Operations', type:'subprocess', desc:'Managing inbound HR call centre operations, queue management, and scripting.' },
        { code:'SRM.02.02', name:'Chat Channel Operations', type:'subprocess', desc:'Operating live chat and chatbot channels for HR service delivery.' },
        { code:'SRM.02.03', name:'Email Channel Operations', type:'subprocess', desc:'Managing the HR service centre email inbox, routing, and response SLAs.' },
        { code:'SRM.02.04', name:'Portal Self-Service', type:'subprocess', desc:'Supporting employee navigation and adoption of the HR portal and knowledge base.' },
      ]},
    ]},
    { code:'WFP', name:'Workforce Planning Support', type:'process_group', desc:'Supporting headcount planning, organisational design, and workforce analytics requests.', owner:'HR Business Partner Lead', children:[
      { code:'WFP.01', name:'Headcount Administration', type:'process', desc:'Processing headcount tracking, requisition approvals, and FTE reporting.', owner:'HR Analyst', children:[
        { code:'WFP.01.01', name:'Headcount Reporting', type:'subprocess', desc:'Producing regular headcount and FTE reports by department and cost centre.' },
        { code:'WFP.01.02', name:'Requisition Administration', type:'subprocess', desc:'Processing job requisition approvals and maintaining open position data.' },
      ]},
    ]},
  ]}
]

// ─── Flatten tree into insert rows ────────────────────────────────────────────
function flattenSeed(nodes, frameworkId, parentId = null, level = 0) {
  const rows = []
  let sortOrder = 0
  for (const n of nodes) {
    const id = uuid()
    rows.push({
      id, frameworkId, parentId, level, sortOrder: sortOrder++,
      code: n.code, name: n.name, type: n.type,
      desc: n.desc || '', owner: n.owner || 'HR Operations',
    })
    if (n.children) {
      rows.push(...flattenSeed(n.children, frameworkId, id, level + 1))
    }
  }
  return rows
}

export async function seedFramework(db) {
  const fwId = uuid()
  const ts = now()

  // Insert framework
  await db.prepare(`
    INSERT INTO frameworks (id, name, description, framework_type, source_basis, version_label, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fwId,
    'HR Service Center Operations (APQC-Style)',
    'Demo taxonomy for an APQC-style HR Service Center. Covers the full lifecycle of HRSC processes from workforce administration through knowledge management. Replace with your own taxonomy using the Import Center.',
    'hrsc_taxonomy', 'APQC PCF — Human Resources', '1.0', 'active', ts, ts
  ).run()

  const rows = flattenSeed(SEED, fwId)

  // Build id map by code for parent resolution (already resolved since we generate IDs inline)
  // Insert in chunks of 50 to stay within D1 batch limits
  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    await db.batch(chunk.map(r => {
      const fullPath = r.name // simplified; will be corrected by next query
      return db.prepare(`
        INSERT INTO taxonomy_nodes
          (id, framework_id, parent_id, code, name, description, node_type, level, sort_order,
           full_path, status, owner, synonyms, keywords, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).bind(
        r.id, r.frameworkId, r.parentId, r.code, r.name, r.desc, r.type,
        r.level, r.sortOrder, fullPath, 'active', r.owner,
        '[]', '[]', ts, ts
      )
    }))
  }

  // Build proper full_paths now that all rows are inserted
  const { results: allNodes } = await db.prepare(
    'SELECT id, parent_id, name FROM taxonomy_nodes WHERE framework_id = ? ORDER BY level'
  ).bind(fwId).all()

  const nameMap = new Map(allNodes.map(n => [n.id, n.name]))
  const parentMap = new Map(allNodes.map(n => [n.id, n.parent_id]))

  function buildPath(id) {
    const parts = []
    let cur = id
    while (cur) {
      parts.unshift(nameMap.get(cur))
      cur = parentMap.get(cur)
    }
    return parts.join(' > ')
  }

  const pathStmts = allNodes.map(n =>
    db.prepare('UPDATE taxonomy_nodes SET full_path = ? WHERE id = ?')
      .bind(buildPath(n.id), n.id)
  )
  for (let i = 0; i < pathStmts.length; i += CHUNK) {
    await db.batch(pathStmts.slice(i, i + CHUNK))
  }

  await logChange(db, {
    frameworkId: fwId, nodeId: null, actionType: 'created',
    newValue: fwId, changeNote: 'Framework seeded with demo HRSC taxonomy', changedBy: 'system',
  })

  return { framework_id: fwId, node_count: rows.length }
}
