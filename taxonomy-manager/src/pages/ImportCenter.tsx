import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  LayoutGrid,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTaxonomyStore } from '@/store'
import { generateImportTemplate, parseImportFile, type ParsedImportRow } from '@/lib/export'
import { downloadBlob, fmtDateTime } from '@/lib/utils'
import { Button, Badge, Card, Spinner } from '@/components/ui'
import type { ImportJob, ImportResult } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type WizardStep = 'idle' | 'preview' | 'importing' | 'done'
type ImportMode = 'create' | 'upsert'
type OnDuplicate = 'skip' | 'overwrite' | 'error'

const JOB_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  preview: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

// ---------------------------------------------------------------------------
// DropZone
// ---------------------------------------------------------------------------

interface DropZoneProps {
  onFile: (file: File) => void
}

const DropZone: React.FC<DropZoneProps> = ({ onFile }) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors',
        dragging
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/40 bg-slate-900',
      ].join(' ')}
    >
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
        <Upload className={['w-7 h-7 transition-colors', dragging ? 'text-brand-400' : 'text-slate-400'].join(' ')} />
      </div>
      <div className="text-center">
        <p className="text-slate-200 font-medium">
          Drop XLSX or CSV file here or click to browse
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Supports .xlsx, .xls, .csv files
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImportCenter
// ---------------------------------------------------------------------------

const ImportCenter: React.FC = () => {
  const { selectedFrameworkId, frameworks, addToast } = useTaxonomyStore()

  const [step, setStep] = useState<WizardStep>('idle')
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [mode, setMode] = useState<ImportMode>('upsert')
  const [onDuplicate, setOnDuplicate] = useState<OnDuplicate>('skip')
  const [targetFrameworkId, setTargetFrameworkId] = useState(selectedFrameworkId ?? '')

  useEffect(() => {
    if (selectedFrameworkId) setTargetFrameworkId(selectedFrameworkId)
  }, [selectedFrameworkId])

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const data = await api.import.jobs(targetFrameworkId || undefined)
      setJobs(data)
    } catch (err) {
      addToast('error', `Failed to load import history: ${(err as Error).message}`)
    } finally {
      setJobsLoading(false)
    }
  }, [targetFrameworkId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setParsing(true)
    try {
      const rows = await parseImportFile(file)
      setParsedRows(rows)
      setStep('preview')
    } catch (err) {
      addToast('error', `Failed to parse file: ${(err as Error).message}`)
    } finally {
      setParsing(false)
    }
  }

  const handleDownloadTemplate = () => {
    const blob = generateImportTemplate()
    downloadBlob(blob, 'taxonomy_import_template.xlsx')
  }

  const validRows = parsedRows.filter((r) => r._errors.length === 0)
  const errorRows = parsedRows.filter((r) => r._errors.length > 0)

  const handleImport = async () => {
    if (!targetFrameworkId) {
      addToast('error', 'Select a target framework before importing')
      return
    }
    setStep('importing')
    try {
      const payload = {
        nodes: validRows.map((r) => ({
          code: r.code,
          name: r.name,
          description: r.description,
          parent_id: undefined as string | undefined,
          node_type: r.node_type as never,
          status: r.status as never,
          owner: r.owner,
          steward: r.steward,
          approver: r.approver,
          effective_from: r.effective_from,
          effective_to: r.effective_to,
          version_label: r.version_label,
          synonyms: r.synonyms
            ? JSON.stringify(r.synonyms.split(';').map((s) => s.trim()).filter(Boolean))
            : '[]',
          keywords: r.keywords
            ? JSON.stringify(r.keywords.split(';').map((s) => s.trim()).filter(Boolean))
            : '[]',
          region_applicability: r.region_applicability,
          country_applicability: r.country_applicability,
          business_unit_applicability: r.business_unit_applicability,
          notes: r.notes,
          source_reference: r.source_reference,
          sort_order: r.sort_order ? parseInt(r.sort_order, 10) : 0,
        })),
        mode: mode === 'create' ? 'create' : 'upsert',
        filename: fileName,
        on_duplicate: onDuplicate,
      } as Parameters<typeof api.import.submit>[1]

      const result = await api.import.submit(targetFrameworkId, payload)
      setImportResult(result)
      setStep('done')
      await loadJobs()
    } catch (err) {
      addToast('error', `Import failed: ${(err as Error).message}`)
      setStep('preview')
    }
  }

  const handleReset = () => {
    setStep('idle')
    setParsedRows([])
    setFileName('')
    setImportResult(null)
  }

  const frameworkOptions = frameworks.map((f) => ({ value: f.id, label: f.name }))

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Import Center</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Import taxonomy nodes from XLSX or CSV files
        </p>
      </div>

      {/* Import Wizard */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <FileSpreadsheet className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-semibold text-slate-200">Import Wizard</span>
          {step !== 'idle' && (
            <Badge
              label={step === 'done' ? 'Complete' : step === 'importing' ? 'Importing...' : 'Preview'}
              className={
                step === 'done'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : step === 'importing'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }
            />
          )}
        </div>

        {/* Step 1: idle */}
        {step === 'idle' && (
          <div className="space-y-5">
            {/* Framework selector + Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">
                  Target Framework
                </label>
                <select
                  className="appearance-none bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-brand-500 transition-colors"
                  value={targetFrameworkId}
                  onChange={(e) => setTargetFrameworkId(e.target.value)}
                >
                  <option value="">— Select framework —</option>
                  {frameworkOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">Mode</label>
                <select
                  className="appearance-none bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-brand-500 transition-colors"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ImportMode)}
                >
                  <option value="create">Create — only new nodes</option>
                  <option value="upsert">Upsert — create or update by code</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">
                  On Duplicate
                </label>
                <select
                  className="appearance-none bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-brand-500 transition-colors"
                  value={onDuplicate}
                  onChange={(e) => setOnDuplicate(e.target.value as OnDuplicate)}
                >
                  <option value="skip">Skip — leave existing unchanged</option>
                  <option value="overwrite">Overwrite — replace existing</option>
                  <option value="error">Error — abort on duplicate</option>
                </select>
              </div>
            </div>

            {/* Drop zone */}
            {parsing ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Spinner size="lg" />
                <p className="text-sm text-slate-400">Parsing file…</p>
              </div>
            ) : (
              <DropZone onFile={handleFile} />
            )}

            {/* Download template */}
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleDownloadTemplate}
              >
                Download Import Template
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-200">{fileName}</p>
                  <p className="text-xs text-slate-500">{parsedRows.length} rows parsed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  label={`${validRows.length} valid`}
                  className="bg-green-500/20 text-green-400 border-green-500/30"
                  dot
                />
                {errorRows.length > 0 && (
                  <Badge
                    label={`${errorRows.length} with errors`}
                    className="bg-red-500/20 text-red-400 border-red-500/30"
                    dot
                  />
                )}
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-auto max-h-80 border border-slate-800 rounded-lg">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="text-left font-medium py-2 px-3 w-10">#</th>
                    <th className="text-left font-medium py-2 px-3 w-28">Code</th>
                    <th className="text-left font-medium py-2 px-3 w-44">Name</th>
                    <th className="text-left font-medium py-2 px-3 w-28">Parent Code</th>
                    <th className="text-left font-medium py-2 px-3 w-32">Type</th>
                    <th className="text-left font-medium py-2 px-3 w-20">Status</th>
                    <th className="text-left font-medium py-2 px-3">Owner</th>
                    <th className="text-left font-medium py-2 px-3 w-20">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((row) => (
                    <tr
                      key={row._row}
                      className={[
                        'border-b border-slate-800/50 transition-colors',
                        row._errors.length > 0
                          ? 'bg-red-500/5 hover:bg-red-500/10'
                          : 'hover:bg-slate-800/30',
                      ].join(' ')}
                    >
                      <td className="py-2 px-3 text-slate-500">{row._row}</td>
                      <td className="py-2 px-3 font-mono text-slate-300">{row.code || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="py-2 px-3 text-slate-200 truncate max-w-[170px]">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{row.parent_code ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{row.node_type ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{row.status ?? 'draft'}</td>
                      <td className="py-2 px-3 text-slate-500 truncate">{row.owner ?? '—'}</td>
                      <td className="py-2 px-3">
                        {row._errors.length > 0 ? (
                          <span title={row._errors.join('\n')} className="flex items-center gap-1 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {row._errors.length}
                          </span>
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 20 && (
                <p className="text-center text-xs text-slate-500 py-2 border-t border-slate-800">
                  Showing first 20 of {parsedRows.length} rows
                </p>
              )}
            </div>

            {/* Error detail */}
            {errorRows.length > 0 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {errorRows.length} row{errorRows.length !== 1 ? 's' : ''} with errors (will be skipped)
                </p>
                <ul className="space-y-1">
                  {errorRows.map((row) => (
                    <li key={row._row} className="text-xs text-red-300">
                      Row {row._row}: {row._errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
                onClick={handleReset}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={handleImport}
                disabled={validRows.length === 0 || !targetFrameworkId}
              >
                Import {validRows.length} Row{validRows.length !== 1 ? 's' : ''}
              </Button>
              {!targetFrameworkId && (
                <p className="text-xs text-amber-400">Select a target framework first</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <Spinner size="lg" />
            <p className="text-slate-300 font-medium">Importing {validRows.length} nodes…</p>
            <p className="text-sm text-slate-500">This may take a moment.</p>
          </div>
        )}

        {/* Step 4: done */}
        {step === 'done' && importResult && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-300">{importResult.imported}</p>
                  <p className="text-xs text-green-400/80">Imported</p>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex items-center gap-3">
                <Eye className="w-8 h-8 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-300">{importResult.skipped}</p>
                  <p className="text-xs text-amber-400/80">Skipped</p>
                </div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex items-center gap-3">
                <X className="w-8 h-8 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-300">{importResult.errors.length}</p>
                  <p className="text-xs text-red-400/80">Errors</p>
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-xs font-semibold text-red-400 mb-2">Import errors</p>
                <ul className="space-y-1">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-300">
                      Row {e.row}{e.code ? ` (${e.code})` : ''}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={handleReset}
              >
                Import Another File
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<LayoutGrid className="w-3.5 h-3.5" />}
                onClick={() => window.location.hash = '#/frameworks'}
              >
                View Framework
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Import History */}
      <Card
        title="Import History"
        action={
          <Button
            variant="ghost"
            size="xs"
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
          <p className="text-sm text-slate-500 py-4 text-center">No import jobs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left font-medium py-2 px-3">Date</th>
                  <th className="text-left font-medium py-2 px-3">Filename</th>
                  <th className="text-left font-medium py-2 px-3">Framework</th>
                  <th className="text-left font-medium py-2 px-3">Status</th>
                  <th className="text-right font-medium py-2 px-3">Imported</th>
                  <th className="text-right font-medium py-2 px-3">Skipped</th>
                  <th className="text-right font-medium py-2 px-3">Errors</th>
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
                      <td className="py-2.5 px-3 text-slate-300 max-w-[180px] truncate font-mono">
                        {job.filename ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[140px] truncate">
                        {fw?.name ?? job.framework_id ?? '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          label={job.status}
                          className={JOB_STATUS_COLORS[job.status] ?? 'bg-slate-700 text-slate-300 border-slate-600'}
                          dot
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right text-green-400 font-mono">
                        {job.imported_count}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-400 font-mono">
                        {job.skipped_count}
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-400 font-mono">
                        {job.error_count}
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

export default ImportCenter
