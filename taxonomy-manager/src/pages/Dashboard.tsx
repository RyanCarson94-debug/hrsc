import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Download,
  Camera,
  Zap,
  User,
  FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTaxonomyStore } from '@/store'
import { Card, StatCard, Badge, Button, Spinner } from '@/components/ui'
import { fmtDateTime, timeAgo, pluralize } from '@/lib/utils'
import type { DashboardStats } from '@/types'
import { SEVERITY_COLORS, STATUS_COLORS } from '@/types'

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-800 animate-pulse rounded ${className}`} />
)

const StatCardSkeleton: React.FC = () => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4">
    <SkeletonBox className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <SkeletonBox className="h-7 w-20" />
      <SkeletonBox className="h-3 w-28" />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { selectedFrameworkId, frameworks, runValidation, addToast } = useTaxonomyStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [seedLoading, setSeedLoading] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .dashboard(selectedFrameworkId ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setStats(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          addToast('error', `Failed to load dashboard: ${(err as Error).message}`)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedFrameworkId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedFramework = frameworks.find((f) => f.id === selectedFrameworkId)

  const handleRunValidation = async () => {
    if (!selectedFrameworkId) {
      addToast('warning', 'Select a framework first')
      return
    }
    await runValidation(selectedFrameworkId)
    navigate('/validation')
  }

  const handleExport = async () => {
    if (!selectedFrameworkId) {
      addToast('warning', 'Select a framework first')
      return
    }
    setExportLoading(true)
    try {
      navigate('/export')
    } finally {
      setExportLoading(false)
    }
  }

  const handleCreateSnapshot = async () => {
    if (!selectedFrameworkId) {
      addToast('warning', 'Select a framework first')
      return
    }
    setSnapshotLoading(true)
    try {
      navigate('/versions')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const handleLoadDemo = async () => {
    setSeedLoading(true)
    try {
      const result = await api.seed()
      addToast('success', `Demo data loaded — ${result.node_count} nodes created`)
      // Reload dashboard
      const data = await api.dashboard(result.framework_id)
      setStats(data)
    } catch (err) {
      addToast('error', `Failed to load demo data: ${(err as Error).message}`)
    } finally {
      setSeedLoading(false)
    }
  }

  // Compute max for bar chart
  const nodesByType = stats?.nodes_by_type ?? {}
  const typeEntries = Object.entries(nodesByType).sort((a, b) => b[1] - a[1])
  const maxTypeCount = Math.max(...typeEntries.map(([, v]) => v), 1)

  const issuesBySeverity = stats?.unresolved_issues_by_severity ?? { error: 0, warning: 0, info: 0 }
  const recentChanges = stats?.recent_changes ?? []

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          HR Taxonomy Manager
          {selectedFramework && (
            <span className="ml-2 text-slate-500">
              — {selectedFramework.name}
            </span>
          )}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          onClick={handleRunValidation}
        >
          Run Validation
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-3.5 h-3.5" />}
          onClick={handleExport}
          loading={exportLoading}
        >
          Export Framework
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Camera className="w-3.5 h-3.5" />}
          onClick={handleCreateSnapshot}
          loading={snapshotLoading}
        >
          Create Snapshot
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Zap className="w-3.5 h-3.5" />}
          onClick={handleLoadDemo}
          loading={seedLoading}
        >
          Load Demo Data
        </Button>
      </div>

      {/* Row 1 — Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Frameworks"
            value={stats?.total_frameworks ?? 0}
            icon={<Database className="w-5 h-5" />}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatCard
            label="Total Nodes"
            value={stats?.total_nodes ?? 0}
            icon={<GitBranch className="w-5 h-5" />}
            color="bg-violet-500/20 text-violet-400"
          />
          <StatCard
            label="Active Nodes"
            value={stats?.nodes_by_status?.active ?? 0}
            icon={<CheckCircle className="w-5 h-5" />}
            color="bg-green-500/20 text-green-400"
            trend={
              stats
                ? `${stats.nodes_by_status.draft} draft · ${stats.nodes_by_status.retired} retired`
                : undefined
            }
          />
          <StatCard
            label="Open Issues"
            value={issuesBySeverity.error + issuesBySeverity.warning + issuesBySeverity.info}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="bg-amber-500/20 text-amber-400"
            trend={
              `${issuesBySeverity.error} error · ${issuesBySeverity.warning} warning`
            }
          />
        </div>
      )}

      {/* Row 2 — Nodes by Type + Issues by Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Nodes by Type — 60% (3/5) */}
        <Card
          title="Nodes by Type"
          className="lg:col-span-3"
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonBox className="w-28 h-3" />
                  <SkeletonBox className="h-3 flex-1" />
                  <SkeletonBox className="w-8 h-3" />
                </div>
              ))}
            </div>
          ) : typeEntries.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No data</p>
          ) : (
            <div className="space-y-2.5">
              {typeEntries.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-slate-400 truncate flex-shrink-0 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-brand-600/60 rounded-full transition-all"
                      style={{ width: `${(count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-slate-300 flex-shrink-0">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Issues by Severity — 40% (2/5) */}
        <Card title="Issues by Severity" className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBox key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(
                [
                  { key: 'error', label: 'Errors', color: SEVERITY_COLORS.error, icon: '✕' },
                  { key: 'warning', label: 'Warnings', color: SEVERITY_COLORS.warning, icon: '⚠' },
                  { key: 'info', label: 'Info', color: SEVERITY_COLORS.info, icon: 'ℹ' },
                ] as const
              ).map(({ key, label, color, icon }) => (
                <button
                  key={key}
                  onClick={() => navigate('/validation')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-opacity hover:opacity-80 ${color}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-base leading-none">{icon}</span>
                    {label}
                  </span>
                  <span className="text-lg font-bold tabular-nums">
                    {issuesBySeverity[key]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3 — Recent Changes + Missing Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent Changes — 60% */}
        <Card title="Recent Changes" className="lg:col-span-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBox key={i} className="h-9 rounded" />
              ))}
            </div>
          ) : recentChanges.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No recent changes</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left font-medium py-2 px-2 whitespace-nowrap">Date</th>
                    <th className="text-left font-medium py-2 px-2 whitespace-nowrap">Node</th>
                    <th className="text-left font-medium py-2 px-2 whitespace-nowrap">Action</th>
                    <th className="text-left font-medium py-2 px-2 whitespace-nowrap">Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentChanges.slice(0, 10).map((change) => (
                    <tr
                      key={change.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                        <span title={fmtDateTime(change.changed_at)}>
                          {timeAgo(change.changed_at)}
                        </span>
                      </td>
                      <td className="py-2 px-2 max-w-[120px]">
                        <span className="font-mono text-slate-300 truncate block">
                          {change.node_code ?? '—'}
                        </span>
                        {change.node_name && (
                          <span className="text-slate-500 truncate block">{change.node_name}</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <Badge
                          label={change.action_type.replace(/_/g, ' ')}
                          className="bg-slate-700/50 text-slate-300 border-slate-700 text-2xs"
                        />
                      </td>
                      <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                        {change.changed_by}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Missing Governance — 40% */}
        <Card title="Missing Governance" className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              <SkeletonBox className="h-20 rounded-lg" />
              <SkeletonBox className="h-20 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => navigate('/validation')}
                className="w-full flex items-start gap-3 p-4 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100 leading-tight">
                    {stats?.nodes_missing_owner ?? 0}
                  </p>
                  <p className="text-xs text-slate-400">
                    {pluralize(stats?.nodes_missing_owner ?? 0, 'node')} missing owner
                  </p>
                  <p className="text-2xs text-brand-400 group-hover:text-brand-300 mt-1 transition-colors">
                    View in Validation →
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate('/validation')}
                className="w-full flex items-start gap-3 p-4 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100 leading-tight">
                    {stats?.nodes_missing_description ?? 0}
                  </p>
                  <p className="text-xs text-slate-400">
                    {pluralize(stats?.nodes_missing_description ?? 0, 'node')} missing description
                  </p>
                  <p className="text-2xs text-brand-400 group-hover:text-brand-300 mt-1 transition-colors">
                    View in Validation →
                  </p>
                </div>
              </button>

              {/* Status breakdown */}
              {stats && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">Node Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {(
                      [
                        { key: 'active', label: 'Active' },
                        { key: 'draft', label: 'Draft' },
                        { key: 'retired', label: 'Retired' },
                      ] as const
                    ).map(({ key, label }) => (
                      <Badge
                        key={key}
                        label={`${stats.nodes_by_status[key]} ${label}`}
                        className={STATUS_COLORS[key]}
                        dot
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
