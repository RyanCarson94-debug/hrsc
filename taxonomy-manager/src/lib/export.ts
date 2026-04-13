import * as XLSX from 'xlsx'
import type { ExportData, TaxonomyNode, ValidationIssue, ChangeLogEntry } from '@/types'
import { parseJsonArr, fmtDate, fmtDateTime } from './utils'

// ─── Excel export ─────────────────────────────────────────────────────────────

export function generateExcelExport(data: ExportData): Blob {
  const wb = XLSX.utils.book_new()

  // 1. Framework_Summary
  const summaryRows = [
    ['Field', 'Value'],
    ['Name', data.framework.name],
    ['Description', data.framework.description ?? ''],
    ['Framework Type', data.framework.framework_type],
    ['Source Basis', data.framework.source_basis ?? ''],
    ['Version Label', data.framework.version_label ?? ''],
    ['Status', data.framework.status],
    ['Total Nodes', data.nodes.length],
    ['Active Nodes', data.nodes.filter(n => n.status === 'active').length],
    ['Draft Nodes', data.nodes.filter(n => n.status === 'draft').length],
    ['Retired Nodes', data.nodes.filter(n => n.status === 'retired').length],
    ['Created', fmtDateTime(data.framework.created_at)],
    ['Last Updated', fmtDateTime(data.framework.updated_at)],
    ['Export Date', fmtDateTime(new Date().toISOString())],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Framework_Summary')

  // 2. Taxonomy_Nodes — full flat
  const nodeHeaders = [
    'id','framework_id','parent_id','code','name','description',
    'node_type','level','sort_order','full_path','status',
    'owner','steward','approver','effective_from','effective_to',
    'version_label','synonyms','keywords',
    'region_applicability','country_applicability','business_unit_applicability',
    'notes','source_reference','created_at','updated_at',
  ]
  const nodeRows = data.nodes.map(n => nodeHeaders.map(h => {
    const val = (n as Record<string, unknown>)[h]
    if (h === 'synonyms' || h === 'keywords') {
      return parseJsonArr(val as string).join('; ')
    }
    if (h === 'effective_from' || h === 'effective_to') return fmtDate(val as string)
    if (h === 'created_at' || h === 'updated_at') return fmtDateTime(val as string)
    return val ?? ''
  }))
  const wsNodes = XLSX.utils.aoa_to_sheet([nodeHeaders, ...nodeRows])
  styleHeaderRow(wsNodes, nodeHeaders.length)
  wsNodes['!cols'] = nodeHeaders.map(h =>
    ['name','description','full_path'].includes(h) ? { wch: 40 } : { wch: 18 }
  )
  XLSX.utils.book_append_sheet(wb, wsNodes, 'Taxonomy_Nodes')

  // 3. Hierarchy_View — indented display
  const hvHeaders = ['indent_name','code','name','full_path','level','parent_code','status','sort_order']
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]))
  const hierarchyRows = sortByHierarchy(data.nodes).map(n => {
    const indent = '    '.repeat(n.level) + n.name
    const parent = n.parent_id ? nodeMap.get(n.parent_id)?.code ?? '' : ''
    return [indent, n.code, n.name, n.full_path ?? '', n.level, parent, n.status, n.sort_order]
  })
  const wsHV = XLSX.utils.aoa_to_sheet([hvHeaders, ...hierarchyRows])
  styleHeaderRow(wsHV, hvHeaders.length)
  wsHV['!cols'] = [{ wch: 50 }, { wch: 18 }, { wch: 40 }, { wch: 60 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsHV, 'Hierarchy_View')

  // 4. Validation_Issues
  const viHeaders = ['severity','issue_type','node_code','node_name','description','suggested_fix','is_resolved']
  const viRows = data.issues.map((i: ValidationIssue) => [
    i.severity, i.issue_type, i.node_code ?? '', i.node_name ?? '',
    i.description, i.suggested_fix ?? '', i.is_resolved ? 'Yes' : 'No',
  ])
  const wsVI = XLSX.utils.aoa_to_sheet([viHeaders, ...viRows])
  styleHeaderRow(wsVI, viHeaders.length)
  wsVI['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 35 }, { wch: 60 }, { wch: 60 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsVI, 'Validation_Issues')

  // 5. Change_Log
  const clHeaders = ['changed_at','changed_by','node_code','node_name','action_type','field_changed','old_value','new_value','change_note']
  const clRows = data.changelog.map((c: ChangeLogEntry) => [
    fmtDateTime(c.changed_at), c.changed_by, c.node_code ?? '', c.node_name ?? '',
    c.action_type, c.field_changed ?? '', c.old_value ?? '', c.new_value ?? '', c.change_note ?? '',
  ])
  const wsCL = XLSX.utils.aoa_to_sheet([clHeaders, ...clRows])
  styleHeaderRow(wsCL, clHeaders.length)
  wsCL['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 22 }, { wch: 35 }, { wch: 35 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, wsCL, 'Change_Log')

  // 6. Metadata_Lists
  const metaRows = [
    ['Node Types', '', 'Status Values', '', 'Severity Values'],
    ['domain', '', 'draft', '', 'error'],
    ['process_group', '', 'active', '', 'warning'],
    ['process', '', 'retired', '', 'info'],
    ['subprocess'],
    ['service'],
    ['service_category'],
    ['case_category'],
    ['request_type'],
    ['knowledge_category'],
    ['lifecycle_event'],
    ['policy_topic'],
    ['resolver_group'],
    ['tag'],
    ['custom'],
  ]
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows)
  wsMeta['!cols'] = [{ wch: 22 }, { wch: 4 }, { wch: 16 }, { wch: 4 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata_Lists')

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ─── Import template ──────────────────────────────────────────────────────────

export function generateImportTemplate(): Blob {
  const wb = XLSX.utils.book_new()
  const headers = [
    'code','name','description','parent_code','node_type','status',
    'owner','steward','approver','effective_from','effective_to',
    'version_label','synonyms','keywords',
    'region_applicability','country_applicability','business_unit_applicability',
    'notes','source_reference','sort_order',
  ]
  const example = [
    'WFA','Workforce Administration','Manages all workforce admin processes',
    '','process_group','active',
    'Jane Smith','John Doe','HR Director','2024-01-01','',
    '1.0','workforce; admin','administration; hrsc',
    'Global','','',
    'Core HR service center domain','APQC Framework','10',
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  styleHeaderRow(ws, headers.length)
  ws['!cols'] = headers.map(() => ({ wch: 22 }))

  // Instructions sheet
  const instrRows = [
    ['HR Taxonomy Manager — Import Template Instructions'],
    [''],
    ['Column', 'Required', 'Description'],
    ['code', 'Yes', 'Unique code within the framework (e.g. WFA, WFA.01)'],
    ['name', 'Yes', 'Display name of the node'],
    ['description', 'No', 'Detailed description'],
    ['parent_code', 'No', 'Code of the parent node; leave blank for top-level nodes'],
    ['node_type', 'Yes', 'One of: domain, process_group, process, subprocess, service, service_category, case_category, request_type, knowledge_category, lifecycle_event, policy_topic, resolver_group, tag, custom'],
    ['status', 'No', 'draft (default), active, or retired'],
    ['owner', 'No', 'Name of the process owner'],
    ['steward', 'No', 'Name of the data steward'],
    ['approver', 'No', 'Name of the approver'],
    ['effective_from', 'No', 'YYYY-MM-DD format'],
    ['effective_to', 'No', 'YYYY-MM-DD format'],
    ['version_label', 'No', 'Version string e.g. 1.0'],
    ['synonyms', 'No', 'Semicolon-separated list of synonyms'],
    ['keywords', 'No', 'Semicolon-separated list of keywords'],
    ['region_applicability', 'No', 'e.g. Global, EMEA, APAC'],
    ['country_applicability', 'No', 'e.g. US, UK, DE'],
    ['business_unit_applicability', 'No', 'e.g. All, Corporate, Operations'],
    ['notes', 'No', 'Free-text notes'],
    ['source_reference', 'No', 'Reference to source framework'],
    ['sort_order', 'No', 'Integer for ordering within parent (default 0)'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Import_Template')
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions')

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ─── Parse import file ────────────────────────────────────────────────────────

export interface ParsedImportRow {
  code: string
  name: string
  description?: string
  parent_code?: string
  node_type?: string
  status?: string
  owner?: string
  steward?: string
  approver?: string
  effective_from?: string
  effective_to?: string
  version_label?: string
  synonyms?: string
  keywords?: string
  region_applicability?: string
  country_applicability?: string
  business_unit_applicability?: string
  notes?: string
  source_reference?: string
  sort_order?: string
  _row: number
  _errors: string[]
}

export function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
        const rows: ParsedImportRow[] = raw.map((r, i) => {
          const errors: string[] = []
          if (!r.code) errors.push('Missing required field: code')
          if (!r.name) errors.push('Missing required field: name')
          return {
            code: String(r.code ?? '').trim(),
            name: String(r.name ?? '').trim(),
            description: r.description || undefined,
            parent_code: r.parent_code || undefined,
            node_type: r.node_type || undefined,
            status: r.status || undefined,
            owner: r.owner || undefined,
            steward: r.steward || undefined,
            approver: r.approver || undefined,
            effective_from: r.effective_from || undefined,
            effective_to: r.effective_to || undefined,
            version_label: r.version_label || undefined,
            synonyms: r.synonyms || undefined,
            keywords: r.keywords || undefined,
            region_applicability: r.region_applicability || undefined,
            country_applicability: r.country_applicability || undefined,
            business_unit_applicability: r.business_unit_applicability || undefined,
            notes: r.notes || undefined,
            source_reference: r.source_reference || undefined,
            sort_order: r.sort_order || undefined,
            _row: i + 2,
            _errors: errors,
          }
        })
        resolve(rows)
      } catch (err) {
        reject(new Error(`Failed to parse file: ${(err as Error).message}`))
      }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function styleHeaderRow(ws: XLSX.WorkSheet, colCount: number) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= Math.min(colCount - 1, range.e.c); c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[addr]) continue
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4D52E7' } },
      alignment: { horizontal: 'center' },
    }
  }
}

function sortByHierarchy(nodes: TaxonomyNode[]): TaxonomyNode[] {
  const result: TaxonomyNode[] = []
  const map = new Map<string, TaxonomyNode[]>()
  for (const n of nodes) {
    const key = n.parent_id ?? '__root__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  const walk = (parentId: string | null) => {
    const children = map.get(parentId ?? '__root__') ?? []
    children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    for (const c of children) {
      result.push(c)
      walk(c.id)
    }
  }
  walk(null)
  return result
}
