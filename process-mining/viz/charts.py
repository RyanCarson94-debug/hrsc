import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

DARK_TEMPLATE = 'plotly_dark'


def sla_breach_chart(sla_data: pd.DataFrame, group_by='category'):
    if sla_data.empty or 'sla_breach' not in sla_data.columns:
        return _empty_fig('No SLA data available')

    agg = (
        sla_data.groupby(group_by)['sla_breach']
        .agg(['mean', 'count'])
        .reset_index()
    )
    agg.columns = [group_by, 'breach_rate', 'total']
    agg['breach_pct'] = (agg['breach_rate'] * 100).round(1)
    agg = agg.sort_values('breach_pct', ascending=True)

    fig = px.bar(
        agg, x='breach_pct', y=group_by, orientation='h',
        title=f'SLA Breach Rate by {group_by.replace("_", " ").title()}',
        labels={'breach_pct': 'Breach Rate %', group_by: ''},
        color='breach_pct',
        color_continuous_scale=['#28a745', '#ffc107', '#dc3545'],
        template=DARK_TEMPLATE,
        text='breach_pct',
    )
    fig.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
    fig.update_layout(coloraxis_showscale=False, margin=dict(l=10, r=20, t=40, b=10))
    return fig


def sla_trend_chart(sla_data: pd.DataFrame):
    if sla_data.empty or 'sla_breach' not in sla_data.columns:
        return _empty_fig('No SLA data available')

    monthly = (
        sla_data.groupby('month')['sla_breach']
        .agg(['mean', 'count'])
        .reset_index()
    )
    monthly['breach_pct'] = (monthly['mean'] * 100).round(1)

    fig = px.line(
        monthly, x='month', y='breach_pct',
        title='SLA Breach Rate Over Time',
        labels={'breach_pct': 'Breach %', 'month': 'Month'},
        markers=True,
        template=DARK_TEMPLATE,
    )
    fig.update_traces(line_color='#dc3545')
    fig.update_layout(margin=dict(l=10, r=20, t=40, b=10))
    return fig


def rework_chart(by_category: pd.DataFrame):
    if by_category.empty:
        return _empty_fig('No rework data')

    fig = px.bar(
        by_category, x='rework_count', y='category', orientation='h',
        title='Rework by Category',
        labels={'rework_count': 'Rework Cases', 'category': ''},
        color='rework_count',
        color_continuous_scale=['#ffc107', '#dc3545'],
        template=DARK_TEMPLATE,
        text='rework_count',
    )
    fig.update_traces(textposition='outside')
    fig.update_layout(coloraxis_showscale=False, margin=dict(l=10, r=20, t=40, b=10))
    return fig


def country_comparison_chart(event_log: pd.DataFrame, metric='avg_resolution_hours'):
    from mining.stats import _case_summary
    case_data = _case_summary(event_log)
    if case_data.empty:
        return _empty_fig('No data')

    agg = case_data.groupby('country').agg(
        avg_resolution_hours=('resolution_hours', 'mean'),
        total_cases=('case_id', 'count'),
        rework_rate=('is_rework', 'mean'),
    ).reset_index()
    agg['rework_rate_pct'] = (agg['rework_rate'] * 100).round(1)
    agg['avg_resolution_hours'] = agg['avg_resolution_hours'].round(1)

    metric_label = {
        'avg_resolution_hours': 'Avg Resolution (hrs)',
        'rework_rate_pct': 'Rework Rate (%)',
        'total_cases': 'Total Cases',
    }.get(metric, metric)

    fig = px.bar(
        agg.sort_values(metric, ascending=False),
        x='country', y=metric,
        title=f'Country Comparison — {metric_label}',
        labels={metric: metric_label, 'country': 'Country'},
        color=metric,
        color_continuous_scale='Blues',
        template=DARK_TEMPLATE,
        text=metric,
    )
    fig.update_traces(texttemplate='%{text:.1f}', textposition='outside')
    fig.update_layout(coloraxis_showscale=False, margin=dict(l=10, r=20, t=40, b=30))
    return fig


def automation_candidates_chart(df: pd.DataFrame):
    if df.empty:
        return _empty_fig('No data')

    col = df.columns[0]
    top = df.head(15).copy()
    fig = px.bar(
        top, x='Automation Score', y=col, orientation='h',
        title='Automation Candidate Ranking',
        labels={'Automation Score': 'Score (Volume × Standardisation)', col: ''},
        color='Automation Score',
        color_continuous_scale=['#0d6efd', '#6610f2'],
        template=DARK_TEMPLATE,
        text='Automation Score',
    )
    fig.update_traces(texttemplate='%{text:.0f}', textposition='outside')
    fig.update_layout(coloraxis_showscale=False, margin=dict(l=10, r=20, t=40, b=10))
    return fig


def conformance_heatmap(scores_df: pd.DataFrame):
    if scores_df.empty:
        return _empty_fig('No conformance data')

    pivot = scores_df.pivot_table(
        values='f_score', index='country', columns='category', aggfunc='mean'
    ).round(2)

    fig = go.Figure(data=go.Heatmap(
        z=pivot.values,
        x=pivot.columns.tolist(),
        y=pivot.index.tolist(),
        colorscale='RdYlGn',
        zmin=0, zmax=1,
        text=pivot.values,
        texttemplate='%{text:.2f}',
        hovertemplate='Country: %{y}<br>Category: %{x}<br>F-Score: %{z:.2f}<extra></extra>',
    ))
    fig.update_layout(
        title='Conformance F-Score by Country & Category',
        template=DARK_TEMPLATE,
        margin=dict(l=10, r=20, t=40, b=10),
    )
    return fig


def _empty_fig(msg):
    fig = go.Figure()
    fig.add_annotation(text=msg, xref='paper', yref='paper', x=0.5, y=0.5,
                       showarrow=False, font=dict(color='#6c757d', size=14))
    fig.update_layout(template=DARK_TEMPLATE, margin=dict(l=10, r=10, t=10, b=10))
    return fig
