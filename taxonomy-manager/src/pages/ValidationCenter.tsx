import React, { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckSquare,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTaxonomyStore } from '@/store'
import { Badge, Button, Card, Spinner, EmptyState, StatCard } from '@/components/ui'
import { fmtDateTime } from '@/lib/utils'
import { SEVERITY_COLORS, type ValidationIssue, type Severity } from '@/types'

// ---------------------------------------------------------------------------
// Validation rules reference
// ---------------------------------------------------------------------------

interface ValidationRule {
  id: string
  severity: Severity
  description: string
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'duplicate_code',
    severity: 'error',
    description: 'Same code used by multiple nodes within the same framework.',
  },
  {
    id: 'duplicate_name_sibling',
    severity: 'warning',
    description: 'Two or more nodes share the same name under the same parent.',
  },
  {
    id: 'missing_description',
    severity: 'warning',
    description: 'Active nodes without a description filled in.',
  },
  {
    id: 'missing_owner',
    severity: 'warning',
    description: 'Active nodes without an owner assigned.',
  },
  {
    id: 'retired_parent_active_child',
    severity: 'error',
    description: 'A retired parent node has one or more active children.',
  },
  {
    id: 'invalid_effective_dates',
    severity: 'error',
    description: 'effective_to date is before effective_from date.',
  },
  {
    id: 'orphan_node',
    severity: 'error',
    description: 'Node references a parent_id that does not exist in the framework.',
  },
  {
    id: 'level_mismatch',
    severity: 'warning',
    description: "Node's stored level value does not match its actual depth in the hierarchy.",
  },
  {
    id: 'vague_label',
    severity: 'info',
    description: 'Node name is too generic (e.g. Other, Misc, TBD, N/A).',
  },
  {
    id: 'too_many_children',
    severity: 'info',
    description: 'A node has more than 15 direct children, suggesting it may need sub-grouping.',
  },
  {
    id: 'no_children_domain',
    severity: 'info',
    description: 'A domain or process_group node has no children.',
  },
  {
    id: 'missing_keywords',
    severity: 'info',
    description: 'Active nodes with no keywords defined.',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info']

const SEVERITY_ICONS: Record<Severity, React.ReactNode> = {
  error: <AlertCircle className="w-3.5 h-3.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5" />,
  info: <Info className="w-3.5 h-3.5" />,
}

const SEVERITY_LABELS: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

// ---------------------------------------------------------------------------
// RulesAccordion
// ---------------------------------------------------------------------------

const RulesAccordion: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const byLevel = SEVERITY_ORDER.map((sev) => ({
    sev,
    rules: VALIDATION_RULES.filter((r) => r.severity === sev),
  }))

  return (
    <div className="space-y-2">
      {byLevel.map(({ sev, rules }) => (
        <div key={sev} className="space-y-1">
          <p className="text-2xs font-semibold uppercase tracking-widest text-slate-500 px-1 pt-2">
            {SEVERITY_LABELS[sev]}
          </p>
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="border border-slate-800 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[sev]}`}>
                    {SEVERITY_ICONS[sev]}
                    {SEVERITY_LABELS[sev]}
                  </span>
                  <span className="font-mono text-xs text-slate-300">{rule.id}</span>
                </div>
                {expandedId === rule.id ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                )}
              </button>
              {expandedId === rule.id && (
                <div className="px-4 pb-3 border-t border-slate-800 bg-slate-900/50">
                  <p className="text-sm text-slate-400 pt-2">{rule.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ValidationCenter
// ---------------------------------------------------------------------------

const ValidationCenter: React.FC = () => {
  const { selectedFrameworkId, runValidation, validationLoading, addToast } = useTaxonomyStore()

  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterResolved, setFilterResolved] = useState<string>('open')
  const [searchText, setSearchText] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const loadIssues = useCallback(async () => {
    if (!selectedFrameworkId) return
    setLoading(true)
    try {
      const data = await api.validation.issues(selectedFrameworkId)
      setIssues(data)
    } catch (err) {
      addToast('error', `Failed to load issues: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedFrameworkId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadIssues()
  }, [loadIssues])

  const handleRunValidation = async () => {
    if (!selectedFrameworkId) {
      addToast('warning', 'Select a framework first')
      return
    }
    await runValidation(selectedFrameworkId)
    await loadIssues()
  }

  const handleResolve = async (issueId: string) => {
    setResolvingId(issueId)
    try {
      await api.validation.resolve(issueId)
      addToast('success', 'Issue marked as resolved')
      await loadIssues()
    } catch (err) {
      addToast('error', `Failed to resolve issue: ${(err as Error).message}`)
    } finally {
      setResolvingId(null)
    }
  }

  // Counts (all issues, not just filtered)
  const errorCount = issues.filter((i) => i.severity === 'error' && !i.is_resolved).length
  const warningCount = issues.filter((i) => i.severity === 'warning' && !i.is_resolved).length
  const infoCount = issues.filter((i) => i.severity === 'info' && !i.is_resolved).length

  // Filtered issues
  const filtered = issues
    .filter((issue) => {
      if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false
      if (filterResolved === 'open' && issue.is_resolved) return false
      if (filterResolved === 'resolved' && !issue.is_resolved) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (
          !(issue.node_code ?? '').toLowerCase().includes(q) &&
          !(issue.node_name ?? '').toLowerCase().includes(q) &&
          !issue.issue_type.toLowerCase().includes(q) &&
          !issue.description.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
    .sort((a, b) => {
      const sa = SEVERITY_ORDER.indexOf(a.severity)
      const sb = SEVERITY_ORDER.indexOf(b.severity)
      if (sa !== sb) return sa - sb
      return a.issue_type.localeCompare(b.issue_type)
    })

  const allResolved = issues.length > 0 && issues.every((i) => i.is_resolved)

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Validation Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {selectedFrameworkId
              ? 'Identify and resolve taxonomy quality issues'
              : 'Select a framework to run validation'}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={handleRunValidation}
          loading={validationLoading}
          disabled={!selectedFrameworkId}
        >
          Run Validation
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Errors"
          value={errorCount}
          icon={<AlertCircle className="w-5 h-5" />}
          color="bg-red-500/20 text-red-400"
        />
        <StatCard
          label="Warnings"
          value={warningCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          label="Info"
          value={infoCount}
          icon={<Info className="w-5 h-5" />}
          color="bg-blue-500/20 text-blue-400"
        />
      </div>

      {/* Issues section */}
      <Card>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Severity filter */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {(['all', 'error', 'warning', 'info'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={[
                  'px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  filterSeverity === s
                    ? 'bg-brand-600/30 text-brand-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
                ].join(' ')}
              >
                {s === 'all' ? 'All Severities' : SEVERITY_LABELS[s as Severity]}
              </button>
            ))}
          </div>

          {/* Resolved filter */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {([
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'resolved', label: 'Resolved' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterResolved(opt.value)}
                className={[
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  filterResolved === opt.value
                    ? 'bg-brand-600/30 text-brand-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-brand-500 placeholder:text-slate-500 transition-colors"
              placeholder="Search issues..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <span className="text-xs text-slate-500 ml-auto">
            {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Issues table / empty state */}
        {loading || validationLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !selectedFrameworkId ? (
          <EmptyState
            icon={<ShieldCheck className="w-7 h-7" />}
            title="No framework selected"
            description="Select a framework from the sidebar to view validation issues."
          />
        ) : allResolved || (issues.length > 0 && filtered.length === 0 && filterResolved === 'open') ? (
          <EmptyState
            icon={<CheckCircle className="w-7 h-7 text-green-400" />}
            title="No validation issues found"
            description="All checks passed. Your taxonomy looks clean!"
          />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="w-7 h-7" />}
            title="No issues loaded"
            description="Click Run Validation to check your taxonomy for issues."
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleRunValidation}
                loading={validationLoading}
              >
                Run Validation
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="No matching issues"
            description="Try adjusting the filters or search text."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left font-medium py-2 px-3 w-24">Severity</th>
                  <th className="text-left font-medium py-2 px-3 w-44">Issue Type</th>
                  <th className="text-left font-medium py-2 px-3 w-28">Node Code</th>
                  <th className="text-left font-medium py-2 px-3 w-36">Node Name</th>
                  <th className="text-left font-medium py-2 px-3">Description</th>
                  <th className="text-left font-medium py-2 px-3">Suggested Fix</th>
                  <th className="text-left font-medium py-2 px-3 w-24">Status</th>
                  <th className="text-left font-medium py-2 px-3 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((issue) => (
                  <tr
                    key={issue.id}
                    className={[
                      'border-b border-slate-800/50 transition-colors',
                      issue.is_resolved ? 'opacity-50' : 'hover:bg-slate-800/20',
                    ].join(' ')}
                  >
                    <td className="py-2.5 px-3">
                      <Badge
                        label={SEVERITY_LABELS[issue.severity]}
                        className={SEVERITY_COLORS[issue.severity]}
                        dot
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-slate-300">
                        {issue.issue_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-slate-300">
                        {issue.node_code ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[140px] truncate">
                      {issue.node_name ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[220px]">
                      <span className="line-clamp-2">{issue.description}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[200px]">
                      <span className="line-clamp-2">{issue.suggested_fix ?? '—'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {issue.is_resolved ? (
                        <Badge
                          label="Resolved"
                          className="bg-green-500/20 text-green-400 border-green-500/30"
                          dot
                        />
                      ) : (
                        <Badge
                          label="Open"
                          className="bg-slate-500/20 text-slate-400 border-slate-500/30"
                          dot
                        />
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {!issue.is_resolved && (
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<CheckSquare className="w-3 h-3" />}
                          onClick={() => handleResolve(issue.id)}
                          loading={resolvingId === issue.id}
                          disabled={!!resolvingId}
                        >
                          Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Validation Rules Reference */}
      <Card title="Validation Rules Reference">
        <p className="text-sm text-slate-400 mb-4">
          Complete list of validation rules, their severity levels, and what they check for.
        </p>
        <RulesAccordion />
      </Card>
    </div>
  )
}

export default ValidationCenter
