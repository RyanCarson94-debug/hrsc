import pandas as pd
import networkx as nx
from collections import defaultdict


def build_dfg(event_log: pd.DataFrame):
    """Return (dfg_freq, dfg_perf, start_activities, end_activities)."""
    freq = defaultdict(int)
    perf_lists = defaultdict(list)
    start_acts = defaultdict(int)
    end_acts = defaultdict(int)

    for case_id, grp in event_log.groupby('case_id'):
        grp = grp.sort_values('timestamp')
        acts = grp['activity'].tolist()
        times = grp['timestamp'].tolist()

        if acts:
            start_acts[acts[0]] += 1
            end_acts[acts[-1]] += 1

        for i in range(len(acts) - 1):
            pair = (acts[i], acts[i + 1])
            freq[pair] += 1
            try:
                dur_hours = (times[i + 1] - times[i]).total_seconds() / 3600
                perf_lists[pair].append(max(0, dur_hours))
            except Exception:
                pass

    dfg_perf = {k: sum(v) / len(v) for k, v in perf_lists.items() if v}

    return dict(freq), dfg_perf, dict(start_acts), dict(end_acts)


def hierarchical_layout(G: nx.DiGraph):
    """Left-to-right layout based on topological sort layers."""
    try:
        gens = list(nx.topological_generations(G))
    except nx.NetworkXUnfeasible:
        return nx.spring_layout(G, seed=42, k=2)

    pos = {}
    for layer_idx, layer in enumerate(gens):
        sorted_layer = sorted(layer)
        n = len(sorted_layer)
        for node_idx, node in enumerate(sorted_layer):
            pos[node] = (layer_idx * 2.5, -(node_idx - (n - 1) / 2) * 1.5)
    return pos


def dfg_to_graph(dfg_freq, dfg_perf):
    G = nx.DiGraph()
    for (src, tgt), freq in dfg_freq.items():
        G.add_edge(src, tgt, freq=freq, duration=dfg_perf.get((src, tgt), 0))
    return G
