import pandas as pd
import json
import os


def load_reference_model(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'reference_models', 'happy_path.json')
    with open(path) as f:
        return json.load(f)


def check_conformance(event_log: pd.DataFrame, reference_model: dict):
    """Score each case against its reference model. Returns case-level and summary DataFrames."""
    case_scores = []
    deviations = []

    for case_id, grp in event_log.groupby('case_id'):
        grp = grp.sort_values('timestamp')
        cat = grp['category'].iloc[0] if 'category' in grp.columns else ''
        country = grp['country'].iloc[0] if 'country' in grp.columns else ''
        tier = grp['tier'].iloc[0] if 'tier' in grp.columns else ''

        expected = reference_model.get(cat)
        if expected is None:
            continue

        actual = [a for a in grp['activity'].tolist() if a in expected or True]
        actual_set = set(actual)
        expected_set = set(expected)

        # Fitness: expected steps that appear in actual trace
        hits = sum(1 for step in expected if step in actual_set)
        fitness = hits / len(expected) if expected else 1.0

        # Precision: actual steps that are in the expected model
        in_model = sum(1 for a in actual if a in expected_set)
        precision = in_model / len(actual) if actual else 1.0

        f_score = (
            2 * fitness * precision / (fitness + precision)
            if (fitness + precision) > 0 else 0
        )

        missing = [s for s in expected if s not in actual_set]
        extra = [a for a in actual if a not in expected_set]

        case_scores.append({
            'case_id': case_id,
            'category': cat,
            'country': country,
            'tier': tier,
            'fitness': round(fitness, 3),
            'precision': round(precision, 3),
            'f_score': round(f_score, 3),
            'missing_steps': ', '.join(missing),
            'extra_steps': ', '.join(extra),
        })

        for step in missing:
            deviations.append({
                'deviation_type': 'Missing Step',
                'step': step,
                'category': cat,
                'country': country,
                'tier': tier,
                'case_id': case_id,
            })
        for step in extra:
            deviations.append({
                'deviation_type': 'Extra Step',
                'step': step,
                'category': cat,
                'country': country,
                'tier': tier,
                'case_id': case_id,
            })

    scores_df = pd.DataFrame(case_scores)
    dev_df = pd.DataFrame(deviations)

    if not dev_df.empty:
        dev_summary = (
            dev_df.groupby(['deviation_type', 'step', 'category', 'country'])
            .size()
            .reset_index(name='count')
            .sort_values('count', ascending=False)
        )
    else:
        dev_summary = pd.DataFrame()

    return scores_df, dev_summary
