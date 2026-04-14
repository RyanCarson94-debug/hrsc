import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { FocusSession, TaskStep } from '../lib/types'

function fmt(secs: number) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

export function FocusPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const duration5 = searchParams.get('duration') === '5'
  const navigate = useNavigate()

  const [session, setSession] = useState<FocusSession | null>(null)
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [durationSecs, setDurationSecs] = useState(25 * 60)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [distractionOpen, setDistractionOpen] = useState(false)
  const [distractionText, setDistractionText] = useState('')
  const [distractionSaved, setDistractionSaved] = useState(false)
  const [captures, setCaptures] = useState<{ id: string; content: string }[]>([])
  const [ending, setEnding] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const pipSupported = 'documentPictureInPicture' in window

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/focus')
      const active = await res.json()
      if (active && active.id === sessionId) {
        setSession(active)
        setSteps(active.task.steps)
        const durMins = duration5 ? 5 : active.task.duration_mins
        const durSecs = durMins * 60
        setDurationSecs(durSecs)
        const startedAt = active.started_at.includes('T') ? active.started_at : active.started_at.replace(' ', 'T') + 'Z'
        const el = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
        setElapsed(Math.min(el, durSecs))
      } else {
        setError('Session not found')
      }
    } catch { setError('Could not load session') }
    finally { setLoading(false) }
  }, [sessionId, duration5])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!session || paused || finished || loading) return
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= durationSecs) {
          clearInterval(intervalRef.current!)
          setFinished(true)
          setShowComplete(true)
          if (Notification.permission === 'granted') {
            new Notification('FocusFlow', { body: `Time's up! Great work on "${session.task.title}".` })
          }
          return durationSecs
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [session, paused, finished, loading, durationSecs])

  useEffect(() => {
    if (session) document.title = `${fmt(durationSecs - elapsed)} — ${session.task.title} | FocusFlow`
    return () => { document.title = 'FocusFlow' }
  }, [elapsed, durationSecs, session])

  async function toggleStep(step: TaskStep) {
    if (!session) return
    const newVal = !step.completed
    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, completed: newVal ? 1 : 0 } : s))
    await apiFetch(`/tasks/${session.task_id}/steps`, {
      method: 'PATCH',
      body: JSON.stringify({ stepId: step.id, completed: newVal }),
    })
  }

  async function saveDistraction() {
    if (!session || !distractionText.trim()) return
    const res = await apiFetch('/distractions', { method: 'POST', body: JSON.stringify({ sessionId: session.id, content: distractionText.trim() }) })
    if (res.ok) {
      const saved = await res.json()
      setCaptures(prev => [...prev, saved])
    }
    setDistractionText('')
    setDistractionSaved(true)
    setTimeout(() => { setDistractionOpen(false); setDistractionSaved(false) }, 800)
  }

  async function endSession(status: 'COMPLETED' | 'ABANDONED') {
    if (!session || ending) return
    setEnding(true)
    clearInterval(intervalRef.current!)
    await apiFetch(`/focus/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, duration_mins: Math.ceil(elapsed / 60), steps_completed: steps.filter(s => s.completed).length }),
    })
    if (status === 'COMPLETED' && captures.length === 0) {
      // Fetch any captures saved before this render (e.g. after a reload)
      const res = await apiFetch(`/distractions?sessionId=${session.id}`)
      if (res.ok) { const data = await res.json(); if (data.length) { setCaptures(data); setEnding(false); return } }
    }
    navigate('/focusflow/tasks')
  }

  useEffect(() => {
    if (!pipWindow || !session) return
    const rem = durationSecs - elapsed
    const stepsHtml = steps.map(s => `
      <button data-sid="${s.id}" style="width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;
        border-radius:8px;border:1px solid #E2DFDA;background:${s.completed ? '#F8F7F5' : 'white'};
        text-align:left;cursor:pointer;margin-bottom:6px;font-family:inherit;box-sizing:border-box">
        <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${s.completed ? '#FC1921' : '#C8C5BF'};
          background:${s.completed ? '#FC1921' : 'white'};flex-shrink:0;display:flex;align-items:center;justify-content:center">
          ${s.completed ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>' : ''}
        </div>
        <span style="font-size:13px;color:${s.completed ? '#808284' : '#231F20'};${s.completed ? 'text-decoration:line-through' : ''}">${s.title}</span>
      </button>`).join('')
    pipWindow.document.body.innerHTML = `
      <div style="padding:16px">
        <div style="font-size:11px;color:#808284;margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${session.task.title}</div>
        <div style="text-align:center;font-size:44px;font-weight:300;color:${finished ? '#00A28A' : '#231F20'};margin-bottom:14px;letter-spacing:-1px">
          ${finished ? 'Done!' : fmt(rem)}</div>
        ${steps.length > 0 ? `
          <div style="font-size:10px;color:#808284;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;justify-content:space-between">
            <span>Steps</span><span>${steps.filter(s => s.completed).length}/${steps.length}</span>
          </div>${stepsHtml}` : `<div style="text-align:center;color:#808284;font-size:13px">Stay focused</div>`}
        ${!finished ? `<button id="pp" style="margin-top:10px;width:100%;padding:8px;border-radius:8px;
          border:1px solid #E2DFDA;background:white;font-size:13px;color:#808284;cursor:pointer;font-family:inherit;box-sizing:border-box">
          ${paused ? '▶ Resume' : '⏸ Pause'}</button>` : ''}
      </div>`
    steps.forEach(s => {
      const el = pipWindow.document.querySelector(`[data-sid="${s.id}"]`)
      if (el) el.addEventListener('click', () => toggleStep(s))
    })
    const pp = pipWindow.document.getElementById('pp')
    if (pp) pp.addEventListener('click', () => setPaused(p => !p))
  }, [pipWindow, elapsed, paused, finished, steps, session, durationSecs])

  async function openPip() {
    if (!pipSupported) return
    try {
      const pip = await (window as any).documentPictureInPicture.requestWindow({ width: 300, height: steps.length > 3 ? 500 : 340 })
      document.querySelectorAll('link[rel="stylesheet"]').forEach(el => pip.document.head.appendChild(el.cloneNode(true)))
      const font = pip.document.createElement('link')
      font.rel = 'stylesheet'
      font.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap'
      pip.document.head.appendChild(font)
      pip.document.body.style.cssText = 'margin:0;background:#F1EFEA;font-family:Montserrat,sans-serif'
      setPipWindow(pip)
      pip.addEventListener('pagehide', () => setPipWindow(null))
    } catch {}
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><p className="text-text-muted animate-pulse">Loading…</p></div>
  if (error || !session) return (
    <div className="min-h-screen bg-bg flex items-center justify-center text-center">
      <div><p className="text-text-muted mb-4">{error || 'Session not found'}</p>
      <button onClick={() => navigate('/focusflow/tasks')} className="btn-primary">Go to tasks</button></div>
    </div>
  )

  const remaining = durationSecs - elapsed
  const progress = Math.min((elapsed / durationSecs) * 100, 100)
  const allDone = steps.length > 0 && steps.every(s => s.completed)
  const currentStepIdx = steps.findIndex(s => !s.completed)

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white">
        <button onClick={() => { if (confirm('End this session?')) endSession('ABANDONED') }} className="btn-ghost text-sm flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          End session
        </button>
        <span className="text-sm font-medium text-text-muted truncate max-w-[200px]">{session.task.title}</span>
        <div className="flex items-center gap-2">
          {pipSupported && !pipWindow && (
            <button onClick={openPip} title="Float timer on top" className="btn-ghost text-sm flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="14" y="7" width="6" height="6" rx="1" fill="currentColor"/></svg>
              Pop out
            </button>
          )}
          <button onClick={() => setDistractionOpen(true)} className="btn-ghost text-sm flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Capture
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-lg mx-auto w-full">
        {/* Timer */}
        <div className="relative mb-8">
          <svg width="200" height="200" viewBox="0 0 200 200" className="rotate-[-90deg]">
            <circle cx="100" cy="100" r="88" fill="none" stroke="#E2DFDA" strokeWidth="8"/>
            <circle cx="100" cy="100" r="88" fill="none" stroke={finished ? '#00A28A' : '#FC1921'} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-4xl font-light tracking-tight ${finished ? 'text-success' : 'text-text'}`}>
              {finished ? 'Done!' : fmt(remaining)}
            </div>
            {!finished && <div className="text-xs text-text-subtle mt-1">remaining</div>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-10">
          {!finished && (
            <button onClick={() => setPaused(!paused)}
              className={`px-5 py-2.5 rounded font-medium text-sm flex items-center gap-2 transition-all
                ${paused ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-white border border-border text-text-muted hover:text-text hover:border-primary/40'}`}>
              {paused
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>Resume</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>Pause</>
              }
            </button>
          )}
          <button onClick={() => { setShowComplete(true) }} disabled={ending} className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {ending ? 'Finishing…' : 'Complete session'}
          </button>
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-text-subtle uppercase tracking-wide">Steps</h2>
              <span className="text-xs text-text-subtle">{steps.filter(s => s.completed).length}/{steps.length}</span>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <button key={step.id} onClick={() => toggleStep(step)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all group
                    ${step.completed ? 'bg-gray-50 border-border text-text-subtle' :
                      i === currentStepIdx ? 'bg-white border-primary/30 shadow-card text-text' : 'bg-white border-border text-text-muted'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${step.completed ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'}`}>
                    {step.completed && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${step.completed ? 'line-through' : ''}`}>{step.title}</span>
                  {i === currentStepIdx && !step.completed && <span className="ml-auto text-xs text-primary font-medium flex-shrink-0">current</span>}
                </button>
              ))}
            </div>
            {allDone && (
              <div className="mt-4 bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                <p className="text-success font-medium text-sm">All steps complete!</p>
                <p className="text-text-subtle text-xs mt-1">Go ahead and complete the session.</p>
              </div>
            )}
          </div>
        )}

        {steps.length === 0 && (
          <p className="text-text-subtle text-sm text-center">
            Stay focused on <span className="text-text">{session.task.title}</span>
          </p>
        )}
      </div>

      {/* Timer done */}
      <Modal open={showComplete && !ending} onClose={() => setShowComplete(false)} title="Time's up">
        <p className="text-text-muted text-sm mb-5">You worked on <strong>{session.task.title}</strong>. How did it go?</p>
        {captures.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-text-subtle uppercase tracking-wide mb-2">Captured during session</p>
            <ul className="space-y-1.5">
              {captures.map((c, i) => (
                <li key={c.id ?? i} className="text-sm text-text bg-gray-50 rounded px-3 py-2 border border-border">{c.content}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <button onClick={() => endSession('COMPLETED')} className="btn-primary w-full">Mark as done</button>
          <button onClick={() => setShowComplete(false)} className="btn-secondary w-full">Keep going — I need more time</button>
        </div>
      </Modal>

      {/* Distraction capture */}
      <Modal open={distractionOpen} onClose={() => { setDistractionOpen(false); setDistractionText('') }} title="Capture distraction">
        <p className="text-text-muted text-sm mb-4">Write it down and get back to work.</p>
        {distractionSaved ? (
          <div className="flex items-center gap-2 text-success py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-sm font-medium">Saved — back to work!</span>
          </div>
        ) : (
          <>
            <textarea autoFocus className="input resize-none mb-4" rows={3}
              placeholder="What's on your mind?"
              value={distractionText}
              onChange={e => setDistractionText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveDistraction() }}
            />
            <div className="flex gap-2.5">
              <button onClick={saveDistraction} disabled={!distractionText.trim()} className="btn-primary flex-1">Save and refocus</button>
              <button onClick={() => { setDistractionOpen(false); setDistractionText('') }} className="btn-secondary">Cancel</button>
            </div>
            <p className="text-xs text-text-subtle mt-2">Tip: ⌘↵ to save quickly</p>
          </>
        )}
      </Modal>
    </div>
  )
}
