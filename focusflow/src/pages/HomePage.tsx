import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiFetch } from '../lib/api'
import { Badge, effortVariant, effortLabel } from '../components/ui/Badge'
import { Task, Effort } from '../lib/types'

const ENERGY_OPTIONS: { value: Effort; label: string; hint: string }[] = [
  { value: 'LOW', label: 'Low', hint: 'Gentle tasks' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Steady focus' },
  { value: 'HIGH', label: 'High', hint: 'Full capacity' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const navigate = useNavigate()
  const [energy, setEnergy] = useState<Effort>('MEDIUM')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const all = await apiGet<Task[]>('/tasks?status=ACTIVE')
      const nowTasks = all.filter(t => t.bucket === 'NOW')
      const effortOk = (t: Task) =>
        energy === 'LOW' ? t.effort === 'LOW' :
        energy === 'MEDIUM' ? t.effort !== 'HIGH' : true

      let suggested = nowTasks.filter(effortOk)
      if (suggested.length < 3) {
        const soon = all.filter(t => t.bucket === 'SOON' && effortOk(t))
        suggested = [...suggested, ...soon].slice(0, 3)
      }
      if (suggested.length === 0) suggested = nowTasks.slice(0, 3)
      setTasks(suggested.slice(0, 3))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [energy])

  useEffect(() => { loadTasks() }, [loadTasks])

  async function handleStart(taskId: string, duration5 = false) {
    setStarting(taskId)
    try {
      const res = await apiFetch('/focus', { method: 'POST', body: JSON.stringify({ taskId }) })
      if (res.ok) {
        const session = await res.json()
        navigate(`/focusflow/focus/${session.task_id}?session=${session.id}${duration5 ? '&duration=5' : ''}`)
      }
    } finally { setStarting(null) }
  }

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text">{greeting()}</h1>
        <p className="text-text-muted text-sm mt-1">What's your energy like right now?</p>
      </div>

      {/* Energy selector */}
      <div className="flex gap-2.5 mb-8">
        {ENERGY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setEnergy(opt.value)}
            className={`flex-1 py-3 px-3 rounded-lg border text-sm font-medium transition-all duration-150
              ${energy === opt.value
                ? 'bg-primary border-primary text-white shadow-sm'
                : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'}`}
          >
            <div>{opt.label}</div>
            <div className={`text-xs mt-0.5 ${energy === opt.value ? 'text-white/70' : 'text-text-subtle'}`}>{opt.hint}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide">Suggested for you</h2>
        <Link to="/focusflow/tasks" className="text-sm text-primary hover:underline">All tasks</Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="card p-5 animate-pulse h-24" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">✦</div>
          <p className="text-text-muted text-sm mb-1">Nothing planned for now</p>
          <p className="text-text-subtle text-sm mb-4">Add a task to get started.</p>
          <Link to="/focusflow/tasks/new" className="btn-primary inline-block">Add your first task</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const firstStep = task.steps.find(s => !s.completed) ?? null
            const isResisted = task.resistance_count >= 2
            return (
              <div key={task.id} className={`card p-5 hover:shadow-card-hover transition-shadow ${isResisted ? 'border-amber-200' : ''}`}>
                {isResisted && (
                  <div className="flex items-center gap-1.5 mb-3 text-amber-600 bg-amber-50 px-3 py-1.5 rounded text-xs font-medium -mx-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    This task keeps getting pushed back — try a 5-minute start
                  </div>
                )}
                <h3 className="font-medium text-text text-base leading-snug mb-2">{task.title}</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge variant={effortVariant(task.effort)}>{effortLabel(task.effort)} effort</Badge>
                  <Badge>{task.duration_mins} min</Badge>
                </div>
                {firstStep && (
                  <div className="flex items-start gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <p className="text-sm text-text-muted">
                      <span className="text-text-subtle text-xs uppercase tracking-wide font-medium mr-1">First step:</span>
                      {firstStep.title}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <button onClick={() => handleStart(task.id)} disabled={starting === task.id} className="btn-primary flex items-center gap-2">
                    {starting === task.id
                      ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>Starting…</>
                      : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>Start</>
                    }
                  </button>
                  {isResisted && (
                    <button onClick={() => handleStart(task.id, true)} className="btn-secondary text-amber-700 border-amber-200 text-sm">
                      Just 5 min
                    </button>
                  )}
                  <Link to={`/focusflow/tasks/${task.id}`} className="btn-ghost text-sm ml-auto">Edit</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && tasks.length > 0 && tasks.length < 3 && (
        <Link to="/focusflow/tasks/new" className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors py-3 mt-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add another task
        </Link>
      )}
    </div>
  )
}
