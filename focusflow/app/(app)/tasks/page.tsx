'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, effortVariant, effortLabel, bucketVariant, bucketLabel } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'

type Bucket = 'NOW' | 'SOON' | 'LATER'
type Effort = 'LOW' | 'MEDIUM' | 'HIGH'

interface TaskStep {
  id: string
  title: string
  completed: boolean
}

interface Task {
  id: string
  title: string
  bucket: Bucket
  effort: Effort
  durationMins: number
  status: string
  resistanceCount: number
  steps: TaskStep[]
}

const BUCKETS: { key: Bucket; label: string; maxCount?: number; hint?: string }[] = [
  { key: 'NOW', label: 'Now', maxCount: 3, hint: 'Up to 3 — what you are doing today' },
  { key: 'SOON', label: 'Soon', hint: 'Coming up this week' },
  { key: 'LATER', label: 'Later', hint: 'On the radar, not urgent' },
]

function TaskCard({
  task,
  onMove,
  onStart,
  onComplete,
  onDelete,
}: {
  task: Task
  onMove: (id: string, bucket: Bucket) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const doneSteps = task.steps.filter((s) => s.completed).length
  const totalSteps = task.steps.length

  return (
    <div className={`card p-4 group ${task.resistanceCount >= 2 ? 'border-amber-200' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Complete checkbox */}
        <button
          onClick={() => onComplete(task.id)}
          className="mt-0.5 w-4.5 h-4.5 rounded border-2 border-border hover:border-primary flex-shrink-0 transition-colors flex items-center justify-center"
          aria-label="Mark complete"
          style={{ width: 18, height: 18 }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-0 group-hover:opacity-30">
            <path d="M2 6l3 3 5-5" stroke="#5B6CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/tasks/${task.id}`}
              className="font-medium text-text text-sm leading-snug hover:text-primary transition-colors"
            >
              {task.title}
            </Link>

            {/* Actions menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-text-subtle hover:text-text-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Task actions"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-6 z-20 bg-white rounded-lg shadow-modal border border-border py-1 min-w-[140px]">
                    <button
                      onClick={() => { onStart(task.id); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-gray-50"
                    >
                      Start session
                    </button>
                    {task.bucket !== 'NOW' && (
                      <button
                        onClick={() => { onMove(task.id, 'NOW'); setMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-text hover:bg-gray-50"
                      >
                        Move to Now
                      </button>
                    )}
                    {task.bucket !== 'SOON' && (
                      <button
                        onClick={() => { onMove(task.id, 'SOON'); setMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-text hover:bg-gray-50"
                      >
                        Move to Soon
                      </button>
                    )}
                    {task.bucket !== 'LATER' && (
                      <button
                        onClick={() => { onMove(task.id, 'LATER'); setMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-text hover:bg-gray-50"
                      >
                        Move to Later
                      </button>
                    )}
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { onDelete(task.id); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Badge variant={effortVariant(task.effort)}>{effortLabel(task.effort)}</Badge>
            <Badge variant="neutral">{task.durationMins}m</Badge>
            {task.resistanceCount >= 2 && (
              <Badge variant="effort-medium">Resisted</Badge>
            )}
          </div>

          {totalSteps > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(doneSteps / totalSteps) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-text-subtle">{doneSteps}/{totalSteps}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?status=ACTIVE')
      const data = await res.json()
      setTasks(data)
    } catch {
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  async function handleMove(taskId: string, bucket: Bucket) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)))
    } else {
      const data = await res.json()
      alert(data.error || 'Could not move task')
    }
  }

  async function handleStart(taskId: string) {
    const res = await fetch('/api/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    })
    if (res.ok) {
      const session = await res.json()
      router.push(`/focus/${session.taskId}?session=${session.id}`)
    }
  }

  async function handleComplete(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function handleDelete(taskId: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const byBucket = (bucket: Bucket) => tasks.filter((t) => t.bucket === bucket)

  if (loading) {
    return (
      <div className="page-container space-y-8">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="h-4 bg-gray-100 rounded w-16 mb-3 animate-pulse" />
            <div className="space-y-2">
              <div className="card p-4 h-16 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-text">Tasks</h1>
        <Link href="/tasks/new" className="btn-primary flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Add task
        </Link>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="space-y-8">
        {BUCKETS.map(({ key, label, maxCount, hint }) => {
          const bucketTasks = byBucket(key)
          const atMax = maxCount && bucketTasks.length >= maxCount

          return (
            <section key={key} aria-label={`${label} tasks`}>
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="font-semibold text-text">{label}</h2>
                {bucketTasks.length > 0 && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    key === 'NOW' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-text-muted'
                  }`}>
                    {bucketTasks.length}{maxCount ? `/${maxCount}` : ''}
                  </span>
                )}
                <span className="text-xs text-text-subtle">{hint}</span>
              </div>

              {atMax && (
                <p className="text-xs text-text-muted bg-primary-light/50 px-3 py-1.5 rounded mb-3">
                  Now is full — complete or move a task before adding more here.
                </p>
              )}

              {bucketTasks.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg py-6 text-center">
                  <p className="text-text-subtle text-sm">
                    {key === 'NOW'
                      ? 'Nothing here — move a task to start working on it.'
                      : key === 'SOON'
                      ? 'Nothing coming up soon.'
                      : 'Nothing on the back burner.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bucketTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMove={handleMove}
                      onStart={handleStart}
                      onComplete={handleComplete}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {tasks.length === 0 && !loading && (
        <EmptyState
          icon={
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          title="No tasks yet"
          description="Add something you need to do — even a rough idea works."
          action={<Link href="/tasks/new" className="btn-primary">Add your first task</Link>}
        />
      )}
    </div>
  )
}
