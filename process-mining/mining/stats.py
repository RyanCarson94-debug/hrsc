import pandas as pd
import numpy as np


def calculate_kpis(event_log: pd.DataFrame):
    case_data = _case_summary(event_log)
    if case_data.empty:
        return {
            'total_cases': 0, 'avg_resolution_hours': 0, 'sla_compliance_pct': 0,
            'fcr_pct': 0, 'rework_rate_pct': 0,
        }

    total = len(case_data)
    avg_res = case_data['resolution_hours'].mean()

    sla_mask = case_data['sla_due'].notna() & case_data['resolved_at'].notna()
    sla_sub = case_data[sla_mask]
    sla_pct = (
        (sla_sub['resolved_at'] <= sla_sub['sla_due']).sum() / len(sla_sub) * 100
        if len(sla_sub) > 0 else None
    )

    rework_rate = case_data['is_rework'].mean() * 100

    # FCR: closed without escalation or rework
    fcr_mask = ~case_data['is_rework']
    if 'escalated' in case_data.columns:
        fcr_mask = fcr_mask & ~case_data.get('escalated', pd.Series(False, index=case_data.index))
    fcr_pct = fcr_mask.mean() * 100

    return {
        'total_cases': total,
        'avg_resolution_hours': round(avg_res, 1) if not np.isnan(avg_res) else 0,
        'sla_compliance_pct': round(sla_pct, 1) if sla_pct is not None else None,
        'fcr_pct': round(fcr_pct, 1),
        'rework_rate_pct': round(rework_rate, 1),
    }


def _case_summary(event_log: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for case_id, grp in event_log.groupby('case_id'):
        grp = grp.sort_values('timestamp')
        opened = grp['opened_at'].dropna().min() if 'opened_at' in grp.columns else grp['timestamp'].min()
        resolved = grp['resolved_at'].dropna().min() if 'resolved_at' in grp.columns else grp['timestamp'].max()
        closed = grp['closed_at'].dropna().min() if 'closed_at' in grp.columns else grp['timestamp'].max()
        sla_due = grp['sla_due'].dropna().min() if 'sla_due' in grp.columns else pd.NaT
        is_rework = grp['is_rework'].any() if 'is_rework' in grp.columns else False
        country = grp['country'].iloc[0] if 'country' in grp.columns else ''
        category = grp['category'].iloc[0] if 'category' in grp.columns else ''
        tier = grp['tier'].iloc[0] if 'tier' in grp.columns else ''
        source = grp['source'].iloc[0] if 'source' in grp.columns else ''

        if pd.notna(opened) and pd.notna(resolved):
            res_hours = (resolved - opened).total_seconds() / 3600
        else:
            res_hours = np.nan

        rows.append({
            'case_id': case_id,
            'opened_at': opened,
            'resolved_at': resolved,
            'closed_at': closed,
            'sla_due': sla_due,
            'resolution_hours': res_hours,
            'is_rework': is_rework,
            'country': country,
            'category': category,
            'tier': tier,
            'source': source,
        })
    return pd.DataFrame(rows)


def calculate_sla_analysis(event_log: pd.DataFrame):
    case_data = _case_summary(event_log)
    if case_data.empty:
        return pd.DataFrame()

    sla_mask = case_data['sla_due'].notna() & case_data['resolved_at'].notna()
    sla_data = case_data[sla_mask].copy()
    if sla_data.empty:
        return pd.DataFrame()

    sla_data['sla_breach'] = sla_data['resolved_at'] > sla_data['sla_due']
    sla_data['month'] = pd.to_datetime(sla_data['opened_at']).dt.to_period('M').astype(str)

    return sla_data


def calculate_rework(event_log: pd.DataFrame):
    case_data = _case_summary(event_log)
    rework = case_data[case_data['is_rework']].copy()

    by_category = (
        rework.groupby('category').size()
        .reset_index(name='rework_count')
        .sort_values('rework_count', ascending=False)
    )
    by_country = (
        rework.groupby('country').size()
        .reset_index(name='rework_count')
        .sort_values('rework_count', ascending=False)
    )
    return rework, by_category, by_country


def automation_candidates(event_log: pd.DataFrame):
    case_data = _case_summary(event_log)
    if case_data.empty:
        return pd.DataFrame()

    # Get subcategory if available
    col = 'subcategory' if 'subcategory' in event_log.columns else 'category'
    sub_counts = event_log.drop_duplicates('case_id').groupby(col).size().reset_index(name='volume')
    rework_rates = (
        event_log.drop_duplicates('case_id')
        .groupby(col)['is_rework']
        .mean()
        .reset_index(name='rework_rate')
    )
    merged = sub_counts.merge(rework_rates, on=col)
    # Standardisation score = 1 - rework_rate (lower rework = more standardised)
    merged['standardisation'] = (1 - merged['rework_rate']).round(3)
    # Automation score = volume * standardisation (normalised)
    v_max = merged['volume'].max()
    merged['automation_score'] = (merged['volume'] / v_max * merged['standardisation'] * 100).round(1)
    merged = merged.sort_values('automation_score', ascending=False)
    merged.columns = [col, 'Volume', 'Rework Rate', 'Standardisation', 'Automation Score']
    return merged
