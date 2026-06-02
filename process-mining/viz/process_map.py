import networkx as nx
from mining.discovery import hierarchical_layout, dfg_to_graph

START_ACTIVITIES = {'Case Opened', 'Initiate Hire', 'Initiate Termination',
                    'Initiate Transfer', 'Initiate Change'}
END_ACTIVITIES = {'Case Closed', 'Complete', 'Closed'}

PERF_THRESHOLDS = {
    'low': 4,    # < 4 hrs = green
    'mid': 24,   # < 24 hrs = yellow
    # else red
}


def dfg_to_cytoscape_elements(dfg_freq, dfg_perf, display_mode='frequency', tier_filter=None,
                               min_freq=1):
    G = dfg_to_graph(dfg_freq, dfg_perf)
    if G.number_of_nodes() == 0:
        return []

    pos = hierarchical_layout(G)

    node_freq = {}
    for (src, tgt), freq in dfg_freq.items():
        node_freq[src] = node_freq.get(src, 0) + freq
        node_freq[tgt] = node_freq.get(tgt, 0) + freq

    max_freq = max(node_freq.values()) if node_freq else 1
    max_edge_val = max(
        (v for v in (dfg_freq if display_mode == 'frequency' else dfg_perf).values()),
        default=1
    )

    elements = []

    for node in G.nodes():
        x, y = pos.get(node, (0, 0))
        freq = node_freq.get(node, 1)
        size = 30 + int(freq / max_freq * 50)

        if node in START_ACTIVITIES:
            color = '#28a745'
        elif node in END_ACTIVITIES:
            color = '#dc3545'
        else:
            color = '#0d6efd'

        elements.append({
            'data': {
                'id': node,
                'label': node,
                'freq': freq,
                'size': size,
                'color': color,
            },
            'position': {'x': x * 160, 'y': y * 100},
        })

    for (src, tgt), freq in dfg_freq.items():
        if freq < min_freq:
            continue
        perf = dfg_perf.get((src, tgt), 0)
        edge_val = freq if display_mode == 'frequency' else perf
        width = 1 + int(edge_val / max_edge_val * 8)

        if display_mode == 'duration':
            if perf < PERF_THRESHOLDS['low']:
                edge_color = '#28a745'
            elif perf < PERF_THRESHOLDS['mid']:
                edge_color = '#ffc107'
            else:
                edge_color = '#dc3545'
        else:
            edge_color = '#6c757d'

        label = f'{freq}' if display_mode == 'frequency' else f'{perf:.1f}h'

        elements.append({
            'data': {
                'source': src,
                'target': tgt,
                'label': label,
                'width': width,
                'color': edge_color,
                'freq': freq,
                'duration': round(perf, 2),
            }
        })

    return elements


def get_cytoscape_stylesheet():
    return [
        {
            'selector': 'node',
            'style': {
                'label': 'data(label)',
                'background-color': 'data(color)',
                'width': 'data(size)',
                'height': 'data(size)',
                'font-size': '11px',
                'color': '#ffffff',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'text-max-width': '90px',
                'border-width': 2,
                'border-color': '#343a40',
            }
        },
        {
            'selector': 'edge',
            'style': {
                'label': 'data(label)',
                'width': 'data(width)',
                'line-color': 'data(color)',
                'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'font-size': '9px',
                'color': '#adb5bd',
                'text-rotation': 'autorotate',
                'text-margin-y': -8,
            }
        },
        {
            'selector': ':selected',
            'style': {
                'background-color': '#fd7e14',
                'line-color': '#fd7e14',
                'target-arrow-color': '#fd7e14',
                'border-color': '#fff',
            }
        }
    ]
