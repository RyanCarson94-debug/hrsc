import pandas as pd
from collections import defaultdict


def extract_variants(event_log: pd.DataFrame):
    variant_cases = defaultdict(list)
    variant_durations = defaultdict(list)
    variant_rework = defaultdict(list)

    for case_id, grp in event_log.groupby('case_id'):
        grp = grp.sort_values('timestamp')
        trace = tuple(grp['activity'].tolist())
        variant_cases[trace].append(case_id)

        start = grp['timestamp'].min()
        end = grp['timestamp'].max()
        dur = (end - start).total_seconds() / 3600
        variant_durations[trace].append(dur)
        variant_rework[trace].append(grp['is_rework'].any() if 'is_rework' in grp.columns else False)

    total_cases = sum(len(v) for v in variant_cases.values())

    rows = []
    for i, (trace, cases) in enumerate(
        sorted(variant_cases.items(), key=lambda x: -len(x[1]))
    ):
        durations = variant_durations[trace]
        rework_flags = variant_rework[trace]
        rows.append({
            'rank': i + 1,
            'variant': ' → '.join(trace),
            'case_count': len(cases),
            'pct_cases': round(len(cases) / total_cases * 100, 1),
            'avg_duration_hours': round(sum(durations) / len(durations), 1) if durations else 0,
            'rework_rate_pct': round(sum(rework_flags) / len(rework_flags) * 100, 1),
            'step_count': len(trace),
        })

    return pd.DataFrame(rows)
