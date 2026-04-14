import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiFetch, apiDelete } from '../lib/api'
import { Badge, effortVariant, effortLabel } from '../components/ui/Badge'
import { EmptyState } from '../components/shared/EmptyState'
import { Task, Bucket } from '../lib/types'

const BUCKETS: { key: Bucket; label: string; max?: number; hint: string }[] = [
  { key: 'NOW', label: 'Now', max: 3, hint: 'What you\'re doing today' },
  { key: 'SOON', label: 'Soon', hint: 'Coming up this week' },
  { key: 'LATER', label: 'Later', hint: 'On the radar' },
]

function TaskRow({ task, onMove, onStart, onComplete, onDelete }: {
  task: Task
  onMove: (id: string, bucket: Bucket) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const done = task.steps.filter(s => s.completed).length
  const total = task.steps.length

  return (
    <div className={`card p-4 group ${task.resistance_count >= 2 ? 'border-amber-200' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(task.id)}
          className="mt-0.5 rounded border-2 border-border hover:border-primary flex-shrink-0 transition-colors flex items-center justify-center group-hover:border-primary/40"
          aria-label="Mark complete"
          style={{ width: 18, height: 18 }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/focusflow/tasks/${task.id}`} className="font-medium text-text text-sm leading-snug hover:text-primary transition-colors">
              {task.title}
            </Link>
            <div className="relative flex-shrink-0">
              <button onClick={() => setMenu(!menu)} className="p-1 text-text-subtle hover:text-text-muted rounded opacity-0 group-hover:opacity-100" aria-label="Actions">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                </svg>
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-6 z-20 bg-white rounded-lg shadow-modal border border-border py-1 min-w-[140px]">
                    {(['NOW','SOON','LATER'] as Bucket[]).filter(b => b !== task.bucket).map(b => (
                      <button key={b} onClick={() => { onMove(task.id, b); setMenu(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-text hover:bg-gray-50">
                        Move to {b.charAt(0) + b.slice(1).toLowerCase()}
                      </button>
                    ))}
                    <button onClick={() => { onStart(task.id); setMenu(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-gray-50">
                      Start session
                    </button>
                    <div className="border-t border-border my-1" />
                    <button onClick={() => { onDelete(task.id); setMenu(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Badge variant={effortVariant(task.effort)}>{effortLabel(task.effort)}</Badge>
            <Badge>{task.duration_mins}m</Badge>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
              <span className="text-xs text-text-subtle">{done}/{total}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setTasks(await apiGet<Task[]>('/tasks?status=ACTIVE')) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleMove(id: string, bucket: Bucket) {
    try {
      const res = await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ bucket }) })
      const updated = await res.json()
      if (!res.ok) { alert(updated.error); return }
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
    } catch { /* ignore */ }
  }

  async function handleStart(taskId: string) {
    const res = await apiFetch('/focus', { method: 'POST', body: JSON.stringify({ taskId }) })
    if (res.ok) {
      const s = await res.json()
      navigate(`/focusflow/focus/${s.task_id}?session=${s.id}`)
    }
  }

  async function handleComplete(id: string) {
    await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'COMPLETED' }) })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return
    await apiDelete(`/tasks/${id}`)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return (
    <div className="page-container space-y-8">
      {[0,1,2].map(i => <div key={i} className="card p-4 h-20 animate-pulse" />)}
    </div>
  )

  const byBucket = (b: Bucket) => tasks.filter(t => t.bucket === b)

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-text">Tasks</h1>
        <Link to="/focusflow/tasks/new" className="btn-primary flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Add task
        </Link>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          title="No tasks yet"
          description="Add something you need to do — even a rough idea works."
          action={<Link to="/focusflow/tasks/new" className="btn-primary">Add your first task</Link>}
        />
      ) : (
        <div className="space-y-8">
          {BUCKETS.map(({ key, label, max, hint }) => {
            const list = byBucket(key)
            return (
              <section key={key} aria-label={`${label} tasks`}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="font-semibold text-text">{label}</h2>
                  {list.length > 0 && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${key === 'NOW' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-text-muted'}`}>
                      {list.length}{max ? `/${max}` : ''}
                    </span>
                  )}
                  <span className="text-xs text-text-subtle">{hint}</span>
                </div>
                {max && list.length >= max && (
                  <p className="text-xs text-text-muted bg-primary-light/50 px-3 py-1.5 rounded mb-3">
                    Now is full — complete or move a task first.
                  </p>
                )}
                {list.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg py-6 text-center">
                    <p className="text-text-subtle text-sm">
                      {key === 'NOW' ? 'Nothing here — move a task to start working on it.' : key === 'SOON' ? 'Nothing coming up soon.' : 'Nothing on the back burner.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map(task => (
                      <TaskRow key={task.id} task={task} onMove={handleMove} onStart={handleStart} onComplete={handleComplete} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
