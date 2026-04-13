'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'

interface Step {
  id: string
  title: string
  order: number
  completed: boolean
}

interface Task {
  id: string
  title: string
  description: string | null
  durationMins: number
  steps: Step[]
}

interface FocusSession {
  id: string
  taskId: string
  startedAt: string
  status: string
  task: Task
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getElapsedSeconds(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

export default function FocusSessionPage({ params }: { params: { taskId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const requestedDuration = searchParams.get('duration')

  const [session, setSession] = useState<FocusSession | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Timer state
  const [timerMode, setTimerMode] = useState<'countdown' | 'stopwatch'>('countdown')
  const [durationSecs, setDurationSecs] = useState(25 * 60)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [timerFinished, setTimerFinished] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Distraction capture
  const [distractionOpen, setDistractionOpen] = useState(false)
  const [distractionText, setDistractionText] = useState('')
  const [savingDistraction, setSavingDistraction] = useState(false)
  const [distractionSaved, setDistractionSaved] = useState(false)

  // Ending
  const [ending, setEnding] = useState(false)
  const [showCompletePrompt, setShowCompletePrompt] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      if (sessionId) {
        const res = await fetch('/api/focus')
        const active = await res.json()
        if (active && active.id === sessionId) {
          setSession(active)
          setSteps(active.task.steps)

          const durMins = requestedDuration
            ? Number(requestedDuration)
            : active.task.durationMins
          setDurationSecs(durMins * 60)

          const elapsed = getElapsedSeconds(active.startedAt)
          setElapsed(Math.min(elapsed, durMins * 60))
        } else {
          setError('Session not found')
        }
      }
    } catch {
      setError('Could not load session')
    } finally {
      setLoading(false)
    }
  }, [sessionId, requestedDuration])

  useEffect(() => { loadSession() }, [loadSession])

  // Timer tick
  useEffect(() => {
    if (!session || paused || timerFinished || loading) return

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        if (next >= durationSecs) {
          setTimerFinished(true)
          setShowCompletePrompt(true)
          clearInterval(intervalRef.current!)
          // Browser notification
          if (typeof window !== 'undefined' && Notification.permission === 'granted') {
            new Notification('FocusFlow', {
              body: `Time's up! Great work on "${session.task.title}".`,
              icon: '/favicon.ico',
            })
          }
          return durationSecs
        }
        return next
      })
    }, 1000)

    return () => clearInterval(intervalRef.current!)
  }, [session, paused, timerFinished, loading, durationSecs])

  // Update page title with timer
  useEffect(() => {
    if (session) {
      const remaining = durationSecs - elapsed
      document.title = `${formatTime(remaining)} — ${session.task.title} | FocusFlow`
    }
    return () => { document.title = 'FocusFlow' }
  }, [elapsed, durationSecs, session])

  async function handleToggleStep(step: Step) {
    if (!session) return
    const newCompleted = !step.completed

    // Optimistic update
    setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, completed: newCompleted } : s))

    await fetch(`/api/tasks/${session.taskId}/steps`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId: step.id, completed: newCompleted }),
    })
  }

  async function handleSaveDistraction() {
    if (!session || !distractionText.trim()) return
    setSavingDistraction(true)
    try {
      await fetch('/api/distractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, content: distractionText.trim() }),
      })
      setDistractionText('')
      setDistractionSaved(true)
      setTimeout(() => {
        setDistractionOpen(false)
        setDistractionSaved(false)
      }, 800)
    } finally {
      setSavingDistraction(false)
    }
  }

  async function endSession(status: 'COMPLETED' | 'ABANDONED') {
    if (!session || ending) return
    setEnding(true)

    clearInterval(intervalRef.current!)
    const durationMins = Math.ceil(elapsed / 60)
    const stepsCompleted = steps.filter((s) => s.completed).length

    await fetch(`/api/focus/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, durationMins, stepsCompleted }),
    })

    router.push('/tasks')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted animate-pulse">Loading session…</div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">{error || 'Session not found'}</p>
          <button onClick={() => router.push('/tasks')} className="btn-primary">
            Go to tasks
          </button>
        </div>
      </div>
    )
  }

  const remaining = durationSecs - elapsed
  const progress = Math.min((elapsed / durationSecs) * 100, 100)
  const currentStep = steps.find((s) => !s.completed) ?? null
  const allStepsDone = steps.length > 0 && steps.every((s) => s.completed)
  const completedCount = steps.filter((s) => s.completed).length

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white">
        <button
          onClick={() => {
            if (confirm('End this session?')) endSession('ABANDONED')
          }}
          className="btn-ghost text-sm flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          End session
        </button>

        <span className="text-sm font-medium text-text-muted truncate max-w-[200px]">
          {session.task.title}
        </span>

        <button
          onClick={() => setDistractionOpen(true)}
          className="btn-ghost text-sm flex items-center gap-1.5"
          title="Capture a distracting thought"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Capture
        </button>
      </div>

      {/* Main focus area */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-lg mx-auto w-full">

        {/* Timer circle */}
        <div className="relative mb-8">
          <svg width="200" height="200" viewBox="0 0 200 200" className="rotate-[-90deg]">
            <circle cx="100" cy="100" r="88" fill="none" stroke="#E8E6E1" strokeWidth="8"/>
            <circle
              cx="100" cy="100" r="88"
              fill="none"
              stroke={timerFinished ? '#22C55E' : '#5B6CF8'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-4xl font-light tracking-tight ${timerFinished ? 'text-success' : 'text-text'}`}>
              {timerFinished ? 'Done!' : formatTime(remaining)}
            </div>
            {!timerFinished && (
              <div className="text-xs text-text-subtle mt-1">remaining</div>
            )}
          </div>
        </div>

        {/* Timer controls */}
        <div className="flex items-center gap-3 mb-10">
          {!timerFinished && (
            <button
              onClick={() => setPaused(!paused)}
              className={`px-5 py-2.5 rounded font-medium text-sm flex items-center gap-2 transition-all ${
                paused
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'bg-white border border-border text-text-muted hover:text-text hover:border-primary/40'
              }`}
            >
              {paused ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                    <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                  </svg>
                  Pause
                </>
              )}
            </button>
          )}

          <button
            onClick={() => endSession('COMPLETED')}
            disabled={ending}
            className="btn-primary flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {ending ? 'Finishing…' : 'Complete session'}
          </button>
        </div>

        {/* Current step */}
        {steps.length > 0 && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-text-subtle uppercase tracking-wide">Steps</h2>
              {steps.length > 0 && (
                <span className="text-xs text-text-subtle">{completedCount}/{steps.length}</span>
              )}
            </div>

            <div className="space-y-2">
              {steps.map((step, i) => (
                <button
                  key={step.id}
                  onClick={() => handleToggleStep(step)}
                  className={`
                    w-full flex items-center gap-3 p-3.5 rounded-lg border text-left
                    transition-all duration-200 group
                    ${step.completed
                      ? 'bg-gray-50 border-border text-text-subtle'
                      : i === steps.findIndex((s) => !s.completed)
                      ? 'bg-white border-primary/30 shadow-card text-text'
                      : 'bg-white border-border text-text-muted'
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${step.completed ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'}
                  `}>
                    {step.completed && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${step.completed ? 'line-through' : ''}`}>
                    {step.title}
                  </span>
                  {i === steps.findIndex((s) => !s.completed) && !step.completed && (
                    <span className="ml-auto text-xs text-primary font-medium flex-shrink-0">current</span>
                  )}
                </button>
              ))}
            </div>

            {allStepsDone && (
              <div className="mt-4 bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                <p className="text-success font-medium text-sm">All steps complete!</p>
                <p className="text-text-subtle text-xs mt-1">Go ahead and complete the session.</p>
              </div>
            )}
          </div>
        )}

        {/* No steps — just a calm working state */}
        {steps.length === 0 && (
          <div className="text-center">
            <p className="text-text-subtle text-sm">
              Stay focused on <span className="text-text">{session.task.title}</span>
            </p>
            {session.task.description && (
              <p className="text-text-muted text-sm mt-2 max-w-xs">{session.task.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Timer complete prompt */}
      <Modal
        open={showCompletePrompt && !ending}
        onClose={() => setShowCompletePrompt(false)}
        title="Time's up"
      >
        <p className="text-text-muted text-sm mb-5">
          You worked on <strong>{session.task.title}</strong>. How did it go?
        </p>
        <div className="flex flex-col gap-2.5">
          <button onClick={() => endSession('COMPLETED')} className="btn-primary w-full">
            Mark as done
          </button>
          <button
            onClick={() => setShowCompletePrompt(false)}
            className="btn-secondary w-full"
          >
            Keep going — I need more time
          </button>
        </div>
      </Modal>

      {/* Distraction capture modal */}
      <Modal
        open={distractionOpen}
        onClose={() => { setDistractionOpen(false); setDistractionText('') }}
        title="Capture distraction"
      >
        <p className="text-text-muted text-sm mb-4">
          Write it down and get back to work.
        </p>

        {distractionSaved ? (
          <div className="flex items-center gap-2 text-success py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium">Saved — back to work!</span>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              className="input resize-none mb-4"
              rows={3}
              placeholder="What's on your mind? Write it and let it go."
              value={distractionText}
              onChange={(e) => setDistractionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveDistraction()
              }}
            />
            <div className="flex gap-2.5">
              <button
                onClick={handleSaveDistraction}
                disabled={savingDistraction || !distractionText.trim()}
                className="btn-primary flex-1"
              >
                {savingDistraction ? 'Saving…' : 'Save and refocus'}
              </button>
              <button
                onClick={() => { setDistractionOpen(false); setDistractionText('') }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-text-subtle mt-2">Tip: ⌘↵ to save quickly</p>
          </>
        )}
      </Modal>
    </div>
  )
}
