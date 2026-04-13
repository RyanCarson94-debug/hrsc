import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  List,
  Table2,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Filter,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  AlertCircle,
  Folder,
  FolderOpen,
  LayoutGrid,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTaxonomyStore } from '@/store'
import {
  Button,
  Badge,
  Card,
  Spinner,
  EmptyState,
  Modal,
  ConfirmDialog,
  Input,
  Textarea,
  Select,
  Tabs,
} from '@/components/ui'
import { fmtDateTime, fmtDate, tagsToString, parseJsonArr } from '@/lib/utils'
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_COLORS,
  STATUS_COLORS,
  type TaxonomyNode,
  type NodeType,
  type NodeStatus,
  type ChangeLogEntry,
  type NodeFormValues,
  type TreeNodeUI,
} from '@/types'

// ---------------------------------------------------------------------------
// NodeEditor Modal
// ---------------------------------------------------------------------------

const NODE_TYPE_OPTIONS = Object.entries(NODE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
]

interface NodeEditorProps {
  open: boolean
  onClose: () => void
  frameworkId: string
  parentId?: string | null
  node?: TaxonomyNode | null
  nodes: TaxonomyNode[]
  onSaved: () => void
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  open,
  onClose,
  frameworkId,
  parentId,
  node,
  nodes,
  onSaved,
}) => {
  const { addToast } = useTaxonomyStore()
  const isEdit = !!node
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NodeFormValues>({
    parent_id: parentId ?? node?.parent_id ?? '',
    code: node?.code ?? '',
    name: node?.name ?? '',
    description: node?.description ?? '',
    node_type: node?.node_type ?? 'process',
    status: node?.status ?? 'draft',
    owner: node?.owner ?? '',
    steward: node?.steward ?? '',
    approver: node?.approver ?? '',
    effective_from: node?.effective_from ?? '',
    effective_to: node?.effective_to ?? '',
    version_label: node?.version_label ?? '',
    synonyms: tagsToString(node?.synonyms),
    keywords: tagsToString(node?.keywords),
    region_applicability: node?.region_applicability ?? '',
    country_applicability: node?.country_applicability ?? '',
    business_unit_applicability: node?.business_unit_applicability ?? '',
    notes: node?.notes ?? '',
    source_reference: node?.source_reference ?? '',
    sort_order: String(node?.sort_order ?? 0),
    change_note: '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        parent_id: parentId ?? node?.parent_id ?? '',
        code: node?.code ?? '',
        name: node?.name ?? '',
        description: node?.description ?? '',
        node_type: (node?.node_type ?? 'process') as NodeType,
        status: (node?.status ?? 'draft') as NodeStatus,
        owner: node?.owner ?? '',
        steward: node?.steward ?? '',
        approver: node?.approver ?? '',
        effective_from: node?.effective_from ?? '',
        effective_to: node?.effective_to ?? '',
        version_label: node?.version_label ?? '',
        synonyms: tagsToString(node?.synonyms),
        keywords: tagsToString(node?.keywords),
        region_applicability: node?.region_applicability ?? '',
        country_applicability: node?.country_applicability ?? '',
        business_unit_applicability: node?.business_unit_applicability ?? '',
        notes: node?.notes ?? '',
        source_reference: node?.source_reference ?? '',
        sort_order: String(node?.sort_order ?? 0),
        change_note: '',
      })
    }
  }, [open, node, parentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field: keyof NodeFormValues, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (!form.code.trim()) {
      addToast('error', 'Code is required')
      return
    }
    if (!form.name.trim()) {
      addToast('error', 'Name is required')
      return
    }
    setSaving(true)
    try {
      if (isEdit && node) {
        await api.nodes.update(node.id, form)
        addToast('success', `Node "${form.name}" updated`)
      } else {
        await api.nodes.create(frameworkId, form)
        addToast('success', `Node "${form.name}" created`)
      }
      onSaved()
      onClose()
    } catch (err) {
      addToast('error', `Failed to save node: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const parentOptions = [
    { value: '', label: '— Root (no parent) —' },
    ...nodes
      .filter((n) => n.id !== node?.id)
      .map((n) => ({ value: n.id, label: `${n.code} — ${n.name}` })),
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Node — ${node?.code}` : 'Create Node'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Node'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Code *"
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="e.g. WFA.01"
          />
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Node display name"
          />
        </div>

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Detailed description of this node"
          rows={3}
        />

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Node Type *"
            value={form.node_type}
            onChange={(e) => set('node_type', e.target.value)}
            options={NODE_TYPE_OPTIONS}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Parent Node"
            value={form.parent_id}
            onChange={(e) => set('parent_id', e.target.value)}
            options={parentOptions}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Owner"
            value={form.owner}
            onChange={(e) => set('owner', e.target.value)}
            placeholder="Process owner"
          />
          <Input
            label="Steward"
            value={form.steward}
            onChange={(e) => set('steward', e.target.value)}
            placeholder="Data steward"
          />
          <Input
            label="Approver"
            value={form.approver}
            onChange={(e) => set('approver', e.target.value)}
            placeholder="Approver"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Effective From"
            type="date"
            value={form.effective_from}
            onChange={(e) => set('effective_from', e.target.value)}
          />
          <Input
            label="Effective To"
            type="date"
            value={form.effective_to}
            onChange={(e) => set('effective_to', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Synonyms (comma-separated)"
            value={form.synonyms}
            onChange={(e) => set('synonyms', e.target.value)}
            placeholder="e.g. workforce admin, WFA"
          />
          <Input
            label="Keywords (comma-separated)"
            value={form.keywords}
            onChange={(e) => set('keywords', e.target.value)}
            placeholder="e.g. hire, onboard"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Region"
            value={form.region_applicability}
            onChange={(e) => set('region_applicability', e.target.value)}
            placeholder="e.g. Global"
          />
          <Input
            label="Country"
            value={form.country_applicability}
            onChange={(e) => set('country_applicability', e.target.value)}
            placeholder="e.g. US, UK"
          />
          <Input
            label="Business Unit"
            value={form.business_unit_applicability}
            onChange={(e) => set('business_unit_applicability', e.target.value)}
            placeholder="e.g. All"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Version Label"
            value={form.version_label}
            onChange={(e) => set('version_label', e.target.value)}
            placeholder="e.g. 1.0"
          />
          <Input
            label="Sort Order"
            type="number"
            value={form.sort_order}
            onChange={(e) => set('sort_order', e.target.value)}
          />
        </div>

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Internal notes"
          rows={2}
        />

        <Input
          label="Source Reference"
          value={form.source_reference}
          onChange={(e) => set('source_reference', e.target.value)}
          placeholder="e.g. APQC Framework 5.2"
        />

        {isEdit && (
          <Input
            label="Change Note"
            value={form.change_note}
            onChange={(e) => set('change_note', e.target.value)}
            placeholder="Describe what changed and why"
          />
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// TreeView
// ---------------------------------------------------------------------------

interface TreeViewProps {
  nodes: TreeNodeUI[]
  selectedId: string | null
  expandedIds: Set<string>
  search: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

function nodeMatchesSearch(node: TreeNodeUI, q: string): boolean {
  const lq = q.toLowerCase()
  return (
    node.code.toLowerCase().includes(lq) ||
    node.name.toLowerCase().includes(lq) ||
    (node.description ?? '').toLowerCase().includes(lq)
  )
}

function treeContainsMatch(node: TreeNodeUI, q: string): boolean {
  if (nodeMatchesSearch(node, q)) return true
  return node.children.some((c) => treeContainsMatch(c, q))
}

const TreeNodeRow: React.FC<{
  node: TreeNodeUI
  selectedId: string | null
  expandedIds: Set<string>
  search: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  depth: number
}> = ({ node, selectedId, expandedIds, search, onSelect, onToggle, depth }) => {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const matches = search ? nodeMatchesSearch(node, search) : true

  // If searching, skip branches that have no matches at all
  if (search && !treeContainsMatch(node, search)) return null

  const highlight = search && matches

  return (
    <>
      <div
        className={[
          'flex items-center gap-1 rounded-md cursor-pointer select-none group transition-colors',
          'text-sm pr-2',
          isSelected
            ? 'bg-brand-600/20 text-brand-300'
            : 'text-slate-300 hover:bg-slate-800/60',
          highlight ? 'ring-1 ring-brand-500/40' : '',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand toggle */}
        <button
          className={[
            'w-5 h-5 flex items-center justify-center flex-shrink-0 rounded text-slate-500',
            'hover:text-slate-300 transition-colors',
            hasChildren ? '' : 'opacity-0 pointer-events-none',
          ].join(' ')}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.id)
          }}
          tabIndex={-1}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Folder icon */}
        <span className="flex-shrink-0 text-slate-500 group-hover:text-slate-400 transition-colors">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5" />
            ) : (
              <Folder className="w-3.5 h-3.5" />
            )
          ) : (
            <div className="w-3.5 h-3.5 rounded-sm border border-slate-700 bg-slate-800" />
          )}
        </span>

        {/* Code + Name */}
        <span className="flex-1 py-1.5 min-w-0 truncate ml-1">
          <span className="font-mono text-xs text-slate-400 mr-1.5">{node.code}</span>
          <span className="truncate">{node.name}</span>
        </span>

        {/* Status dot */}
        <span
          className={[
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            node.status === 'active'
              ? 'bg-green-500'
              : node.status === 'draft'
              ? 'bg-slate-500'
              : 'bg-red-500',
          ].join(' ')}
          title={node.status}
        />
      </div>

      {/* Children */}
      {isExpanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            selectedId={selectedId}
            expandedIds={expandedIds}
            search={search}
            onSelect={onSelect}
            onToggle={onToggle}
            depth={depth + 1}
          />
        ))}
    </>
  )
}

const TreeView: React.FC<TreeViewProps> = ({
  nodes,
  selectedId,
  expandedIds,
  search,
  onSelect,
  onToggle,
}) => {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        No nodes yet
      </div>
    )
  }

  return (
    <div className="space-y-0.5 py-1">
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          selectedId={selectedId}
          expandedIds={expandedIds}
          search={search}
          onSelect={onSelect}
          onToggle={onToggle}
          depth={0}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FlatTable
// ---------------------------------------------------------------------------

type SortField = 'code' | 'name' | 'node_type' | 'level' | 'status' | 'owner' | 'full_path'
type SortDir = 'asc' | 'desc'

interface FlatTableProps {
  nodes: TaxonomyNode[]
  selectedId: string | null
  search: string
  filterType: string
  filterStatus: string
  filterOwner: string
  onSelect: (id: string) => void
}

const FlatTable: React.FC<FlatTableProps> = ({
  nodes,
  selectedId,
  search,
  filterType,
  filterStatus,
  filterOwner,
  onSelect,
}) => {
  const [sortField, setSortField] = useState<SortField>('code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filtered = nodes.filter((n) => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !n.code.toLowerCase().includes(q) &&
        !n.name.toLowerCase().includes(q) &&
        !(n.description ?? '').toLowerCase().includes(q)
      )
        return false
    }
    if (filterType && n.node_type !== filterType) return false
    if (filterStatus && n.status !== filterStatus) return false
    if (filterOwner && !(n.owner ?? '').toLowerCase().includes(filterOwner.toLowerCase()))
      return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = String(a[sortField] ?? '')
    const bv = String(b[sortField] ?? '')
    const cmp = sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return cmp
  })

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-brand-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-brand-400" />
    )
  }

  const headers: { field: SortField; label: string }[] = [
    { field: 'code', label: 'Code' },
    { field: 'name', label: 'Name' },
    { field: 'node_type', label: 'Type' },
    { field: 'level', label: 'Lvl' },
    { field: 'status', label: 'Status' },
    { field: 'owner', label: 'Owner' },
    { field: 'full_path', label: 'Path' },
  ]

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs min-w-[600px]">
        <thead className="sticky top-0 bg-slate-900 z-10">
          <tr className="border-b border-slate-800">
            {headers.map((h) => (
              <th
                key={h.field}
                className="text-left text-slate-400 font-medium px-3 py-2 cursor-pointer whitespace-nowrap hover:text-slate-200 transition-colors"
                onClick={() => handleSort(h.field)}
              >
                <span className="flex items-center gap-1">
                  {h.label}
                  <SortIcon field={h.field} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-slate-500">
                No nodes match the current filters
              </td>
            </tr>
          ) : (
            sorted.map((node) => (
              <tr
                key={node.id}
                onClick={() => onSelect(node.id)}
                className={[
                  'border-b border-slate-800/50 cursor-pointer transition-colors',
                  selectedId === node.id
                    ? 'bg-brand-600/10'
                    : 'hover:bg-slate-800/40',
                ].join(' ')}
              >
                <td className="px-3 py-2 font-mono text-slate-300 whitespace-nowrap">
                  {node.code}
                </td>
                <td className="px-3 py-2 text-slate-200 max-w-[200px] truncate">{node.name}</td>
                <td className="px-3 py-2">
                  <Badge
                    label={NODE_TYPE_LABELS[node.node_type] ?? node.node_type}
                    className={NODE_TYPE_COLORS[node.node_type] ?? ''}
                  />
                </td>
                <td className="px-3 py-2 text-slate-400">{node.level}</td>
                <td className="px-3 py-2">
                  <Badge
                    label={node.status}
                    className={STATUS_COLORS[node.status]}
                    dot
                  />
                </td>
                <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">
                  {node.owner ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate font-mono text-2xs">
                  {node.full_path ?? '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NodeDetails
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string
  value?: string | number | null
  mono?: boolean
}

const FieldRow: React.FC<FieldRowProps> = ({ label, value, mono }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-2xs text-slate-500 uppercase tracking-wide font-medium">{label}</span>
    <span
      className={[
        'text-sm text-slate-200 break-words',
        mono ? 'font-mono' : '',
        !value ? 'text-slate-600 italic' : '',
      ].join(' ')}
    >
      {value || '—'}
    </span>
  </div>
)

interface NodeDetailsProps {
  node: TaxonomyNode
  nodes: TaxonomyNode[]
  frameworkId: string
  onEdit: () => void
  onAddChild: () => void
  onDeleted: () => void
  onDuplicated: () => void
}

const NodeDetails: React.FC<NodeDetailsProps> = ({
  node,
  nodes,
  frameworkId,
  onEdit,
  onAddChild,
  onDeleted,
  onDuplicated,
}) => {
  const { addToast } = useTaxonomyStore()
  const [activeTab, setActiveTab] = useState('details')
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([])
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const directChildren = nodes.filter((n) => n.parent_id === node.id)

  // Build breadcrumb
  const breadcrumb: TaxonomyNode[] = []
  let current: TaxonomyNode | undefined = node
  while (current) {
    breadcrumb.unshift(current)
    current = current.parent_id ? nodes.find((n) => n.id === current!.parent_id) : undefined
  }

  useEffect(() => {
    setActiveTab('details')
    setChangelog([])
  }, [node.id])

  const loadChangelog = useCallback(async () => {
    if (changelog.length > 0) return
    setChangelogLoading(true)
    try {
      const data = await api.changelog(frameworkId, { node_id: node.id, limit: 50 })
      setChangelog(data)
    } catch (err) {
      addToast('error', `Failed to load change log: ${(err as Error).message}`)
    } finally {
      setChangelogLoading(false)
    }
  }, [changelog.length, frameworkId, node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'changelog') {
      loadChangelog()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.nodes.delete(node.id)
      addToast('success', `Node "${node.name}" deleted`)
      onDeleted()
    } catch (err) {
      addToast('error', `Failed to delete node: ${(err as Error).message}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      await api.nodes.create(frameworkId, {
        parent_id: node.parent_id ?? '',
        code: node.code + '_COPY',
        name: node.name + ' (Copy)',
        description: node.description ?? '',
        node_type: node.node_type,
        status: 'draft',
        owner: node.owner ?? '',
        steward: node.steward ?? '',
        approver: node.approver ?? '',
        effective_from: node.effective_from ?? '',
        effective_to: node.effective_to ?? '',
        version_label: node.version_label ?? '',
        synonyms: tagsToString(node.synonyms),
        keywords: tagsToString(node.keywords),
        region_applicability: node.region_applicability ?? '',
        country_applicability: node.country_applicability ?? '',
        business_unit_applicability: node.business_unit_applicability ?? '',
        notes: node.notes ?? '',
        source_reference: node.source_reference ?? '',
        sort_order: String(node.sort_order),
        change_note: `Duplicated from ${node.code}`,
      })
      addToast('success', `Duplicated as ${node.code}_COPY (draft)`)
      onDuplicated()
    } catch (err) {
      addToast('error', `Failed to duplicate: ${(err as Error).message}`)
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex-shrink-0">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-slate-500 mb-2 flex-wrap">
          {breadcrumb.map((b, i) => (
            <React.Fragment key={b.id}>
              <span className={b.id === node.id ? 'text-slate-300' : 'text-slate-500'}>
                {b.code}
              </span>
              {i < breadcrumb.length - 1 && (
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="font-mono text-sm text-slate-400 mr-2">{node.code}</span>
            <h2 className="text-xl font-semibold text-slate-100 mt-0.5 leading-tight">
              {node.name}
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge
                label={NODE_TYPE_LABELS[node.node_type] ?? node.node_type}
                className={NODE_TYPE_COLORS[node.node_type] ?? ''}
              />
              <Badge
                label={node.status}
                className={STATUS_COLORS[node.status]}
                dot
              />
              {node.level !== undefined && (
                <Badge
                  label={`Level ${node.level}`}
                  className="bg-slate-700/50 text-slate-400 border-slate-700"
                />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            variant="primary"
            size="sm"
            icon={<Edit2 className="w-3.5 h-3.5" />}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onAddChild}
          >
            Add Child
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Copy className="w-3.5 h-3.5" />}
            onClick={handleDuplicate}
            loading={duplicating}
          >
            Duplicate as Draft
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setConfirmDelete(true)}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex-shrink-0">
        <Tabs
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'children', label: 'Children', count: directChildren.length },
            { id: 'changelog', label: 'Change Log' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'details' && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <FieldRow label="Description" value={node.description} />
            <FieldRow label="Full Path" value={node.full_path} mono />
            <FieldRow label="Owner" value={node.owner} />
            <FieldRow label="Steward" value={node.steward} />
            <FieldRow label="Approver" value={node.approver} />
            <FieldRow label="Version" value={node.version_label} />
            <FieldRow
              label="Effective From"
              value={fmtDate(node.effective_from)}
            />
            <FieldRow
              label="Effective To"
              value={fmtDate(node.effective_to)}
            />
            <FieldRow
              label="Synonyms"
              value={parseJsonArr(node.synonyms).join(', ') || undefined}
            />
            <FieldRow
              label="Keywords"
              value={parseJsonArr(node.keywords).join(', ') || undefined}
            />
            <FieldRow label="Region" value={node.region_applicability} />
            <FieldRow label="Country" value={node.country_applicability} />
            <FieldRow label="Business Unit" value={node.business_unit_applicability} />
            <FieldRow label="Source Reference" value={node.source_reference} />
            <FieldRow label="Notes" value={node.notes} />
            <FieldRow label="Sort Order" value={node.sort_order} />
            <FieldRow label="Created" value={fmtDateTime(node.created_at)} />
            <FieldRow label="Updated" value={fmtDateTime(node.updated_at)} />
          </div>
        )}

        {activeTab === 'children' && (
          <div className="space-y-2">
            {directChildren.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-500 text-sm">No child nodes</p>
              </div>
            ) : (
              directChildren.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                >
                  <span className="font-mono text-xs text-slate-400 w-24 flex-shrink-0">
                    {child.code}
                  </span>
                  <span className="flex-1 text-sm text-slate-200 truncate">
                    {child.name}
                  </span>
                  <Badge
                    label={NODE_TYPE_LABELS[child.node_type] ?? child.node_type}
                    className={NODE_TYPE_COLORS[child.node_type] ?? ''}
                  />
                  <Badge
                    label={child.status}
                    className={STATUS_COLORS[child.status]}
                    dot
                  />
                </div>
              ))
            )}
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={onAddChild}
              >
                Add Child Node
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'changelog' && (
          <div>
            {changelogLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : changelog.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-500 text-sm">No change log entries</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="text-left font-medium py-2 px-2">Date</th>
                      <th className="text-left font-medium py-2 px-2">Action</th>
                      <th className="text-left font-medium py-2 px-2">Field</th>
                      <th className="text-left font-medium py-2 px-2">Old Value</th>
                      <th className="text-left font-medium py-2 px-2">New Value</th>
                      <th className="text-left font-medium py-2 px-2">Changed By</th>
                      <th className="text-left font-medium py-2 px-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changelog.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                          {fmtDateTime(entry.changed_at)}
                        </td>
                        <td className="py-2 px-2">
                          <Badge
                            label={entry.action_type.replace(/_/g, ' ')}
                            className="bg-slate-700/40 text-slate-300 border-slate-700"
                          />
                        </td>
                        <td className="py-2 px-2 text-slate-400">{entry.field_changed ?? '—'}</td>
                        <td className="py-2 px-2 text-slate-500 max-w-[100px] truncate">
                          {entry.old_value ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-slate-300 max-w-[100px] truncate">
                          {entry.new_value ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                          {entry.changed_by}
                        </td>
                        <td className="py-2 px-2 text-slate-500 max-w-[120px] truncate">
                          {entry.change_note ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Node"
        description={`Are you sure you want to delete "${node.name}" (${node.code})? This action cannot be undone. All children will also be affected.`}
        confirmLabel="Delete Node"
        danger
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter Popover
// ---------------------------------------------------------------------------

interface FilterPopoverProps {
  filterType: string
  filterStatus: string
  filterOwner: string
  onTypeChange: (v: string) => void
  onStatusChange: (v: string) => void
  onOwnerChange: (v: string) => void
  onClose: () => void
}

const FilterPopover: React.FC<FilterPopoverProps> = ({
  filterType,
  filterStatus,
  filterOwner,
  onTypeChange,
  onStatusChange,
  onOwnerChange,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-64 space-y-3"
    >
      <p className="text-xs font-semibold text-slate-300">Filters</p>
      <Select
        label="Node Type"
        value={filterType}
        onChange={(e) => onTypeChange(e.target.value)}
        placeholder="All types"
        options={NODE_TYPE_OPTIONS}
      />
      <Select
        label="Status"
        value={filterStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        placeholder="All statuses"
        options={STATUS_OPTIONS}
      />
      <Input
        label="Owner contains"
        value={filterOwner}
        onChange={(e) => onOwnerChange(e.target.value)}
        placeholder="Filter by owner"
      />
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          onTypeChange('')
          onStatusChange('')
          onOwnerChange('')
        }}
      >
        Clear filters
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FrameworkExplorer (main)
// ---------------------------------------------------------------------------

const FrameworkExplorer: React.FC = () => {
  const {
    selectedFrameworkId,
    frameworks,
    nodes,
    nodesLoading,
    tree,
    expandedIds,
    selectedNodeId,
    selectNode,
    toggleExpand,
    expandAll,
    collapseAll,
    loadNodes,
  } = useTaxonomyStore()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [editingNode, setEditingNode] = useState<TaxonomyNode | null>(null)
  const [addChildParentId, setAddChildParentId] = useState<string | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedFramework = frameworks.find((f) => f.id === selectedFrameworkId)

  const hasActiveFilters = !!(filterType || filterStatus || filterOwner)

  const handleEdit = () => {
    setEditingNode(selectedNode)
    setAddChildParentId(null)
    setShowNodeEditor(true)
  }

  const handleAddChild = () => {
    setEditingNode(null)
    setAddChildParentId(selectedNodeId)
    setShowNodeEditor(true)
  }

  const handleAddRoot = () => {
    setEditingNode(null)
    setAddChildParentId(null)
    setShowNodeEditor(true)
  }

  const handleSaved = () => {
    if (selectedFrameworkId) {
      loadNodes(selectedFrameworkId)
    }
  }

  const handleDeleted = () => {
    selectNode(null)
    if (selectedFrameworkId) {
      loadNodes(selectedFrameworkId)
    }
  }

  if (!selectedFrameworkId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<LayoutGrid className="w-7 h-7" />}
          title="No framework selected"
          description="Select a framework from the sidebar to explore its taxonomy nodes."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">
                {selectedFramework?.name ?? 'Framework'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {selectedFramework && (
                  <Badge
                    label={selectedFramework.status}
                    className={STATUS_COLORS[selectedFramework.status]}
                    dot
                  />
                )}
                <span className="text-2xs text-slate-500">
                  {nodes.length} nodes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-brand-500 placeholder:text-slate-500 transition-colors"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* View + expand controls */}
          <div className="flex items-center gap-1">
            {/* View toggle */}
            <button
              title="Tree view"
              onClick={() => setViewMode('tree')}
              className={[
                'p-1.5 rounded-md transition-colors',
                viewMode === 'tree'
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
              ].join(' ')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              title="Flat table"
              onClick={() => setViewMode('table')}
              className={[
                'p-1.5 rounded-md transition-colors',
                viewMode === 'table'
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
              ].join(' ')}
            >
              <Table2 className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1" />

            {/* Expand/Collapse */}
            <button
              title="Expand all"
              onClick={expandAll}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
            <button
              title="Collapse all"
              onClick={collapseAll}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1" />

            {/* Filter */}
            <div className="relative">
              <button
                title="Filters"
                onClick={() => setShowFilter((v) => !v)}
                className={[
                  'p-1.5 rounded-md transition-colors',
                  showFilter || hasActiveFilters
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
                ].join(' ')}
              >
                <Filter className="w-4 h-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand-500 rounded-full" />
                )}
              </button>
              {showFilter && (
                <FilterPopover
                  filterType={filterType}
                  filterStatus={filterStatus}
                  filterOwner={filterOwner}
                  onTypeChange={setFilterType}
                  onStatusChange={setFilterStatus}
                  onOwnerChange={setFilterOwner}
                  onClose={() => setShowFilter(false)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Tree / Table area */}
        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          {nodesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : viewMode === 'tree' ? (
            <TreeView
              nodes={tree}
              selectedId={selectedNodeId}
              expandedIds={expandedIds}
              search={search}
              onSelect={selectNode}
              onToggle={toggleExpand}
            />
          ) : (
            <FlatTable
              nodes={nodes}
              selectedId={selectedNodeId}
              search={search}
              filterType={filterType}
              filterStatus={filterStatus}
              filterOwner={filterOwner}
              onSelect={selectNode}
            />
          )}
        </div>

        {/* Bottom: Add Root */}
        <div className="px-3 py-3 border-t border-slate-800 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleAddRoot}
          >
            Add Root Node
          </Button>
        </div>
      </div>

      {/* Divider visual */}
      <div className="w-px bg-slate-800 flex-shrink-0" />

      {/* Right panel */}
      <div className="flex-1 overflow-hidden bg-slate-950">
        {!selectedNode ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<AlertCircle className="w-7 h-7" />}
              title="Select a node to view details"
              description="Click any node in the tree or table to view and edit its details."
            />
          </div>
        ) : (
          <NodeDetails
            key={selectedNode.id}
            node={selectedNode}
            nodes={nodes}
            frameworkId={selectedFrameworkId}
            onEdit={handleEdit}
            onAddChild={handleAddChild}
            onDeleted={handleDeleted}
            onDuplicated={handleSaved}
          />
        )}
      </div>

      {/* Node editor modal */}
      <NodeEditor
        open={showNodeEditor}
        onClose={() => {
          setShowNodeEditor(false)
          setEditingNode(null)
          setAddChildParentId(null)
        }}
        frameworkId={selectedFrameworkId}
        parentId={addChildParentId ?? (editingNode ? undefined : undefined)}
        node={editingNode}
        nodes={nodes}
        onSaved={handleSaved}
      />
    </div>
  )
}

export default FrameworkExplorer
