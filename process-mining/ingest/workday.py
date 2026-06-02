import pandas as pd

REQUIRED_COLS = {
    'transaction_id', 'business_process_type', 'initiated_date',
    'completed_date', 'status', 'step_name', 'step_status',
    'assignee', 'country', 'worker_id', 'corrected', 'correction_reason',
}


def parse_workday(df):
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")

    df = df.copy()
    df['initiated_date'] = pd.to_datetime(df['initiated_date'], errors='coerce')
    df['completed_date'] = pd.to_datetime(df['completed_date'], errors='coerce')
    df['corrected'] = df['corrected'].astype(str).str.strip().isin(['1', 'true', 'True', 'yes'])

    events = []
    for _, row in df.iterrows():
        ts = row['completed_date'] if not pd.isna(row['completed_date']) else row['initiated_date']
        if pd.isna(ts):
            continue

        is_rework = bool(row['corrected'])
        events.append({
            'case_id': str(row['transaction_id']),
            'activity': str(row['step_name']),
            'timestamp': ts,
            'source': 'workday',
            'resource': str(row['assignee']),
            'country': str(row['country']),
            'category': str(row['business_process_type']),
            'subcategory': str(row.get('correction_reason', '')),
            'tier': 'Workday',
            'is_rework': is_rework,
            'sla_due': pd.NaT,
            'resolved_at': pd.NaT,
            'closed_at': pd.NaT,
            'opened_at': row['initiated_date'],
        })

    result = pd.DataFrame(events)
    result = result.sort_values(['case_id', 'timestamp']).reset_index(drop=True)
    return result


def validate_schema(df):
    missing = REQUIRED_COLS - set(df.columns)
    return list(missing)
