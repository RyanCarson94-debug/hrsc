import React, { useEffect, useState, useCallback } from 'react'
import {
  Camera,
  GitCompare,
  RotateCcw,
  Eye,
  Plus,
  Minus,
  Edit2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GitBranch,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTaxonomyStore } from '@/store'
import { Button, Badge, Card, Modal, Spinner, EmptyState, Input, Textarea } from '@/components/ui'
import { fmtDateTime } from '@/lib/utils'
import type { Snapshot, SnapshotCompare, TaxonomyNode } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SnapshotNode {
  code: string
  name: string
  node_type: string
  status: string
}

function parseSnapshotNodes(snapshotData: string | undefined): SnapshotNode[] {
  if (!snapshotData) return []
  try {
    const parsed = JSON.parse(snapshotData) as TaxonomyNode[]
    return parsed.map((n) => ({
      code: n.code,
      name: n.name,
      node_type: n.node_type,
      status: n.status,
    }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// CompareSection
// ---------------------------------------------------------------------------

interface CompareSectionProps<T> {
  title: string
  icon: React.ReactNode
  color: string
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
}

function CompareSection<T>({ title, icon, color, items, renderItem }: CompareSectionProps<T>) {
  const [expanded, setExpanded] = useState(items.length <= 10)

  if (items.length === 0) return null

  return (
    <div className={`border rounded-lg overflow-hidden ${color}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-90 transition-opacity"
      >
        <span className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
          <span className="text-xs opacity-70">({items.length})</span>
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 opacity-60" />
        ) : (
          <ChevronRight className="w-4 h-4 opacity-60" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-current border-opacity-20">
          <div className="max-h-64 overflow-y-auto divide-y divide-current divide-opacity-10">
            {items.map((item, i) => renderItem(item, i))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VersionManager
// ---------------------------------------------------------------------------

const VersionManager: React.FC = () => {
  const { selectedFrameworkId, addToast } = useTaxonomyStore()

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    version_label: '',
    snapshot_notes: '',
    created_by: '',
  })
  const [creating, setCreating] = useState(false)

  // Details modal
  const [detailsSnapshot, setDetailsSnapshot] = useState<Snapshot | null>(null)
  const [detailsFull, setDetailsFull] = useState<Snapshot | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Compare
  const [compareA, setCompareA] = useState<string | null>(null)
  const [compareB, setCompareB] = useState<string | null>(null)
  const [compareResult, setCompareResult] = useState<SnapshotCompare | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // Restore
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoreSnapshot, setRestoreSnapshot] = useState<Snapshot | null>(null)
  const [restoreNote, setRestoreNote] = useState('')
  const [restoring, setRestoring] = useState(false)

  const loadSnapshots = useCallback(async () => {
    if (!selectedFrameworkId) return
    setLoading(true)
    try {
      const data = await api.snapshots.list(selectedFrameworkId)
      setSnapshots(data)
    } catch (err) {
      addToast('error', `Failed to load snapshots: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedFrameworkId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const handleCreate = async () => {
    if (!selectedFrameworkId) {
      addToast('warning', 'Select a framework first')
      return
    }
    if (!createForm.version_label.trim()) {
      addToast('error', 'Version label is required')
      return
    }
    setCreating(true)
    try {
      await api.snapshots.create(selectedFrameworkId, {
        version_label: createForm.version_label.trim(),
        snapshot_notes: createForm.snapshot_notes || undefined,
        created_by: createForm.created_by || undefined,
      })
      addToast('success', `Snapshot "${createForm.version_label}" created`)
      setShowCreateModal(false)
      setCreateForm({ version_label: '', snapshot_notes: '', created_by: '' })
      await loadSnapshots()
    } catch (err) {
      addToast('error', `Failed to create snapshot: ${(err as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleViewDetails = async (snapshot: Snapshot) => {
    setDetailsSnapshot(snapshot)
    setDetailsFull(null)
    setDetailsLoading(true)
    try {
      const full = await api.snapshots.get(snapshot.id)
      setDetailsFull(full)
    } catch (err) {
      addToast('error', `Failed to load snapshot details: ${(err as Error).message}`)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleSelectCompare = (id: string) => {
    if (compareA === id) {
      setCompareA(null)
      setCompareResult(null)
    } else if (compareB === id) {
      setCompareB(null)
      setCompareResult(null)
    } else if (!compareA) {
      setCompareA(id)
      setCompareResult(null)
    } else if (!compareB) {
      setCompareB(id)
    } else {
      // Replace B
      setCompareB(id)
      setCompareResult(null)
    }
  }

  const handleRunCompare = async () => {
    if (!compareA || !compareB) return
    setCompareLoading(true)
    try {
      const result = await api.snapshots.compare({
        snapshot_id_a: compareA,
        snapshot_id_b: compareB,
      })
      setCompareResult(result)
    } catch (err) {
      addToast('error', `Comparison failed: ${(err as Error).message}`)
    } finally {
      setCompareLoading(false)
    }
  }

  const handleRestoreClick = (snapshot: Snapshot) => {
    setRestoreSnapshot(snapshot)
    setRestoreNote('')
    setShowRestoreConfirm(true)
  }

  const handleRestoreConfirm = async () => {
    if (!restoreSnapshot) return
    setRestoring(true)
    try {
      const result = await api.snapshots.restore(restoreSnapshot.id, {
        change_note: restoreNote || undefined,
      })
      addToast('success', `Restored "${restoreSnapshot.version_label}" — ${result.node_count} nodes`)
      setShowRestoreConfirm(false)
      setRestoreSnapshot(null)
    } catch (err) {
      addToast('error', `Restore failed: ${(err as Error).message}`)
    } finally {
      setRestoring(false)
    }
  }

  const snapA = snapshots.find((s) => s.id === compareA)
  const snapB = snapshots.find((s) => s.id === compareB)
  const detailNodes = parseSnapshotNodes(detailsFull?.snapshot_data)

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Version Manager</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Create and manage point-in-time snapshots of your taxonomy
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadSnapshots}
            loading={loading}
            disabled={!selectedFrameworkId}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Camera className="w-3.5 h-3.5" />}
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedFrameworkId}
          >
            Create Snapshot
          </Button>
        </div>
      </div>

      {/* No framework selected */}
      {!selectedFrameworkId && (
        <Card>
          <EmptyState
            icon={<GitBranch className="w-7 h-7" />}
            title="No framework selected"
            description="Select a framework from the sidebar to manage its version snapshots."
          />
        </Card>
      )}

      {/* Compare Panel */}
      {selectedFrameworkId && snapshots.length >= 2 && (
        <Card title="Compare Snapshots">
          <p className="text-sm text-slate-400 mb-4">
            Select two snapshots to compare their differences.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12">From:</span>
              {compareA ? (
                <Badge
                  label={snapA?.version_label ?? compareA}
                  className="bg-blue-500/20 text-blue-300 border-blue-500/30"
                />
              ) : (
                <span className="text-xs text-slate-600 italic">not selected</span>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12">To:</span>
              {compareB ? (
                <Badge
                  label={snapB?.version_label ?? compareB}
                  className="bg-purple-500/20 text-purple-300 border-purple-500/30"
                />
              ) : (
                <span className="text-xs text-slate-600 italic">not selected</span>
              )}
            </div>
            {compareA && compareB && (
              <Button
                variant="secondary"
                size="sm"
                icon={<GitCompare className="w-3.5 h-3.5" />}
                onClick={handleRunCompare}
                loading={compareLoading}
              >
                Compare
              </Button>
            )}
            {(compareA || compareB) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCompareA(null)
                  setCompareB(null)
                  setCompareResult(null)
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Compare results */}
          {compareLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : compareResult ? (
            <div className="space-y-3">
              {compareResult.added.length > 0 && (
                <CompareSection
                  title="Added"
                  icon={<Plus className="w-4 h-4" />}
                  color="border-green-500/30 bg-green-500/5 text-green-400"
                  items={compareResult.added}
                  renderItem={(node, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <span className="font-mono text-green-300 w-24 flex-shrink-0">{node.code}</span>
                      <span className="text-green-200 truncate">{node.name}</span>
                      <span className="text-green-600 ml-auto flex-shrink-0">{node.node_type}</span>
                    </div>
                  )}
                />
              )}

              {compareResult.removed.length > 0 && (
                <CompareSection
                  title="Removed"
                  icon={<Minus className="w-4 h-4" />}
                  color="border-red-500/30 bg-red-500/5 text-red-400"
                  items={compareResult.removed}
                  renderItem={(node, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <span className="font-mono text-red-300 w-24 flex-shrink-0">{node.code}</span>
                      <span className="text-red-200 truncate">{node.name}</span>
                      <span className="text-red-600 ml-auto flex-shrink-0">{node.node_type}</span>
                    </div>
                  )}
                />
              )}

              {compareResult.modified.length > 0 && (
                <CompareSection
                  title="Modified"
                  icon={<Edit2 className="w-4 h-4" />}
                  color="border-amber-500/30 bg-amber-500/5 text-amber-400"
                  items={compareResult.modified}
                  renderItem={(item, i) => (
                    <div key={i} className="px-4 py-2 text-xs">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-mono text-amber-300 w-24 flex-shrink-0">{item.code}</span>
                        <span className="text-amber-200">{item.name}</span>
                      </div>
                      {Object.entries(item.changes).map(([field, change]) => (
                        <div key={field} className="ml-6 flex items-center gap-2 text-2xs text-amber-600/80 mt-0.5">
                          <span className="text-amber-500 font-medium">{field}:</span>
                          <span className="line-through opacity-60">{String(change.from ?? '—')}</span>
                          <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />
                          <span>{String(change.to ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              )}

              {compareResult.moved.length > 0 && (
                <CompareSection
                  title="Moved"
                  icon={<ArrowRight className="w-4 h-4" />}
                  color="border-blue-500/30 bg-blue-500/5 text-blue-400"
                  items={compareResult.moved}
                  renderItem={(item, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <span className="font-mono text-blue-300 w-24 flex-shrink-0">{item.code}</span>
                      <span className="text-blue-200 truncate">{item.name}</span>
                      <div className="ml-auto flex items-center gap-1.5 text-2xs text-blue-500 flex-shrink-0">
                        <span className="font-mono">{item.old_parent ?? 'root'}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span className="font-mono">{item.new_parent ?? 'root'}</span>
                      </div>
                    </div>
                  )}
                />
              )}

              {compareResult.added.length === 0 &&
                compareResult.removed.length === 0 &&
                compareResult.modified.length === 0 &&
                compareResult.moved.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No differences found between these two snapshots.
                  </p>
                )}
            </div>
          ) : null}
        </Card>
      )}

      {/* Snapshots list */}
      {selectedFrameworkId && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : snapshots.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Camera className="w-7 h-7" />}
                title="No snapshots yet"
                description="Create a snapshot to save the current state of your taxonomy for later comparison or restoration."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Camera className="w-3.5 h-3.5" />}
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Snapshot
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {snapshots.map((snapshot) => {
                const isCompareA = compareA === snapshot.id
                const isCompareB = compareB === snapshot.id
                const isSelectedForCompare = isCompareA || isCompareB

                return (
                  <div
                    key={snapshot.id}
                    className={[
                      'bg-slate-900 border rounded-xl p-5 flex flex-col gap-3 transition-all',
                      isSelectedForCompare
                        ? isCompareA
                          ? 'border-blue-500/50 ring-1 ring-blue-500/30'
                          : 'border-purple-500/50 ring-1 ring-purple-500/30'
                        : 'border-slate-800',
                    ].join(' ')}
                  >
                    {/* Version label */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-bold text-slate-100">
                          {snapshot.version_label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fmtDateTime(snapshot.created_at)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-2xl font-bold text-slate-200">
                          {snapshot.node_count}
                        </p>
                        <p className="text-2xs text-slate-500">nodes</p>
                      </div>
                    </div>

                    {/* Created by */}
                    {snapshot.created_by && (
                      <p className="text-xs text-slate-500">
                        by{' '}
                        <span className="text-slate-400">{snapshot.created_by}</span>
                      </p>
                    )}

                    {/* Notes */}
                    {snapshot.snapshot_notes && (
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {snapshot.snapshot_notes}
                      </p>
                    )}

                    {/* Compare badge */}
                    {isSelectedForCompare && (
                      <Badge
                        label={isCompareA ? 'Compare: From' : 'Compare: To'}
                        className={
                          isCompareA
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }
                      />
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800 mt-auto">
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<Eye className="w-3 h-3" />}
                        onClick={() => handleViewDetails(snapshot)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<GitCompare className="w-3 h-3" />}
                        onClick={() => handleSelectCompare(snapshot.id)}
                        className={isSelectedForCompare ? 'text-brand-400' : ''}
                      >
                        {isSelectedForCompare ? 'Deselect' : 'Compare'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<RotateCcw className="w-3 h-3" />}
                        onClick={() => handleRestoreClick(snapshot)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        Restore
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Create Snapshot Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Snapshot"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Camera className="w-3.5 h-3.5" />}
              onClick={handleCreate}
              loading={creating}
            >
              Create Snapshot
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Version Label *"
            value={createForm.version_label}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, version_label: e.target.value }))
            }
            placeholder="e.g. v1.2, Pre-Restructure-2025, Q2-Approved"
          />
          <Textarea
            label="Notes"
            value={createForm.snapshot_notes}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, snapshot_notes: e.target.value }))
            }
            placeholder="Describe what this snapshot represents or why it was taken"
            rows={3}
          />
          <Input
            label="Created By"
            value={createForm.created_by}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, created_by: e.target.value }))
            }
            placeholder="Your name or initials"
          />
        </div>
      </Modal>

      {/* Snapshot Details Modal */}
      <Modal
        open={!!detailsSnapshot}
        onClose={() => { setDetailsSnapshot(null); setDetailsFull(null) }}
        title={`Snapshot — ${detailsSnapshot?.version_label ?? ''}`}
        size="lg"
      >
        {detailsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xs text-slate-500 uppercase tracking-wide font-medium">
                  Created
                </p>
                <p className="text-sm text-slate-200 mt-0.5">
                  {fmtDateTime(detailsSnapshot?.created_at)}
                </p>
              </div>
              <div>
                <p className="text-2xs text-slate-500 uppercase tracking-wide font-medium">
                  Node Count
                </p>
                <p className="text-sm text-slate-200 mt-0.5">
                  {detailsSnapshot?.node_count}
                </p>
              </div>
              {detailsSnapshot?.created_by && (
                <div>
                  <p className="text-2xs text-slate-500 uppercase tracking-wide font-medium">
                    Created By
                  </p>
                  <p className="text-sm text-slate-200 mt-0.5">
                    {detailsSnapshot.created_by}
                  </p>
                </div>
              )}
              {detailsSnapshot?.snapshot_notes && (
                <div className="col-span-2">
                  <p className="text-2xs text-slate-500 uppercase tracking-wide font-medium">
                    Notes
                  </p>
                  <p className="text-sm text-slate-300 mt-0.5">
                    {detailsSnapshot.snapshot_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Node list */}
            {detailNodes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">
                  Nodes in this snapshot
                </p>
                <div className="overflow-auto max-h-72 border border-slate-800 rounded-lg">
                  <table className="w-full text-xs min-w-[400px]">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="text-left font-medium py-2 px-3">Code</th>
                        <th className="text-left font-medium py-2 px-3">Name</th>
                        <th className="text-left font-medium py-2 px-3">Type</th>
                        <th className="text-left font-medium py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailNodes.map((node, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                        >
                          <td className="py-2 px-3 font-mono text-slate-300">{node.code}</td>
                          <td className="py-2 px-3 text-slate-200 max-w-[200px] truncate">
                            {node.name}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{node.node_type}</td>
                          <td className="py-2 px-3">
                            <Badge
                              label={node.status}
                              className={
                                node.status === 'active'
                                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                  : node.status === 'retired'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                              }
                              dot
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Restore Confirm Modal */}
      <Modal
        open={showRestoreConfirm}
        onClose={() => {
          if (!restoring) {
            setShowRestoreConfirm(false)
            setRestoreSnapshot(null)
          }
        }}
        title="Restore Snapshot"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRestoreConfirm(false)
                setRestoreSnapshot(null)
              }}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleRestoreConfirm}
              loading={restoring}
            >
              Restore
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-300">
              <p className="font-medium mb-1">Warning: Destructive Operation</p>
              <p>
                This will replace <strong>all current nodes</strong> in this framework with the
                nodes from snapshot{' '}
                <span className="font-mono font-semibold">
                  {restoreSnapshot?.version_label}
                </span>
                . This action cannot be undone.
              </p>
            </div>
          </div>

          {restoreSnapshot && (
            <div className="bg-slate-800/60 rounded-lg px-4 py-3 text-xs text-slate-400">
              <span className="text-slate-300 font-medium">{restoreSnapshot.version_label}</span>
              {' · '}
              {restoreSnapshot.node_count} nodes
              {' · '}
              {fmtDateTime(restoreSnapshot.created_at)}
            </div>
          )}

          <Input
            label="Change Note (optional)"
            value={restoreNote}
            onChange={(e) => setRestoreNote(e.target.value)}
            placeholder="Reason for restore"
          />
        </div>
      </Modal>
    </div>
  )
}

export default VersionManager
