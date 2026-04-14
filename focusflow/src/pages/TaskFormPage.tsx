import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { apiGet, apiFetch } from '../lib/api'
import { Task, Bucket, Effort } from '../lib/types'

async function fetchAiSteps(taskTitle: string, taskDescription: string): Promise<{ steps: string[] } | { error: string }> {
  try {
    const res = await apiFetch('/ai/breakdown', {
      method: 'POST',
      body: JSON.stringify({ taskTitle, taskDescription }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? `HTTP ${res.status}` }
    return Array.isArray(data.steps) && data.steps.length > 0 ? { steps: data.steps } : { error: 'No steps returned' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' }
  }
}

type Step = { id?: string; title: string; sort_order: number; completed: boolean }

const EFFORT_OPTS: { value: Effort; label: string; hint: string }[] = [
  { value: 'LOW', label: 'Low', hint: 'Easy to start' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Needs focus' },
  { value: 'HIGH', label: 'High', hint: 'Demanding' },
]
const BUCKET_OPTS: { value: Bucket; label: string; hint: string }[] = [
  { value: 'NOW', label: 'Now', hint: 'Today (max 3)' },
  { value: 'SOON', label: 'Soon', hint: 'This week' },
  { value: 'LATER', label: 'Later', hint: 'Back burner' },
]
const DURATIONS = [5, 10, 15, 25, 30, 45, 60]

const STEP_PATTERNS: Record<string, string[]> = {
  'report': ['Open the document', 'Write the outline', 'Draft the main content', 'Review and edit'],
  'presentation': ['List key points', 'Create slide structure', 'Write slide content', 'Run through once'],
  'email': ['Open your email', 'Write a draft', 'Read through and adjust', 'Send it'],
  'meeting': ['Review the agenda', 'Prepare notes or questions', 'Join the meeting'],
  'review': ['Open the document', 'Read through it', 'Note key feedback', 'Send your response'],
  'write': ['Open a blank document', 'Write a rough outline', 'Write the first draft', 'Review and tidy up'],
  'plan': ['List what needs to happen', 'Prioritise the list', 'Add rough timelines'],
  'research': ['Define what you need to find', 'Search for sources', 'Note key findings', 'Summarise'],
  'call': ['Find contact details', 'Prepare what to say', 'Make the call'],
  'read': ['Open the document', 'Read the first section', 'Take notes as you go', 'Summarise takeaways'],
}

function suggestSteps(title: string): Step[] {
  const lower = title.toLowerCase()
  for (const [key, steps] of Object.entries(STEP_PATTERNS)) {
    if (lower.includes(key)) return steps.map((s, i) => ({ title: s, sort_order: i, completed: false }))
  }
  return [
    { title: 'Open or gather what you need', sort_order: 0, completed: false },
    { title: 'Do the main work', sort_order: 1, completed: false },
    { title: 'Review and finish up', sort_order: 2, completed: false },
  ]
}

export function TaskFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [bucket, setBucket] = useState<Bucket>('SOON')
  const [effort, setEffort] = useState<Effort>('MEDIUM')
  const [durationMins, setDurationMins] = useState(25)
  const [customDuration, setCustomDuration] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [stepsGenerated, setStepsGenerated] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiUsed, setAiUsed] = useState<boolean | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (isNew) return
    try {
      const task = await apiGet<Task>(`/tasks/${id}`)
      setTitle(task.title)
      setDescription(task.description ?? '')
      setBucket(task.bucket)
      setEffort(task.effort)
      setDurationMins(task.duration_mins)
      setSteps(task.steps.map(s => ({ id: s.id, title: s.title, sort_order: s.sort_order, completed: !!s.completed })))
    } catch { navigate('/focusflow/tasks') }
    finally { setLoading(false) }
  }, [id, isNew, navigate])

  useEffect(() => { load() }, [load])

  function generateSteps() {
    setSteps(suggestSteps(title))
    setStepsGenerated(true)
  }

  function updateStep(i: number, val: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, title: val } : s))
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, sort_order: idx })))
  }

  function moveStep(i: number, dir: 'up' | 'down') {
    const arr = [...steps]
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setSteps(arr.map((s, idx) => ({ ...s, sort_order: idx })))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const validSteps = steps.filter(s => s.title.trim())
    try {
      if (isNew) {
        const res = await apiFetch('/tasks', {
          method: 'POST',
          body: JSON.stringify({ title: title.trim(), description: description.trim() || null, bucket, effort, duration_mins: durationMins, steps: validSteps }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error); return }
      } else {
        const res = await apiFetch(`/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title: title.trim(), description: description.trim() || null, bucket, effort, duration_mins: durationMins }),
        })
        if (!res.ok) { const d = await res.json(); setError(d.error); return }
        await apiFetch(`/tasks/${id}/steps`, { method: 'PUT', body: JSON.stringify({ steps: validSteps }) })
      }
      navigate('/focusflow/tasks')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="page-container animate-pulse"><div className="h-6 bg-gray-100 rounded w-32 mb-8" /></div>

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/focusflow/tasks" className="text-text-muted hover:text-text transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-text">{isNew ? 'Add task' : 'Edit task'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="card p-5">
          <label htmlFor="title" className="label">What needs to get done?</label>
          <input id="title" type="text" className="input text-base" placeholder="e.g. Prepare board presentation"
            value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          {title.trim() && !stepsGenerated && (
            <button type="button" disabled={aiLoading} onClick={async () => {
              setAiLoading(true)
              const result = await fetchAiSteps(title, description)
              if ('steps' in result) {
                setSteps(result.steps.map((s, i) => ({ title: s, sort_order: i, completed: false })))
                setAiUsed(true)
                setAiError(null)
              } else {
                setSteps(suggestSteps(title))
                setAiUsed(false)
                setAiError(result.error)
              }
              setStepsGenerated(true)
              setAiLoading(false)
            }} className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50">
              {aiLoading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
              {aiLoading ? 'Thinking…' : 'Break into steps'}
            </button>
          )}
        </div>

        {/* Steps */}
        {(steps.length > 0 || stepsGenerated) && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
            <label className="label mb-0">Steps</label>
            {aiUsed === true && <span className="text-xs text-success font-medium">AI generated</span>}
            {aiUsed === false && <span className="text-xs text-text-subtle" title={aiError ?? ''}>Suggested ({aiError ?? 'AI unavailable'})</span>}
          </div>
            <div className="space-y-2 mb-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveStep(i, 'up')} disabled={i === 0}
                      className="text-text-subtle hover:text-text disabled:opacity-20 p-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                    <button type="button" onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1}
                      className="text-text-subtle hover:text-text disabled:opacity-20 p-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                  <span className="text-xs text-text-subtle w-4 text-right flex-shrink-0">{i + 1}</span>
                  <input type="text" className="input flex-1 py-2" value={step.title}
                    onChange={e => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}`} />
                  <button type="button" onClick={() => removeStep(i)} className="p-1.5 text-text-subtle hover:text-danger transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setSteps(prev => [...prev, { title: '', sort_order: prev.length, completed: false }])}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Add step
            </button>
          </div>
        )}

        {/* Bucket */}
        <div className="card p-5">
          <label className="label">When will you do this?</label>
          <div className="flex gap-2">
            {BUCKET_OPTS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setBucket(opt.value)}
                className={`flex-1 py-2.5 px-2 rounded border text-sm font-medium transition-all
                  ${bucket === opt.value ? 'bg-primary border-primary text-white' : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'}`}>
                <div>{opt.label}</div>
                <div className={`text-xs mt-0.5 ${bucket === opt.value ? 'text-white/70' : 'text-text-subtle'}`}>{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Effort + Duration */}
        <div className="card p-5 space-y-5">
          <div>
            <label className="label">Effort level</label>
            <div className="flex gap-2">
              {EFFORT_OPTS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setEffort(opt.value)}
                  className={`flex-1 py-2 px-2 rounded border text-sm font-medium transition-all
                    ${effort === opt.value ? 'bg-primary border-primary text-white' : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'}`}>
                  <div>{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${effort === opt.value ? 'text-white/70' : 'text-text-subtle'}`}>{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Estimated time</label>
            <div className="flex flex-wrap gap-2 items-center">
              {DURATIONS.map(d => (
                <button key={d} type="button" onClick={() => { setDurationMins(d); setCustomDuration(false) }}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition-all
                    ${durationMins === d && !customDuration ? 'bg-primary border-primary text-white' : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'}`}>
                  {d}m
                </button>
              ))}
              <button type="button" onClick={() => setCustomDuration(!customDuration)}
                className={`px-3 py-1.5 rounded border text-sm font-medium transition-all
                  ${customDuration ? 'bg-primary border-primary text-white' : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'}`}>
                Custom
              </button>
            </div>
            {customDuration && (
              <div className="mt-2 flex items-center gap-2">
                <input type="number" className="input w-24" min={1} max={480} value={durationMins}
                  onChange={e => setDurationMins(Number(e.target.value))} />
                <span className="text-sm text-text-muted">minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5">
          <label htmlFor="description" className="label">Notes <span className="text-text-subtle font-normal">(optional)</span></label>
          <textarea id="description" className="input resize-none" rows={3} placeholder="Any context, links, or details…"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add task' : 'Save changes'}
          </button>
          <Link to="/focusflow/tasks" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
