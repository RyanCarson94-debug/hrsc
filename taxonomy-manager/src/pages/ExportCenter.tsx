import React, { useEffect, useCallback, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  Table,
  BarChart3,
  ShieldCheck,
  Clock,
  Layers,
  RefreshCw,
  FileDown,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTaxonomyStore } from '@/store'
import { generateExcelExport, generateImportTemplate } from '@/lib/export'
import { downloadBlob, fmtDateTime } from '@/lib/utils'
import { Button, Badge, Card, Spinner, EmptyState } from '@/components/ui'
import type { ExportJob } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JOB_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  preview: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

// Description of sheets included in the export
const EXPORT_SHEETS = [
  {
    icon: <Table className="w-4 h-4" />,
    name: 'Framework Summary',
    description: 'High-level framework metadata: name, type, status, node counts, export date.',
  },
  {
    icon: <Layers className="w-4 h-4" />,
    name: 'Taxonomy Nodes',
    description: 'Full flat export of all nodes with every field including governance metadata.',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    name: 'Hierarchy View',
    description: 'Indented display of the taxonomy tree showing parent-child relationships.',
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    name: 'Validation Issues',
    description: 'All open and resolved validation issues with severity and suggested fixes.',
  },
  {
    icon: <Clock className="w-4 h-4" />,
    name: 'Change Log',
    description: 'Complete audit trail of all changes, by whom, and when.',
  },
  {
    icon: <FileSpreadsheet className="w-4 h-4" />,
    name: 'Metadata Lists',
    description: 'Reference lists of node types, statuses, and severity values.',
  },
]

// ---------------------------------------------------------------------------
// ExportCenter
// ---------------------------------------------------------------------------

const ExportCenter: React.FC = () => {
  const { selectedFrameworkId, frameworks, addToast } = useTaxonomyStore()

  const [exporting, setExporting] = useState(false)
  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)

  const selectedFramework = frameworks.find((f) => f.id === selectedFrameworkId)

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const data = await api.export.jobs(selectedFrameworkId ?? undefined)
      setJobs(data)
    } catch (err) {
      addToast('error', `Failed to load export history: ${(err as Error).message}`)
    } finally {
      setJobsLoading(false)
    }
  }, [selectedFrameworkId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const handleExport = async () => {
    if (!selectedFrameworkId || !selectedFramework) {
      addToast('warning', 'Select a framework first')
      return
    }
    setExporting(true)
    try {
      const data = await api.export.generate(selectedFrameworkId)
      const blob = generateExcelExport(data)
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const safeName = selectedFramework.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40)
      downloadBlob(blob, `taxonomy_export_${safeName}_${date}.xlsx`)
      addToast('success', `Exported "${selectedFramework.name}" successfully`)
      await loadJobs()
    } catch (err) {
      addToast('error', `Export failed: ${(err as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const blob = generateImportTemplate()
    downloadBlob(blob, 'taxonomy_import_template.xlsx')
    addToast('success', 'Import template downloaded')
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Export Center</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Export your taxonomy data to Excel or download an import template
        </p>
      </div>

      {/* Section 1: Export Framework */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center flex-shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-200 mb-1">
              Export Framework to Excel
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Generates a multi-sheet Excel workbook containing everything you need for review,
              distribution, or archiving. Includes 6 sheets:
            </p>

            {/* Sheet list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {EXPORT_SHEETS.map((sheet) => (
                <div
                  key={sheet.name}
                  className="flex items-start gap-3 bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50"
                >
                  <span className="text-slate-400 flex-shrink-0 mt-0.5">{sheet.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-300">{sheet.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sheet.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Framework selector + export button */}
            {!selectedFrameworkId ? (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                <span className="text-amber-400 text-sm">
                  Select a framework from the sidebar to enable export.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200">
                    {selectedFramework?.name}
                  </span>
                  <Badge
                    label={selectedFramework?.status ?? ''}
                    className={
                      selectedFramework?.status === 'active'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : selectedFramework?.status === 'archived'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    }
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  icon={
                    exporting ? (
                      <Spinner size="sm" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )
                  }
                  onClick={handleExport}
                  loading={exporting}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting…' : 'Export Now'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Section 2: Import Template */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-200 mb-1">
              Download Import Template
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Get a blank Excel import template pre-formatted with all required columns, an
              example data row, and a separate Instructions sheet explaining each field.
            </p>
            <Button
              variant="secondary"
              size="md"
              icon={<Download className="w-4 h-4" />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
          </div>
        </div>
      </Card>

      {/* Section 3: Export History */}
      <Card
        title="Export History"
        action={
          <Button
            variant="ghost"
            size="xs"
            icon={<RefreshCw className="w-3 h-3" />}
            onClick={loadJobs}
            loading={jobsLoading}
          >
            Refresh
          </Button>
        }
      >
        {jobsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Download className="w-6 h-6" />}
            title="No export jobs yet"
            description="Export a framework to see history here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left font-medium py-2 px-3">Date</th>
                  <th className="text-left font-medium py-2 px-3">Framework</th>
                  <th className="text-left font-medium py-2 px-3">Type</th>
                  <th className="text-left font-medium py-2 px-3">Filename</th>
                  <th className="text-left font-medium py-2 px-3">Status</th>
                  <th className="text-right font-medium py-2 px-3">Nodes</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const fw = frameworks.find((f) => f.id === job.framework_id)
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {fmtDateTime(job.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-[160px] truncate">
                        {fw?.name ?? job.framework_id ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 capitalize">
                        {job.export_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 max-w-[200px] truncate">
                        {job.filename ?? '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          label={job.status}
                          className={
                            JOB_STATUS_COLORS[job.status] ??
                            'bg-slate-700 text-slate-300 border-slate-600'
                          }
                          dot
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {job.node_count}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default ExportCenter
