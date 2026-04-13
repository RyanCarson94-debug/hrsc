import { create } from 'zustand'
import { api } from '@/lib/api'
import { buildTree } from '@/lib/utils'
import type { Framework, TaxonomyNode, TreeNodeUI, ValidationIssue } from '@/types'

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  companyName: string
  brandColor: string
  logoUrl: string
  defaultNodeStatus: 'draft' | 'active'
  showNodeCodes: boolean
  autoExpandTree: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'HR Taxonomy',
  brandColor: '#4d52e7',
  logoUrl: '',
  defaultNodeStatus: 'draft',
  showNodeCodes: true,
  autoExpandTree: true,
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('hrsc_taxonomy_settings')
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'
export interface Toast { id: string; type: ToastType; message: string }

// ─── Store shape ─────────────────────────────────────────────────────────────

interface TaxonomyStore {
  // Frameworks
  frameworks: Framework[]
  frameworksLoading: boolean
  selectedFrameworkId: string | null

  // Nodes
  nodes: TaxonomyNode[]
  nodesLoading: boolean
  tree: TreeNodeUI[]
  expandedIds: Set<string>
  selectedNodeId: string | null

  // Validation
  issues: ValidationIssue[]
  validationLoading: boolean

  // UI
  toasts: Toast[]
  searchQuery: string
  filterType: string
  filterStatus: string
  filterOwner: string
  sidebarCollapsed: boolean

  // Settings
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void

  // Actions
  loadFrameworks: () => Promise<void>
  selectFramework: (id: string) => Promise<void>
  createFramework: (data: Partial<Framework>) => Promise<Framework>
  updateFramework: (id: string, data: Partial<Framework>) => Promise<void>
  deleteFramework: (id: string) => Promise<void>

  loadNodes: (frameworkId: string) => Promise<void>
  selectNode: (id: string | null) => void
  toggleExpand: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  expandToNode: (nodeId: string) => void

  runValidation: (frameworkId: string) => Promise<void>

  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void

  setSearch: (q: string) => void
  setFilterType: (t: string) => void
  setFilterStatus: (s: string) => void
  setFilterOwner: (o: string) => void
  toggleSidebar: () => void
}

export const useTaxonomyStore = create<TaxonomyStore>((set, get) => ({
  frameworks: [],
  frameworksLoading: false,
  selectedFrameworkId: null,

  nodes: [],
  nodesLoading: false,
  tree: [],
  expandedIds: new Set(),
  selectedNodeId: null,

  issues: [],
  validationLoading: false,

  toasts: [],
  searchQuery: '',
  filterType: '',
  filterStatus: '',
  filterOwner: '',
  sidebarCollapsed: false,

  settings: loadSettings(),
  updateSettings: (patch) => set(s => {
    const next = { ...s.settings, ...patch }
    try { localStorage.setItem('hrsc_taxonomy_settings', JSON.stringify(next)) } catch { /* ignore */ }
    return { settings: next }
  }),

  // ─── Frameworks ────────────────────────────────────────────────────────────
  loadFrameworks: async () => {
    set({ frameworksLoading: true })
    try {
      const frameworks = await api.frameworks.list()
      set({ frameworks, frameworksLoading: false })
    } catch (err) {
      set({ frameworksLoading: false })
      get().addToast('error', `Failed to load frameworks: ${(err as Error).message}`)
    }
  },

  selectFramework: async (id) => {
    set({ selectedFrameworkId: id, selectedNodeId: null, expandedIds: new Set() })
    await get().loadNodes(id)
  },

  createFramework: async (data) => {
    const fw = await api.frameworks.create(data)
    set(s => ({ frameworks: [fw, ...s.frameworks] }))
    get().addToast('success', `Framework "${fw.name}" created`)
    return fw
  },

  updateFramework: async (id, data) => {
    const fw = await api.frameworks.update(id, data)
    set(s => ({
      frameworks: s.frameworks.map(f => f.id === id ? fw : f),
    }))
    get().addToast('success', 'Framework updated')
  },

  deleteFramework: async (id) => {
    await api.frameworks.delete(id)
    set(s => ({
      frameworks: s.frameworks.filter(f => f.id !== id),
      selectedFrameworkId: s.selectedFrameworkId === id ? null : s.selectedFrameworkId,
    }))
    get().addToast('success', 'Framework deleted')
  },

  // ─── Nodes ─────────────────────────────────────────────────────────────────
  loadNodes: async (frameworkId) => {
    set({ nodesLoading: true })
    try {
      const nodes = await api.nodes.list(frameworkId)
      const tree = buildTree(nodes)
      // Auto-expand first level
      const firstLevelIds = new Set(nodes.filter(n => !n.parent_id).map(n => n.id))
      set({ nodes, tree, nodesLoading: false, expandedIds: firstLevelIds })
    } catch (err) {
      set({ nodesLoading: false })
      get().addToast('error', `Failed to load nodes: ${(err as Error).message}`)
    }
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleExpand: (id) => set(s => {
    const next = new Set(s.expandedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    return { expandedIds: next }
  }),

  expandAll: () => set(s => ({
    expandedIds: new Set(s.nodes.map(n => n.id)),
  })),

  collapseAll: () => set({ expandedIds: new Set() }),

  expandToNode: (nodeId) => set(s => {
    const next = new Set(s.expandedIds)
    // Walk up the tree to expand all ancestors
    let current = s.nodes.find(n => n.id === nodeId)
    while (current?.parent_id) {
      next.add(current.parent_id)
      current = s.nodes.find(n => n.id === current!.parent_id)
    }
    return { expandedIds: next, selectedNodeId: nodeId }
  }),

  // ─── Validation ────────────────────────────────────────────────────────────
  runValidation: async (frameworkId) => {
    set({ validationLoading: true })
    try {
      const issues = await api.validation.run(frameworkId)
      set({ issues, validationLoading: false })
      const errCount = issues.filter(i => i.severity === 'error').length
      const warnCount = issues.filter(i => i.severity === 'warning').length
      if (errCount > 0) {
        get().addToast('error', `Validation: ${errCount} error(s), ${warnCount} warning(s)`)
      } else if (warnCount > 0) {
        get().addToast('warning', `Validation: ${warnCount} warning(s)`)
      } else {
        get().addToast('success', 'Validation passed — no issues found')
      }
    } catch (err) {
      set({ validationLoading: false })
      get().addToast('error', `Validation failed: ${(err as Error).message}`)
    }
  },

  // ─── Toasts ────────────────────────────────────────────────────────────────
  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().removeToast(id), 5000)
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // ─── UI filters ────────────────────────────────────────────────────────────
  setSearch: (searchQuery) => set({ searchQuery }),
  setFilterType: (filterType) => set({ filterType }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setFilterOwner: (filterOwner) => set({ filterOwner }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
