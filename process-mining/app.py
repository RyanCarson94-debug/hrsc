import dash
from dash import dcc, html, Input, Output, State, dash_table, callback_context
import dash_bootstrap_components as dbc
import dash_cytoscape as cyto
import plotly.graph_objects as go
import pandas as pd
import json
import base64
import io
import os

from ingest.servicenow import parse_servicenow, validate_schema as sn_validate
from ingest.workday import parse_workday, validate_schema as wd_validate
from mining.discovery import build_dfg
from mining.stats import calculate_kpis, calculate_sla_analysis, calculate_rework, automation_candidates
from mining.variants import extract_variants
from mining.conformance import check_conformance, load_reference_model
from viz.process_map import dfg_to_cytoscape_elements, get_cytoscape_stylesheet
from viz.charts import (sla_breach_chart, sla_trend_chart, rework_chart,
                        country_comparison_chart, automation_candidates_chart,
                        conformance_heatmap, _empty_fig)
from sample_data.generate import generate_sample_data

# ── Bootstrap + Cytoscape ─────────────────────────────────────────────────────
app = dash.Dash(
    __name__,
    external_stylesheets=[dbc.themes.DARKLY, dbc.icons.BOOTSTRAP],
    suppress_callback_exceptions=True,
    title='HRSC Process Mining',
)
server = app.server  # for gunicorn

# ── Pre-load sample data ──────────────────────────────────────────────────────
_sn_sample, _wd_sample = generate_sample_data()
_sn_events = parse_servicenow(_sn_sample)
_wd_events = parse_workday(_wd_sample)
_sample_log = pd.concat([_sn_events, _wd_events], ignore_index=True)

SAMPLE_LOG_JSON = _sample_log.to_json(date_format='iso', orient='records')
REFERENCE_MODEL = load_reference_model()

# ── Helpers ───────────────────────────────────────────────────────────────────
def _log_from_store(store_data):
    if not store_data:
        return _sample_log.copy()
    df = pd.read_json(io.StringIO(store_data), orient='records')
    for col in ['timestamp', 'sla_due', 'resolved_at', 'closed_at', 'opened_at']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    return df


def _parse_upload(contents, filename):
    _, content_string = contents.split(',')
    decoded = base64.b64decode(content_string)
    if filename.endswith('.csv'):
        return pd.read_csv(io.StringIO(decoded.decode('utf-8')))
    return pd.read_excel(io.BytesIO(decoded))


def _kpi_card(title, value, sub='', color='primary'):
    return dbc.Card([
        dbc.CardBody([
            html.P(title, className='text-muted mb-1', style={'fontSize': '0.75rem'}),
            html.H4(str(value), className=f'text-{color} mb-0'),
            html.Small(sub, className='text-muted'),
        ])
    ], className='h-100')


def _dt_style():
    return {
        'style_table': {'overflowX': 'auto'},
        'style_cell': {
            'backgroundColor': '#2b3035', 'color': '#dee2e6',
            'border': '1px solid #495057', 'padding': '6px 10px',
            'fontSize': '13px', 'textAlign': 'left',
        },
        'style_header': {
            'backgroundColor': '#343a40', 'color': '#fff',
            'fontWeight': 'bold', 'border': '1px solid #495057',
        },
        'style_data_conditional': [
            {'if': {'row_index': 'odd'}, 'backgroundColor': '#343a40'},
        ],
    }


# ── Layout ────────────────────────────────────────────────────────────────────
def _upload_block(uid, label, hint):
    return dcc.Upload(
        id=uid,
        children=html.Div([
            html.I(className='bi bi-cloud-upload me-2'),
            html.Span(label),
            html.Br(),
            html.Small(hint, className='text-muted'),
        ]),
        style={
            'width': '100%', 'minHeight': '80px',
            'borderWidth': '2px', 'borderStyle': 'dashed',
            'borderRadius': '8px', 'borderColor': '#495057',
            'textAlign': 'center', 'padding': '20px',
            'cursor': 'pointer', 'color': '#adb5bd',
        },
        className='mb-2',
        multiple=False,
    )


gdpr_notice = dbc.Alert([
    html.I(className='bi bi-shield-lock me-2'),
    html.Strong('GDPR Notice: '),
    'All data is processed locally in your browser session and is never transmitted to any server. '
    'Anonymise Workday worker IDs before upload.',
], color='info', className='mb-3', style={'fontSize': '0.85rem'})

upload_panel = dbc.Card([
    dbc.CardHeader([
        html.I(className='bi bi-upload me-2'),
        'Data Upload',
        dbc.Badge('Using Synthetic Sample Data', id='data-badge', color='warning',
                  className='ms-2', pill=True),
    ]),
    dbc.CardBody([
        gdpr_notice,
        dbc.Row([
            dbc.Col([
                html.Label('ServiceNow HRSD Export (CSV)', className='fw-bold mb-1'),
                _upload_block('upload-sn', 'Drop ServiceNow CSV here',
                              'Required: number, opened_at, closed_at, state, category…'),
                html.Div(id='sn-upload-status'),
            ], md=4),
            dbc.Col([
                html.Label('Workday Export (CSV/XLSX)', className='fw-bold mb-1'),
                _upload_block('upload-wd', 'Drop Workday CSV/XLSX here',
                              'Required: transaction_id, business_process_type, step_name…'),
                html.Div(id='wd-upload-status'),
            ], md=4),
            dbc.Col([
                html.Label('Advisor Roster (Optional)', className='fw-bold mb-1'),
                _upload_block('upload-roster', 'Drop Advisor Roster CSV here',
                              'Fields: advisor_id, name, tier, country, team'),
                html.Div(id='roster-upload-status'),
            ], md=4),
        ]),
    ]),
], className='mb-3')

filter_bar = dbc.Card([
    dbc.CardBody([
        dbc.Row([
            dbc.Col([
                html.Label('Country', className='text-muted mb-1', style={'fontSize': '0.8rem'}),
                dcc.Dropdown(id='filter-country', multi=True, placeholder='All countries…',
                             className='dash-dark-dropdown'),
            ], md=3),
            dbc.Col([
                html.Label('Category', className='text-muted mb-1', style={'fontSize': '0.8rem'}),
                dcc.Dropdown(id='filter-category', multi=True, placeholder='All categories…'),
            ], md=3),
            dbc.Col([
                html.Label('Source', className='text-muted mb-1', style={'fontSize': '0.8rem'}),
                dcc.Dropdown(id='filter-source',
                             options=[{'label': 'All', 'value': 'all'},
                                      {'label': 'ServiceNow', 'value': 'servicenow'},
                                      {'label': 'Workday', 'value': 'workday'}],
                             value='all', clearable=False),
            ], md=2),
            dbc.Col([
                html.Label('Tier', className='text-muted mb-1', style={'fontSize': '0.8rem'}),
                dcc.Dropdown(id='filter-tier',
                             options=[{'label': 'All', 'value': 'all'},
                                      {'label': 'Tier 1', 'value': 'Tier 1'},
                                      {'label': 'Tier 2', 'value': 'Tier 2'},
                                      {'label': 'Workday', 'value': 'Workday'}],
                             value='all', clearable=False),
            ], md=2),
            dbc.Col([
                html.Label('​', className='d-block mb-1', style={'fontSize': '0.8rem'}),
                dbc.Button([html.I(className='bi bi-arrow-counterclockwise me-1'), 'Reset'],
                           id='btn-reset', color='secondary', size='sm', className='w-100'),
            ], md=2),
        ], className='g-2'),
    ], className='py-2'),
], className='mb-3')

kpi_strip = dbc.Row([
    dbc.Col(_kpi_card('Total Cases', '…', '', 'info'), id='kpi-total', md=True),
    dbc.Col(_kpi_card('Avg Resolution', '…', 'hours', 'primary'), id='kpi-resolution', md=True),
    dbc.Col(_kpi_card('SLA Compliance', '…', '%', 'success'), id='kpi-sla', md=True),
    dbc.Col(_kpi_card('First Contact Resolution', '…', '%', 'warning'), id='kpi-fcr', md=True),
    dbc.Col(_kpi_card('Rework Rate', '…', '%', 'danger'), id='kpi-rework', md=True),
], className='mb-3 g-2')

tab_process_map = dbc.Tab(label='Process Map', tab_id='tab-map', children=[
    dbc.Card([dbc.CardBody([
        dbc.Row([
            dbc.Col([
                html.Label('Display Mode', className='text-muted me-2', style={'fontSize': '0.8rem'}),
                dbc.RadioItems(
                    id='map-display-mode',
                    options=[{'label': 'Frequency', 'value': 'frequency'},
                             {'label': 'Duration (hrs)', 'value': 'duration'}],
                    value='frequency',
                    inline=True, className='me-3',
                ),
            ], md=5),
            dbc.Col([
                html.Label('Min edge frequency', className='text-muted me-2',
                           style={'fontSize': '0.8rem'}),
                dcc.Slider(id='map-min-freq', min=1, max=20, step=1, value=1,
                           tooltip={'placement': 'bottom'}, className='mt-1'),
            ], md=5),
        ], className='mb-2 align-items-center'),
        dbc.Row([
            dbc.Col([
                html.Div([
                    html.Span([html.Span(style={'background': '#28a745', 'display': 'inline-block',
                                               'width': 12, 'height': 12, 'borderRadius': '50%',
                                               'marginRight': 4}), 'Start']),
                    html.Span('  ', style={'whiteSpace': 'pre'}),
                    html.Span([html.Span(style={'background': '#dc3545', 'display': 'inline-block',
                                               'width': 12, 'height': 12, 'borderRadius': '50%',
                                               'marginRight': 4}), 'End']),
                    html.Span('  ', style={'whiteSpace': 'pre'}),
                    html.Span([html.Span(style={'background': '#0d6efd', 'display': 'inline-block',
                                               'width': 12, 'height': 12, 'borderRadius': '50%',
                                               'marginRight': 4}), 'Activity']),
                    html.Span('  ', style={'whiteSpace': 'pre'}),
                    html.Small('(Duration mode: green<4h  yellow<24h  red=bottleneck)',
                               className='text-muted ms-2'),
                ], className='mb-2', style={'fontSize': '0.8rem'}),
            ]),
        ]),
        cyto.Cytoscape(
            id='process-map',
            layout={'name': 'preset'},
            style={'width': '100%', 'height': '520px', 'backgroundColor': '#212529'},
            elements=[],
            stylesheet=get_cytoscape_stylesheet(),
            zoomingEnabled=True,
            userZoomingEnabled=True,
            panningEnabled=True,
        ),
        html.Div(id='map-hover-info', className='text-muted mt-1', style={'fontSize': '0.8rem'}),
    ])])
])

tab_variants = dbc.Tab(label='Variants', tab_id='tab-variants', children=[
    dbc.Card([dbc.CardBody([
        html.P('Top process variants ranked by frequency. Each row shows a distinct path through the process.',
               className='text-muted mb-3', style={'fontSize': '0.85rem'}),
        html.Div(id='variants-table'),
    ])])
])

tab_sla = dbc.Tab(label='SLA & Bottleneck', tab_id='tab-sla', children=[
    dbc.Card([dbc.CardBody([
        dbc.Row([
            dbc.Col([
                html.Label('Group By', className='text-muted mb-1', style={'fontSize': '0.8rem'}),
                dcc.Dropdown(
                    id='sla-group-by',
                    options=[{'label': v, 'value': k} for k, v in [
                        ('category', 'Category'), ('subcategory', 'Subcategory'),
                        ('country', 'Country'), ('assignment_group', 'Assignment Group'),
                    ]],
                    value='category', clearable=False,
                ),
            ], md=3),
        ], className='mb-3'),
        dbc.Row([
            dbc.Col(dcc.Graph(id='sla-breach-chart', style={'height': '350px'}), md=6),
            dbc.Col(dcc.Graph(id='sla-trend-chart', style={'height': '350px'}), md=6),
        ]),
        html.Hr(),
        html.H6('Rework Analysis', className='mt-2'),
        dbc.Row([
            dbc.Col(dcc.Graph(id='rework-chart', style={'height': '300px'}), md=6),
        ]),
    ])])
])

tab_conformance = dbc.Tab(label='Conformance', tab_id='tab-conformance', children=[
    dbc.Card([dbc.CardBody([
        dcc.Graph(id='conformance-heatmap', style={'height': '350px'}),
        html.Hr(),
        html.H6('Deviation Report', className='mt-2'),
        html.Div(id='deviation-table'),
        html.Hr(),
        html.H6('Edit Reference Model (happy_path.json)', className='mt-2'),
        html.P('Modify the JSON below and click Apply to update conformance analysis.',
               className='text-muted', style={'fontSize': '0.85rem'}),
        dcc.Textarea(
            id='reference-model-editor',
            value=json.dumps(REFERENCE_MODEL, indent=2),
            style={'width': '100%', 'height': '250px', 'fontFamily': 'monospace',
                   'backgroundColor': '#2b3035', 'color': '#dee2e6', 'border': '1px solid #495057',
                   'borderRadius': '4px', 'padding': '8px'},
        ),
        dbc.Button('Apply Reference Model', id='btn-apply-ref', color='primary',
                   className='mt-2'),
        html.Div(id='ref-model-status', className='mt-1'),
    ])])
])

tab_country = dbc.Tab(label='Country Comparison', tab_id='tab-country', children=[
    dbc.Card([dbc.CardBody([
        dbc.Row([
            dbc.Col([
                html.Label('Metric', className='text-muted mb-1', style={'fontSize': '0.8rem'}),
                dcc.Dropdown(
                    id='country-metric',
                    options=[
                        {'label': 'Avg Resolution (hrs)', 'value': 'avg_resolution_hours'},
                        {'label': 'Rework Rate (%)', 'value': 'rework_rate_pct'},
                        {'label': 'Total Cases', 'value': 'total_cases'},
                    ],
                    value='avg_resolution_hours', clearable=False,
                ),
            ], md=4),
        ], className='mb-3'),
        dcc.Graph(id='country-comparison-chart', style={'height': '350px'}),
    ])])
])

tab_automation = dbc.Tab(label='Automation Candidates', tab_id='tab-automation', children=[
    dbc.Card([dbc.CardBody([
        html.P([
            'Ranked by ',
            html.Strong('Volume × Standardisation Score'),
            '. High-scoring subcategories are prime candidates for NowAssist automation.',
        ], className='text-muted mb-3', style={'fontSize': '0.85rem'}),
        dcc.Graph(id='automation-chart', style={'height': '420px'}),
        html.Div(id='automation-table', className='mt-3'),
    ])])
])

tab_export = dbc.Tab(label='Export', tab_id='tab-export', children=[
    dbc.Card([dbc.CardBody([
        html.P('Download processed data as XLSX workbook containing KPIs, variants, SLA analysis, and event log.',
               className='text-muted mb-3'),
        dbc.Button([html.I(className='bi bi-download me-2'), 'Download XLSX Report'],
                   id='btn-export', color='success', className='mb-3'),
        dcc.Download(id='download-xlsx'),
        html.Div(id='export-status'),
    ])])
])

app.layout = dbc.Container([
    dcc.Store(id='event-log-store', data=SAMPLE_LOG_JSON),
    dcc.Store(id='roster-store', data=None),
    dcc.Store(id='reference-model-store', data=json.dumps(REFERENCE_MODEL)),
    dcc.Store(id='filter-options-store'),

    dbc.Row([
        dbc.Col([
            html.H3([
                html.I(className='bi bi-diagram-3 me-2 text-primary'),
                'HRSC Process Mining',
            ], className='mb-0'),
            html.Small('ServiceNow HRSD + Workday | Powered by Process Mining',
                       className='text-muted'),
        ], md=8),
        dbc.Col([
            html.Div([
                dbc.Badge('OFFLINE MODE', color='success', pill=True, className='me-2'),
                html.Small('Data processed locally', className='text-muted'),
            ], className='text-end pt-2'),
        ], md=4),
    ], className='mb-3 pt-3'),

    upload_panel,
    filter_bar,
    kpi_strip,

    dbc.Tabs([
        tab_process_map,
        tab_variants,
        tab_sla,
        tab_conformance,
        tab_country,
        tab_automation,
        tab_export,
    ], id='main-tabs', active_tab='tab-map', className='mb-3'),

], fluid=True, className='px-3 pb-4')


# ── Callbacks ─────────────────────────────────────────────────────────────────

@app.callback(
    Output('event-log-store', 'data'),
    Output('roster-store', 'data'),
    Output('sn-upload-status', 'children'),
    Output('wd-upload-status', 'children'),
    Output('roster-upload-status', 'children'),
    Output('data-badge', 'children'),
    Output('data-badge', 'color'),
    Input('upload-sn', 'contents'),
    Input('upload-wd', 'contents'),
    Input('upload-roster', 'contents'),
    State('upload-sn', 'filename'),
    State('upload-wd', 'filename'),
    State('upload-roster', 'filename'),
    State('event-log-store', 'data'),
    prevent_initial_call=True,
)
def handle_uploads(sn_contents, wd_contents, roster_contents,
                   sn_name, wd_name, roster_name, current_log):
    ctx = callback_context
    triggered = {t['prop_id'].split('.')[0] for t in ctx.triggered}

    sn_status = wd_status = roster_status = ''
    roster_data = None
    log_json = current_log
    badge_text = 'Synthetic Sample Data'
    badge_color = 'warning'

    roster_df = None
    if roster_contents:
        try:
            roster_df = _parse_upload(roster_contents, roster_name)
            roster_status = dbc.Alert(f'Roster loaded: {len(roster_df)} advisors', color='success', className='py-1 px-2 mb-0')
            roster_data = roster_df.to_json(orient='records')
        except Exception as e:
            roster_status = dbc.Alert(f'Roster error: {e}', color='danger', className='py-1 px-2 mb-0')

    events_list = []
    upload_name = None

    if sn_contents or wd_contents:
        if sn_contents:
            try:
                df = _parse_upload(sn_contents, sn_name)
                missing = sn_validate(df)
                if missing:
                    sn_status = dbc.Alert(f'Missing columns: {missing}', color='danger', className='py-1 px-2 mb-0')
                else:
                    evs = parse_servicenow(df, roster_df)
                    events_list.append(evs)
                    sn_status = dbc.Alert(f'SN loaded: {len(df)} cases → {len(evs)} events', color='success', className='py-1 px-2 mb-0')
                    upload_name = 'servicenow'
            except Exception as e:
                sn_status = dbc.Alert(f'SN error: {e}', color='danger', className='py-1 px-2 mb-0')

        if wd_contents:
            try:
                df = _parse_upload(wd_contents, wd_name)
                missing = wd_validate(df)
                if missing:
                    wd_status = dbc.Alert(f'Missing columns: {missing}', color='danger', className='py-1 px-2 mb-0')
                else:
                    evs = parse_workday(df)
                    events_list.append(evs)
                    wd_status = dbc.Alert(f'WD loaded: {len(df)} steps → {len(evs)} events', color='success', className='py-1 px-2 mb-0')
                    upload_name = 'workday'
            except Exception as e:
                wd_status = dbc.Alert(f'WD error: {e}', color='danger', className='py-1 px-2 mb-0')

        if events_list:
            combined = pd.concat(events_list, ignore_index=True)
            log_json = combined.to_json(date_format='iso', orient='records')
            badge_text = 'Live Data'
            badge_color = 'success'

    return log_json, roster_data, sn_status, wd_status, roster_status, badge_text, badge_color


@app.callback(
    Output('filter-country', 'options'),
    Output('filter-category', 'options'),
    Input('event-log-store', 'data'),
)
def update_filter_options(store_data):
    log = _log_from_store(store_data)
    countries = sorted(log['country'].dropna().unique())
    categories = sorted(log['category'].dropna().unique())
    c_opts = [{'label': c, 'value': c} for c in countries]
    cat_opts = [{'label': c, 'value': c} for c in categories]
    return c_opts, cat_opts


def _apply_filters(log, countries, categories, source, tier):
    if countries:
        log = log[log['country'].isin(countries)]
    if categories:
        log = log[log['category'].isin(categories)]
    if source and source != 'all':
        log = log[log['source'] == source]
    if tier and tier != 'all':
        log = log[log['tier'] == tier]
    return log


@app.callback(
    Output('kpi-total', 'children'),
    Output('kpi-resolution', 'children'),
    Output('kpi-sla', 'children'),
    Output('kpi-fcr', 'children'),
    Output('kpi-rework', 'children'),
    Input('event-log-store', 'data'),
    Input('filter-country', 'value'),
    Input('filter-category', 'value'),
    Input('filter-source', 'value'),
    Input('filter-tier', 'value'),
)
def update_kpis(store_data, countries, categories, source, tier):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, tier)
    kpis = calculate_kpis(log)

    sla_val = f"{kpis['sla_compliance_pct']}%" if kpis['sla_compliance_pct'] is not None else 'N/A'
    sla_color = 'success' if (kpis['sla_compliance_pct'] or 0) >= 80 else 'warning' if (kpis['sla_compliance_pct'] or 0) >= 60 else 'danger'
    rework_color = 'success' if kpis['rework_rate_pct'] < 10 else 'warning' if kpis['rework_rate_pct'] < 20 else 'danger'

    return (
        dbc.Col(_kpi_card('Total Cases', f"{kpis['total_cases']:,}", '', 'info'), md=True),
        dbc.Col(_kpi_card('Avg Resolution', f"{kpis['avg_resolution_hours']}", 'hours', 'primary'), md=True),
        dbc.Col(_kpi_card('SLA Compliance', sla_val, '', sla_color), md=True),
        dbc.Col(_kpi_card('First Contact Resolution', f"{kpis['fcr_pct']}%", '', 'warning'), md=True),
        dbc.Col(_kpi_card('Rework Rate', f"{kpis['rework_rate_pct']}%", '', rework_color), md=True),
    )


@app.callback(
    Output('process-map', 'elements'),
    Input('event-log-store', 'data'),
    Input('map-display-mode', 'value'),
    Input('map-min-freq', 'value'),
    Input('filter-country', 'value'),
    Input('filter-category', 'value'),
    Input('filter-source', 'value'),
    Input('filter-tier', 'value'),
)
def update_process_map(store_data, display_mode, min_freq, countries, categories, source, tier):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, tier)
    if log.empty:
        return []
    dfg_freq, dfg_perf, _, _ = build_dfg(log)
    return dfg_to_cytoscape_elements(dfg_freq, dfg_perf, display_mode, min_freq=min_freq or 1)


@app.callback(
    Output('map-hover-info', 'children'),
    Input('process-map', 'tapEdgeData'),
    Input('process-map', 'tapNodeData'),
)
def show_map_hover(edge_data, node_data):
    ctx = callback_context
    if not ctx.triggered:
        return ''
    triggered_id = ctx.triggered[0]['prop_id']
    if 'tapEdgeData' in triggered_id and edge_data:
        return (f"Edge: {edge_data.get('source')} → {edge_data.get('target')} | "
                f"Frequency: {edge_data.get('freq')} | Avg Duration: {edge_data.get('duration')}h")
    if 'tapNodeData' in triggered_id and node_data:
        return f"Activity: {node_data.get('label')} | Case frequency: {node_data.get('freq')}"
    return ''


@app.callback(
    Output('variants-table', 'children'),
    Input('event-log-store', 'data'),
    Input('filter-country', 'value'),
    Input('filter-category', 'value'),
    Input('filter-source', 'value'),
    Input('filter-tier', 'value'),
)
def update_variants(store_data, countries, categories, source, tier):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, tier)
    if log.empty:
        return html.P('No data', className='text-muted')
    df = extract_variants(log).head(50)
    return dash_table.DataTable(
        data=df.to_dict('records'),
        columns=[{'name': c.replace('_', ' ').title(), 'id': c,
                  'type': 'numeric' if df[c].dtype != object else 'text'}
                 for c in df.columns],
        sort_action='native',
        filter_action='native',
        page_size=15,
        **_dt_style(),
    )


@app.callback(
    Output('sla-breach-chart', 'figure'),
    Output('sla-trend-chart', 'figure'),
    Output('rework-chart', 'figure'),
    Input('event-log-store', 'data'),
    Input('sla-group-by', 'value'),
    Input('filter-country', 'value'),
    Input('filter-category', 'value'),
    Input('filter-source', 'value'),
    Input('filter-tier', 'value'),
)
def update_sla(store_data, group_by, countries, categories, source, tier):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, tier)
    sla_data = calculate_sla_analysis(log)
    _, by_cat, _ = calculate_rework(log)
    return (
        sla_breach_chart(sla_data, group_by),
        sla_trend_chart(sla_data),
        rework_chart(by_cat),
    )


@app.callback(
    Output('conformance-heatmap', 'figure'),
    Output('deviation-table', 'children'),
    Input('event-log-store', 'data'),
    Input('reference-model-store', 'data'),
    Input('filter-country', 'value'),
    Input('filter-category', 'value'),
    Input('filter-source', 'value'),
    Input('filter-tier', 'value'),
)
def update_conformance(store_data, ref_model_json, countries, categories, source, tier):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, tier)
    try:
        ref = json.loads(ref_model_json) if ref_model_json else REFERENCE_MODEL
    except Exception:
        ref = REFERENCE_MODEL

    if log.empty:
        return _empty_fig('No data'), html.P('No data', className='text-muted')

    scores_df, dev_df = check_conformance(log, ref)
    heatmap = conformance_heatmap(scores_df)

    if dev_df.empty:
        dev_table = html.P('No deviations found.', className='text-muted')
    else:
        dev_table = dash_table.DataTable(
            data=dev_df.head(50).to_dict('records'),
            columns=[{'name': c.replace('_', ' ').title(), 'id': c} for c in dev_df.columns],
            sort_action='native',
            filter_action='native',
            page_size=10,
            **_dt_style(),
        )
    return heatmap, dev_table


@app.callback(
    Output('reference-model-store', 'data'),
    Output('ref-model-status', 'children'),
    Input('btn-apply-ref', 'n_clicks'),
    State('reference-model-editor', 'value'),
    prevent_initial_call=True,
)
def apply_reference_model(n_clicks, editor_value):
    try:
        parsed = json.loads(editor_value)
        return json.dumps(parsed), dbc.Alert('Reference model updated.', color='success',
                                              className='py-1 px-2')
    except json.JSONDecodeError as e:
        return dash.no_update, dbc.Alert(f'Invalid JSON: {e}', color='danger',
                                          className='py-1 px-2')


@app.callback(
    Output('country-comparison-chart', 'figure'),
    Input('event-log-store', 'data'),
    Input('country-metric', 'value'),
    Input('filter-source', 'value'),
    Input('filter-tier', 'value'),
)
def update_country(store_data, metric, source, tier):
    log = _apply_filters(_log_from_store(store_data), None, None, source, tier)
    return country_comparison_chart(log, metric)


@app.callback(
    Output('automation-chart', 'figure'),
    Output('automation-table', 'children'),
    Input('event-log-store', 'data'),
    Input('filter-country', 'value'),
    Input('filter-category', 'value'),
    Input('filter-source', 'value'),
)
def update_automation(store_data, countries, categories, source):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, None)
    df = automation_candidates(log)
    chart = automation_candidates_chart(df)

    if df.empty:
        table = html.P('No data', className='text-muted')
    else:
        table = dash_table.DataTable(
            data=df.head(20).to_dict('records'),
            columns=[{'name': c, 'id': c} for c in df.columns],
            sort_action='native',
            page_size=10,
            **_dt_style(),
        )
    return chart, table


@app.callback(
    Output('download-xlsx', 'data'),
    Output('export-status', 'children'),
    Input('btn-export', 'n_clicks'),
    State('event-log-store', 'data'),
    State('filter-country', 'value'),
    State('filter-category', 'value'),
    State('filter-source', 'value'),
    State('filter-tier', 'value'),
    prevent_initial_call=True,
)
def export_xlsx(n_clicks, store_data, countries, categories, source, tier):
    log = _apply_filters(_log_from_store(store_data), countries, categories, source, tier)
    kpis = calculate_kpis(log)
    variants = extract_variants(log)
    sla_data = calculate_sla_analysis(log)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        pd.DataFrame([kpis]).to_excel(writer, sheet_name='KPIs', index=False)
        variants.to_excel(writer, sheet_name='Variants', index=False)
        if not sla_data.empty:
            sla_export = sla_data[[c for c in sla_data.columns
                                   if c not in ('sla_due', 'resolved_at', 'closed_at',
                                                'opened_at')]].copy()
            sla_export.to_excel(writer, sheet_name='SLA Analysis', index=False)
        log_export = log[[c for c in log.columns
                          if c not in ('sla_due', 'resolved_at', 'closed_at', 'opened_at')]].copy()
        log_export['timestamp'] = log_export['timestamp'].astype(str)
        log_export.to_excel(writer, sheet_name='Event Log', index=False)

    output.seek(0)
    return (
        dcc.send_bytes(output.read(), 'hrsc_process_mining_export.xlsx'),
        dbc.Alert('Export ready!', color='success', className='py-1 px-2'),
    )


@app.callback(
    Output('filter-country', 'value'),
    Output('filter-category', 'value'),
    Output('filter-source', 'value'),
    Output('filter-tier', 'value'),
    Input('btn-reset', 'n_clicks'),
    prevent_initial_call=True,
)
def reset_filters(_):
    return None, None, 'all', 'all'


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8050))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
