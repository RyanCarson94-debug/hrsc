import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

COUNTRIES = ['UK', 'Germany', 'France', 'Netherlands', 'Ireland', 'Spain']
CATEGORIES = [
    'Payroll Query', 'Benefits', 'Leaver Process', 'Onboarding',
    'Transfer', 'Policy Query', 'Leave Management', 'Equipment Request'
]
SUBCATEGORIES = {
    'Payroll Query': ['Overpayment', 'Underpayment', 'Deductions', 'Bonus', 'Expenses'],
    'Benefits': ['Pension', 'Health Insurance', 'Life Assurance', 'Childcare Vouchers'],
    'Leaver Process': ['Resignation', 'Redundancy', 'Retirement', 'Contract End'],
    'Onboarding': ['IT Setup', 'Contract Issue', 'Background Check', 'System Access'],
    'Transfer': ['International', 'Domestic', 'Secondment', 'Fixed Term'],
    'Policy Query': ['Holiday', 'Sick Leave', 'Maternity', 'Flexible Working'],
    'Leave Management': ['Annual Leave', 'Sick Leave', 'Parental Leave', 'Unpaid Leave'],
    'Equipment Request': ['Laptop', 'Phone', 'Software', 'Accessories'],
}
SLA_HOURS = {
    'Payroll Query': 48, 'Benefits': 24, 'Leaver Process': 72,
    'Onboarding': 96, 'Transfer': 72, 'Policy Query': 24,
    'Leave Management': 8, 'Equipment Request': 120,
}
AVG_RESOLUTION = {
    'Payroll Query': (30, 12), 'Benefits': (18, 8), 'Leaver Process': (56, 20),
    'Onboarding': (80, 28), 'Transfer': (52, 16), 'Policy Query': (10, 5),
    'Leave Management': (5, 3), 'Equipment Request': (90, 30),
}

WD_BP_TYPES = ['Hire', 'Terminate', 'Transfer', 'Change Pay', 'Change Job']
WD_STEPS = {
    'Hire': ['Initiate Hire', 'HR Review', 'Manager Approval', 'IT Provisioning', 'Complete'],
    'Terminate': ['Initiate Termination', 'HR Review', 'Manager Approval', 'Offboarding', 'Complete'],
    'Transfer': ['Initiate Transfer', 'HR Review', 'Receiving Manager Approval', 'System Update', 'Complete'],
    'Change Pay': ['Initiate Change', 'HR Review', 'Finance Approval', 'Payroll Update', 'Complete'],
    'Change Job': ['Initiate Change', 'HR Review', 'Manager Approval', 'System Update', 'Complete'],
}


def generate_sample_data(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    sn = _gen_sn(500)
    wd = _gen_wd(200)
    return sn, wd


def _gen_sn(n):
    base = datetime(2024, 1, 1)
    rows = []
    for i in range(n):
        country = random.choice(COUNTRIES)
        cat = random.choice(CATEGORIES)
        sub = random.choice(SUBCATEGORIES[cat])
        mu, sigma = AVG_RESOLUTION[cat]
        res_hours = max(1.0, np.random.normal(mu, sigma))
        opened = base + timedelta(
            days=random.randint(0, 364),
            hours=random.randint(8, 17),
            minutes=random.randint(0, 59)
        )
        resolved = opened + timedelta(hours=res_hours)
        closed = resolved + timedelta(hours=random.uniform(0.5, 3))
        sla_due = opened + timedelta(hours=SLA_HOURS[cat])
        escalated = random.random() < 0.18
        reopened = int(np.random.choice([0, 1, 2], p=[0.80, 0.15, 0.05]))
        tier2_cats = {'Leaver Process', 'Transfer', 'Onboarding'}
        if cat in tier2_cats or escalated:
            grp = f'Tier 2 - {country}'
            advisor = f'T2_{random.randint(1,10):02d}'
        else:
            grp = f'Tier 1 - {country}'
            advisor = f'T1_{random.randint(1,20):02d}'
        rows.append({
            'number': f'CS{5000+i:04d}',
            'opened_at': opened.strftime('%Y-%m-%d %H:%M:%S'),
            'closed_at': closed.strftime('%Y-%m-%d %H:%M:%S'),
            'state': random.choice(['Closed', 'Closed', 'Closed', 'Resolved']),
            'category': cat,
            'subcategory': sub,
            'assignment_group': grp,
            'assigned_to': advisor,
            'contact_type': random.choice(['Self-Service', 'Email', 'Phone', 'Chat']),
            'resolved_at': resolved.strftime('%Y-%m-%d %H:%M:%S'),
            'escalated': '1' if escalated else '0',
            'reopened_count': str(reopened),
            'country': country,
            'sla_due': sla_due.strftime('%Y-%m-%d %H:%M:%S'),
            'short_description': f'[SYNTHETIC] {cat} - {sub}',
        })
    return pd.DataFrame(rows)


def _gen_wd(n):
    base = datetime(2024, 1, 1)
    rows = []
    tx_id = 1000
    while len(rows) < n * 3:
        bp = random.choice(WD_BP_TYPES)
        steps = WD_STEPS[bp]
        country = random.choice(COUNTRIES)
        worker = f'W{random.randint(10000,99999)}'
        initiated = base + timedelta(
            days=random.randint(0, 364),
            hours=random.randint(8, 17),
            minutes=random.randint(0, 59)
        )
        corrected = random.random() < 0.15
        step_time = initiated
        for step in steps:
            delay = random.uniform(0.5, 8)
            completed = step_time + timedelta(hours=delay)
            step_status = 'Completed' if step != 'Complete' else 'Completed'
            if corrected and step == steps[-2]:
                step_status = 'Corrected'
            rows.append({
                'transaction_id': f'WD{tx_id:05d}',
                'business_process_type': bp,
                'initiated_date': initiated.strftime('%Y-%m-%d %H:%M:%S'),
                'completed_date': completed.strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'Completed' if not corrected else random.choice(['Completed', 'Corrected']),
                'step_name': step,
                'step_status': step_status,
                'assignee': f'advisor_{random.randint(1,30):02d}',
                'country': country,
                'worker_id': worker,
                'corrected': '1' if corrected else '0',
                'correction_reason': 'Data entry error' if corrected and step == steps[-2] else '',
            })
            step_time = completed
        tx_id += 1
        if tx_id >= 1000 + n:
            break
    return pd.DataFrame(rows)
