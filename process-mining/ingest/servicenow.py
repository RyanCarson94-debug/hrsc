import pandas as pd
from datetime import timedelta

REQUIRED_COLS = {
    'number', 'opened_at', 'closed_at', 'state', 'category', 'subcategory',
    'assignment_group', 'assigned_to', 'contact_type', 'resolved_at',
    'escalated', 'reopened_count', 'country', 'sla_due', 'short_description',
}

TIER2_GROUPS = {'leaver process', 'transfer', 'onboarding'}


def parse_servicenow(df, roster_df=None):
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")

    df = df.copy()
    for col in ['opened_at', 'closed_at', 'resolved_at', 'sla_due']:
        df[col] = pd.to_datetime(df[col], errors='coerce')

    df['escalated'] = df['escalated'].astype(str).str.strip().isin(['1', 'true', 'True', 'yes', 'Yes'])
    df['reopened_count'] = pd.to_numeric(df['reopened_count'], errors='coerce').fillna(0).astype(int)

    advisor_tier = {}
    if roster_df is not None:
        for _, row in roster_df.iterrows():
            advisor_tier[str(row.get('advisor_id', ''))] = str(row.get('tier', 'Tier 1'))

    events = []
    for _, case in df.iterrows():
        case_id = str(case['number'])
        cat = str(case['category'])
        country = str(case['country'])
        advisor = str(case['assigned_to'])
        grp = str(case['assignment_group']).lower()

        tier = advisor_tier.get(advisor)
        if tier is None:
            if 'tier 2' in grp or cat.lower() in TIER2_GROUPS:
                tier = 'Tier 2'
            else:
                tier = 'Tier 1'

        is_rework = case['reopened_count'] > 0
        opened = case['opened_at']
        resolved = case['resolved_at']
        closed = case['closed_at']

        if pd.isna(opened):
            continue

        def ev(activity, ts, offset_hours=0):
            t = ts + timedelta(hours=offset_hours) if not pd.isna(ts) else None
            if t is None:
                return None
            return {
                'case_id': case_id,
                'activity': activity,
                'timestamp': t,
                'source': 'servicenow',
                'resource': advisor,
                'country': country,
                'category': cat,
                'subcategory': str(case.get('subcategory', '')),
                'tier': tier,
                'is_rework': is_rework,
                'sla_due': case['sla_due'],
                'resolved_at': resolved,
                'closed_at': closed,
                'opened_at': opened,
            }

        events.append(ev('Case Opened', opened))

        assign_delay = 0.25
        if case['escalated']:
            events.append(ev('Assigned to Tier 1', opened, assign_delay))
            events.append(ev('Escalated to Tier 2', opened, assign_delay + 2))
        else:
            act = f'Assigned to {tier}'
            events.append(ev(act, opened, assign_delay))

        if cat in ('Leaver Process', 'Transfer', 'Onboarding'):
            events.append(ev('Workday Action Triggered', opened, assign_delay + 1))

        if is_rework:
            reopen_ts = opened + (resolved - opened) * 0.7 if not pd.isna(resolved) else opened
            for _ in range(case['reopened_count']):
                events.append(ev('Reopened', reopen_ts))

        if not pd.isna(resolved):
            events.append(ev('Resolved', resolved))

        if not pd.isna(closed):
            events.append(ev('Case Closed', closed))

    result = pd.DataFrame([e for e in events if e is not None])
    result = result.sort_values(['case_id', 'timestamp']).reset_index(drop=True)
    return result


def validate_schema(df):
    missing = REQUIRED_COLS - set(df.columns)
    return list(missing)
