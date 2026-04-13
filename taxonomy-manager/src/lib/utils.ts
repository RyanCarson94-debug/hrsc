import { clsx, type ClassValue } from 'clsx'
import type { TaxonomyNode, TreeNodeUI } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

export function buildTree(nodes: TaxonomyNode[]): TreeNodeUI[] {
  const map = new Map<string, TreeNodeUI>()
  const roots: TreeNodeUI[] = []

  for (const n of nodes) {
    map.set(n.id, { ...n, children: [], depth: n.level })
  }

  for (const n of map.values()) {
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(n)
    } else {
      roots.push(n)
    }
  }

  const sort = (arr: TreeNodeUI[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    arr.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

export function flattenTree(nodes: TreeNodeUI[], depth = 0): TreeNodeUI[] {
  const result: TreeNodeUI[] = []
  for (const n of nodes) {
    result.push({ ...n, depth })
    result.push(...flattenTree(n.children, depth + 1))
  }
  return result
}

export function getAllDescendantIds(nodes: TaxonomyNode[], nodeId: string): string[] {
  const children = nodes.filter(n => n.parent_id === nodeId)
  const ids: string[] = []
  for (const c of children) {
    ids.push(c.id)
    ids.push(...getAllDescendantIds(nodes, c.id))
  }
  return ids
}

export function getAncestorIds(nodes: TaxonomyNode[], nodeId: string): string[] {
  const node = nodes.find(n => n.id === nodeId)
  if (!node || !node.parent_id) return []
  return [node.parent_id, ...getAncestorIds(nodes, node.parent_id)]
}

// ─── JSON field helpers ───────────────────────────────────────────────────────

export function parseJsonArr(val: string | null | undefined): string[] {
  if (!val) return []
  try { return JSON.parse(val) } catch { return [] }
}

export function stringifyJsonArr(arr: string[]): string {
  return JSON.stringify(arr.filter(Boolean))
}

export function tagsToString(val: string | null | undefined): string {
  return parseJsonArr(val).join(', ')
}

export function stringToTags(val: string): string {
  return JSON.stringify(val.split(',').map(s => s.trim()).filter(Boolean))
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function pluralize(n: number, word: string, plural = `${word}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? word : plural}`
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
