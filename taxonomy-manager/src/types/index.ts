// ─── Core domain types ────────────────────────────────────────────────────────

export type FrameworkStatus = 'draft' | 'active' | 'archived'
export type NodeStatus = 'draft' | 'active' | 'retired'
export type Severity = 'error' | 'warning' | 'info'
export type ActionType =
  | 'created' | 'updated' | 'deleted' | 'moved'
  | 'status_changed' | 'snapshot_created' | 'imported' | 'restored' | 'bulk_import'
export type NodeType =
  | 'domain' | 'process_group' | 'process' | 'subprocess'
  | 'service' | 'service_category' | 'case_category' | 'request_type'
  | 'knowledge_category' | 'lifecycle_event' | 'policy_topic'
  | 'resolver_group' | 'tag' | 'custom'
export type JobStatus = 'pending' | 'processing' | 'preview' | 'completed' | 'failed'

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Framework {
  id: string
  name: string
  description: string | null
  framework_type: string
  source_basis: string | null
  version_label: string | null
  status: FrameworkStatus
  is_deleted: number
  node_count?: number
  issue_count?: number
  created_at: string
  updated_at: string
}

export interface TaxonomyNode {
  id: string
  framework_id: string
  parent_id: string | null
  code: string
  name: string
  description: string | null
  node_type: NodeType
  level: number
  sort_order: number
  full_path: string | null
  status: NodeStatus
  owner: string | null
  steward: string | null
  approver: string | null
  effective_from: string | null
  effective_to: string | null
  version_label: string | null
  synonyms: string   // JSON array string
  keywords: string   // JSON array string
  region_applicability: string | null
  country_applicability: string | null
  business_unit_applicability: string | null
  notes: string | null
  source_reference: string | null
  is_deleted: number
  created_at: string
  updated_at: string
  // UI-only (not stored)
  children?: TaxonomyNode[]
}

export interface ChangeLogEntry {
  id: string
  framework_id: string
  node_id: string | null
  action_type: ActionType
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  change_note: string | null
  changed_by: string
  changed_at: string
  // joined
  node_code?: string
  node_name?: string
}

export interface ValidationIssue {
  id: string
  framework_id: string
  node_id: string | null
  severity: Severity
  issue_type: string
  description: string
  suggested_fix: string | null
  is_resolved: number
  created_at: string
  resolved_at: string | null
  // joined
  node_code?: string
  node_name?: string
}

export interface ImportJob {
  id: string
  framework_id: string | null
  filename: string | null
  import_type: string
  status: JobStatus
  row_count: number
  imported_count: number
  skipped_count: number
  error_count: number
  summary: string
  errors: string
  created_at: string
  completed_at: string | null
}

export interface ExportJob {
  id: string
  framework_id: string | null
  export_type: string
  filename: string | null
  status: JobStatus
  node_count: number
  created_at: string
  completed_at: string | null
}

export interface Snapshot {
  id: string
  framework_id: string
  version_label: string
  node_count: number
  snapshot_data?: string  // only present on single-fetch
  snapshot_notes: string | null
  created_by: string
  created_at: string
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface DashboardStats {
  total_frameworks: number
  total_nodes: number
  nodes_by_status: { draft: number; active: number; retired: number }
  nodes_by_type: Record<string, number>
  unresolved_issues_by_severity: { error: number; warning: number; info: number }
  nodes_missing_owner: number
  nodes_missing_description: number
  recent_changes: ChangeLogEntry[]
  recent_imports: ImportJob[]
  recent_exports: ExportJob[]
}

export interface NodeMovePayload {
  new_parent_id: string | null
  change_note?: string
}

export interface ImportPayload {
  nodes: Partial<TaxonomyNode>[]
  mode: 'create' | 'update' | 'upsert'
  filename?: string
  on_duplicate: 'skip' | 'overwrite' | 'error'
}

export interface ImportResult {
  job_id: string
  imported: number
  skipped: number
  errors: Array<{ row: number; code?: string; message: string }>
}

export interface ExportData {
  framework: Framework
  nodes: TaxonomyNode[]
  issues: ValidationIssue[]
  changelog: ChangeLogEntry[]
}

export interface SnapshotCompare {
  added: TaxonomyNode[]
  removed: TaxonomyNode[]
  modified: Array<{ code: string; name: string; changes: Record<string, { from: unknown; to: unknown }> }>
  moved: Array<{ code: string; name: string; old_parent: string | null; new_parent: string | null }>
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export interface TreeNodeUI extends TaxonomyNode {
  children: TreeNodeUI[]
  depth: number
  isExpanded?: boolean
}

export interface NodeFormValues {
  parent_id: string
  code: string
  name: string
  description: string
  node_type: NodeType
  status: NodeStatus
  owner: string
  steward: string
  approver: string
  effective_from: string
  effective_to: string
  version_label: string
  synonyms: string
  keywords: string
  region_applicability: string
  country_applicability: string
  business_unit_applicability: string
  notes: string
  source_reference: string
  sort_order: string
  change_note: string
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  domain: 'Domain',
  process_group: 'Process Group',
  process: 'Process',
  subprocess: 'Sub-process',
  service: 'Service',
  service_category: 'Service Category',
  case_category: 'Case Category',
  request_type: 'Request Type',
  knowledge_category: 'Knowledge Category',
  lifecycle_event: 'Lifecycle Event',
  policy_topic: 'Policy Topic',
  resolver_group: 'Resolver Group',
  tag: 'Tag',
  custom: 'Custom',
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  domain: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  process_group: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  process: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  subprocess: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  service: 'bg-green-500/20 text-green-300 border-green-500/30',
  service_category: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  case_category: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  request_type: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  knowledge_category: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  lifecycle_event: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  policy_topic: 'bg-red-500/20 text-red-300 border-red-500/30',
  resolver_group: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  tag: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  custom: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

export const STATUS_COLORS: Record<NodeStatus | FrameworkStatus, string> = {
  draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  retired: 'bg-red-500/20 text-red-400 border-red-500/30',
  archived: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}
