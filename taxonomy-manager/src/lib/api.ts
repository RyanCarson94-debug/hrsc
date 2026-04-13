import type {
  Framework, TaxonomyNode, ChangeLogEntry, ValidationIssue,
  ImportJob, ExportJob, Snapshot, DashboardStats,
  NodeMovePayload, ImportPayload, ImportResult,
  ExportData, SnapshotCompare, NodeFormValues,
} from '@/types'

const BASE = '/taxonomy-api'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

const get  = <T>(path: string) => req<T>(path, { method: 'GET' })
const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) })
const put  = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'PUT',  body: JSON.stringify(body) })
const del  = <T>(path: string) => req<T>(path, { method: 'DELETE' })

// ─── Health ──────────────────────────────────────────────────────────────────
export const api = {
  health: () => get<{ ok: boolean; timestamp: string }>('/health'),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: (frameworkId?: string) =>
    get<DashboardStats>(`/dashboard${frameworkId ? `?framework_id=${frameworkId}` : ''}`),

  // ─── Frameworks ────────────────────────────────────────────────────────────
  frameworks: {
    list: () => get<Framework[]>('/frameworks'),
    get:  (id: string) => get<Framework>(`/frameworks/${id}`),
    create: (body: Partial<Framework>) => post<Framework>('/frameworks', body),
    update: (id: string, body: Partial<Framework>) => put<Framework>(`/frameworks/${id}`, body),
    delete: (id: string) => del<{ ok: boolean }>(`/frameworks/${id}`),
  },

  // ─── Nodes ─────────────────────────────────────────────────────────────────
  nodes: {
    list: (frameworkId: string) =>
      get<TaxonomyNode[]>(`/frameworks/${frameworkId}/nodes`),
    get: (id: string) => get<TaxonomyNode>(`/nodes/${id}`),
    create: (frameworkId: string, body: Partial<NodeFormValues>) =>
      post<TaxonomyNode>(`/frameworks/${frameworkId}/nodes`, body),
    update: (id: string, body: Partial<NodeFormValues>) =>
      put<TaxonomyNode>(`/nodes/${id}`, body),
    delete: (id: string) => del<{ ok: boolean }>(`/nodes/${id}`),
    move: (id: string, body: NodeMovePayload) =>
      post<TaxonomyNode>(`/nodes/${id}/move`, body),
    search: (frameworkId: string, params: {
      q?: string; type?: string; status?: string; owner?: string
    }) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][]
      ).toString()
      return get<TaxonomyNode[]>(`/frameworks/${frameworkId}/search${qs ? `?${qs}` : ''}`)
    },
  },

  // ─── Validation ────────────────────────────────────────────────────────────
  validation: {
    run: (frameworkId: string) =>
      post<ValidationIssue[]>(`/frameworks/${frameworkId}/validate`),
    issues: (frameworkId: string, params?: {
      severity?: string; is_resolved?: string; node_id?: string
    }) => {
      const qs = params
        ? new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null) as [string, string][]
          ).toString()
        : ''
      return get<ValidationIssue[]>(`/frameworks/${frameworkId}/issues${qs ? `?${qs}` : ''}`)
    },
    resolve: (issueId: string) =>
      put<{ ok: boolean }>(`/issues/${issueId}/resolve`),
  },

  // ─── Change Log ────────────────────────────────────────────────────────────
  changelog: (frameworkId: string, params?: { limit?: number; offset?: number; node_id?: string }) => {
    const qs = params
      ? new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)]) as [string, string][]
        ).toString()
      : ''
    return get<ChangeLogEntry[]>(`/frameworks/${frameworkId}/changelog${qs ? `?${qs}` : ''}`)
  },

  // ─── Snapshots ─────────────────────────────────────────────────────────────
  snapshots: {
    list: (frameworkId: string) =>
      get<Snapshot[]>(`/frameworks/${frameworkId}/snapshots`),
    get: (id: string) => get<Snapshot>(`/snapshots/${id}`),
    create: (frameworkId: string, body: {
      version_label: string; snapshot_notes?: string; created_by?: string
    }) => post<Snapshot>(`/frameworks/${frameworkId}/snapshot`, body),
    restore: (id: string, body: { change_note?: string; restored_by?: string }) =>
      post<{ ok: boolean; node_count: number }>(`/snapshots/${id}/restore`, body),
    compare: (body: { snapshot_id_a: string; snapshot_id_b: string }) =>
      post<SnapshotCompare>('/snapshots/compare', body),
  },

  // ─── Import ────────────────────────────────────────────────────────────────
  import: {
    submit: (frameworkId: string, body: ImportPayload) =>
      post<ImportResult>(`/frameworks/${frameworkId}/import`, body),
    jobs: (frameworkId?: string) =>
      get<ImportJob[]>(`/import/jobs${frameworkId ? `?framework_id=${frameworkId}` : ''}`),
  },

  // ─── Export ────────────────────────────────────────────────────────────────
  export: {
    generate: (frameworkId: string) =>
      post<ExportData>(`/frameworks/${frameworkId}/export`),
    jobs: (frameworkId?: string) =>
      get<ExportJob[]>(`/export/jobs${frameworkId ? `?framework_id=${frameworkId}` : ''}`),
  },

  // ─── Seed ──────────────────────────────────────────────────────────────────
  seed: () => post<{ framework_id: string; node_count: number }>('/seed'),
}
