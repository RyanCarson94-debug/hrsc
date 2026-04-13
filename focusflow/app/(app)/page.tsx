'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, effortVariant, effortLabel } from '@/components/ui/Badge'

type Effort = 'LOW' | 'MEDIUM' | 'HIGH'
type Bucket = 'NOW' | 'SOON' | 'LATER'

interface TaskStep {
  id: string
  title: string
  order: number
  completed: boolean
}

interface Task {
  id: string
  title: string
  description: string | null
  bucket: Bucket
  effort: Effort
  durationMins: number
  resistanceCount: number
  steps: TaskStep[]
}

const ENERGY_OPTIONS: { value: Effort; label: string; hint: string }[] = [
  { value: 'LOW', label: 'Low', hint: 'Gentle tasks only' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Focused but steady' },
  { value: 'HIGH', label: 'High', hint: 'Full capacity' },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFirstIncompleteStep(steps: TaskStep[]): TaskStep | null {
  return steps.find((s) => !s.completed) ?? null
}

export default function HomePage() {
  const router = useRouter()
  const [energy, setEnergy] = useState<Effort>('MEDIUM')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch NOW tasks + SOON tasks, filter by energy compatibility
      const res = await fetch('/api/tasks?status=ACTIVE')
      const all: Task[] = await res.json()

      // NOW tasks always show. SOON tasks show if there aren't enough NOW tasks.
      const nowTasks = all.filter((t) => t.bucket === 'NOW')

      // Filter by energy compatibility:
      // LOW energy → LOW effort tasks
      // MEDIUM energy → LOW + MEDIUM effort tasks
      // HIGH energy → all
      const effortFilter = (t: Task) => {
        if (energy === 'LOW') return t.effort === 'LOW'
        if (energy === 'MEDIUM') return t.effort === 'LOW' || t.effort === 'MEDIUM'
        return true
      }

      let suggested = nowTasks.filter(effortFilter)

      // If not enough NOW tasks, add matching SOON tasks
      if (suggested.length < 3) {
        const soon = all.filter((t) => t.bucket === 'SOON' && effortFilter(t))
        suggested = [...suggested, ...soon].slice(0, 3)
      }

      // If still not enough, add any effort level from NOW
      if (suggested.length === 0) {
        suggested = nowTasks.slice(0, 3)
      }

      setTasks(suggested.slice(0, 3))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [energy])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  async function handleStart(taskId: string) {
    setStarting(taskId)
    try {
      const res = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      if (res.ok) {
        const session = await res.json()
        router.push(`/focus/${session.taskId}?session=${session.id}`)
      }
    } catch {
      setStarting(null)
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text">{getGreeting()}</h1>
        <p className="text-text-muted text-sm mt-1">What's your energy like right now?</p>
      </div>

      {/* Energy Selector */}
      <div className="flex gap-2.5 mb-8">
        {ENERGY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setEnergy(opt.value)}
            className={`
              flex-1 py-3 px-3 rounded-lg border text-sm font-medium transition-all duration-150
              ${energy === opt.value
                ? 'bg-primary border-primary text-white shadow-sm'
                : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'}
            `}
          >
            <div className="text-center">
              <div className="font-medium">{opt.label}</div>
              <div className={`text-xs mt-0.5 ${energy === opt.value ? 'text-white/70' : 'text-text-subtle'}`}>
                {opt.hint}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Task suggestions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-wide text-xs">
          Suggested for you
        </h2>
        <Link href="/tasks" className="text-sm text-primary hover:underline">
          See all tasks
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">✦</div>
          <p className="text-text-muted text-sm mb-1">Nothing planned for now</p>
          <p className="text-text-subtle text-sm mb-4">
            Add a task and pick something to start with.
          </p>
          <Link href="/tasks/new" className="btn-primary inline-block">
            Add your first task
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const firstStep = getFirstIncompleteStep(task.steps)
            const isResisted = task.resistanceCount >= 2

            return (
              <div
                key={task.id}
                className={`card p-5 hover:shadow-card-hover transition-shadow duration-200 ${
                  isResisted ? 'border-amber-200' : ''
                }`}
              >
                {/* Friction signal */}
                {isResisted && (
                  <div className="flex items-center gap-1.5 mb-3 text-amber-600 bg-amber-50 px-3 py-1.5 rounded text-xs font-medium -mx-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    This task keeps getting pushed back — try a 5-minute start
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-medium text-text text-base leading-snug">{task.title}</h3>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge variant={effortVariant(task.effort)}>
                        {effortLabel(task.effort)} effort
                      </Badge>
                      <Badge variant="neutral">{task.durationMins} min</Badge>
                    </div>

                    {firstStep && (
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-text-muted leading-relaxed">
                          <span className="text-text-subtle text-xs uppercase tracking-wide font-medium mr-1">First step:</span>
                          {firstStep.title}
                        </p>
                      </div>
                    )}

                    {!firstStep && task.steps.length > 0 && (
                      <p className="text-sm text-success font-medium">All steps complete</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 mt-4">
                  <button
                    onClick={() => handleStart(task.id)}
                    disabled={starting === task.id}
                    className="btn-primary flex items-center gap-2"
                  >
                    {starting === task.id ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                          <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        Starting…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                        </svg>
                        Start
                      </>
                    )}
                  </button>

                  {isResisted && (
                    <button
                      onClick={async () => {
                        setStarting(task.id)
                        const res = await fetch('/api/focus', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ taskId: task.id }),
                        })
                        if (res.ok) {
                          const session = await res.json()
                          router.push(`/focus/${session.taskId}?session=${session.id}&duration=5`)
                        }
                        setStarting(null)
                      }}
                      className="btn-secondary text-amber-700 border-amber-200 text-sm"
                    >
                      Just 5 min
                    </button>
                  )}

                  <Link
                    href={`/tasks/${task.id}`}
                    className="btn-ghost text-sm ml-auto"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick add CTA */}
      {!loading && tasks.length > 0 && tasks.length < 3 && (
        <div className="mt-4">
          <Link
            href="/tasks/new"
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors py-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add another task
          </Link>
        </div>
      )}
    </div>
  )
}
