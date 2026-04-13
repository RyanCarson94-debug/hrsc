'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Bucket = 'NOW' | 'SOON' | 'LATER'
type Effort = 'LOW' | 'MEDIUM' | 'HIGH'

interface Step {
  id?: string
  title: string
  order: number
  completed: boolean
}

interface FormData {
  title: string
  description: string
  bucket: Bucket
  effort: Effort
  durationMins: number
  steps: Step[]
}

const EFFORT_OPTIONS: { value: Effort; label: string; hint: string }[] = [
  { value: 'LOW', label: 'Low', hint: 'Easy to start' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Needs focus' },
  { value: 'HIGH', label: 'High', hint: 'Demanding' },
]

const BUCKET_OPTIONS: { value: Bucket; label: string; hint: string }[] = [
  { value: 'NOW', label: 'Now', hint: 'Today (max 3)' },
  { value: 'SOON', label: 'Soon', hint: 'This week' },
  { value: 'LATER', label: 'Later', hint: 'Back burner' },
]

const DURATION_PRESETS = [5, 10, 15, 25, 30, 45, 60]

function generateSteps(title: string): Step[] {
  // Simple step suggestions based on common task patterns
  const lower = title.toLowerCase()

  const patterns: Record<string, string[]> = {
    'report': ['Open the document', 'Write the outline or structure', 'Draft the main content', 'Review and edit'],
    'presentation': ['List the key points', 'Create slide structure', 'Write slide content', 'Add any visuals needed', 'Run through once'],
    'email': ['Open your email', 'Write a rough draft', 'Read through and adjust', 'Send it'],
    'meeting': ['Review the agenda', 'Prepare any notes or questions', 'Join the meeting'],
    'review': ['Open the document', 'Read through it', 'Note key points or feedback', 'Send your response'],
    'call': ['Find the contact details', 'Prepare what you want to say', 'Make the call'],
    'write': ['Open a blank document', 'Write a rough outline', 'Write the first draft', 'Review and tidy up'],
    'plan': ['List what needs to happen', 'Prioritise the list', 'Add rough timelines', 'Share or file the plan'],
    'research': ['Define what you need to find', 'Search for sources', 'Note key findings', 'Summarise findings'],
    'read': ['Open the document', 'Read the first section', 'Take notes as you go', 'Summarise key takeaways'],
  }

  for (const [key, steps] of Object.entries(patterns)) {
    if (lower.includes(key)) {
      return steps.map((s, i) => ({ title: s, order: i, completed: false }))
    }
  }

  // Generic fallback
  return [
    { title: 'Open or gather what you need', order: 0, completed: false },
    { title: 'Do the main work', order: 1, completed: false },
    { title: 'Review and finish up', order: 2, completed: false },
  ]
}

export default function TaskFormPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const isNew = params.id === 'new'

  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    bucket: 'SOON',
    effort: 'MEDIUM',
    durationMins: 25,
    steps: [],
  })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stepsGenerated, setStepsGenerated] = useState(false)
  const [customDuration, setCustomDuration] = useState(false)

  const loadTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${params.id}`)
      if (!res.ok) { router.push('/tasks'); return }
      const task = await res.json()
      setForm({
        title: task.title,
        description: task.description || '',
        bucket: task.bucket,
        effort: task.effort,
        durationMins: task.durationMins,
        steps: task.steps,
      })
    } catch {
      router.push('/tasks')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    if (!isNew) loadTask()
  }, [isNew, loadTask])

  function handleGenerateSteps() {
    if (!form.title.trim()) return
    const suggested = generateSteps(form.title)
    setForm((f) => ({ ...f, steps: suggested }))
    setStepsGenerated(true)
  }

  function addStep() {
    setForm((f) => ({
      ...f,
      steps: [...f.steps, { title: '', order: f.steps.length, completed: false }],
    }))
  }

  function updateStep(index: number, title: string) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, i) => (i === index ? { ...s, title } : s)),
    }))
  }

  function removeStep(index: number) {
    setForm((f) => ({
      ...f,
      steps: f.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })),
    }))
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const newSteps = [...form.steps]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newSteps.length) return
    ;[newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]]
    setForm((f) => ({ ...f, steps: newSteps.map((s, i) => ({ ...s, order: i })) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      bucket: form.bucket,
      effort: form.effort,
      durationMins: form.durationMins,
      steps: form.steps.filter((s) => s.title.trim()),
    }

    try {
      if (isNew) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to create task')
          return
        }
        router.push('/tasks')
      } else {
        // Update task
        const res = await fetch(`/api/tasks/${params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: body.title, description: body.description, bucket: body.bucket, effort: body.effort, durationMins: body.durationMins }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to update task')
          return
        }
        // Update steps separately
        await fetch(`/api/tasks/${params.id}/steps`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps: form.steps.filter((s) => s.title.trim()) }),
        })
        router.push('/tasks')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-32 mb-8" />
        <div className="card p-6 space-y-4">
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tasks" className="text-text-muted hover:text-text transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-text">{isNew ? 'Add task' : 'Edit task'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="card p-5">
          <label htmlFor="title" className="label">What needs to get done?</label>
          <input
            id="title"
            type="text"
            className="input text-base"
            placeholder="e.g. Prepare board presentation"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            autoFocus
          />

          {form.title.trim() && !stepsGenerated && (
            <button
              type="button"
              onClick={handleGenerateSteps}
              className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Break this into steps
            </button>
          )}
        </div>

        {/* Steps */}
        {form.steps.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Steps</label>
              <span className="text-xs text-text-subtle">Drag to reorder</span>
            </div>

            <div className="space-y-2 mb-3">
              {form.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveStep(i, 'up')}
                      disabled={i === 0}
                      className="text-text-subtle hover:text-text disabled:opacity-20 p-0.5"
                      aria-label="Move step up"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 'down')}
                      disabled={i === form.steps.length - 1}
                      className="text-text-subtle hover:text-text disabled:opacity-20 p-0.5"
                      aria-label="Move step down"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>

                  <span className="text-xs text-text-subtle w-4 text-right flex-shrink-0">{i + 1}</span>

                  <input
                    type="text"
                    className="input flex-1 py-2"
                    value={step.title}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder={`Step ${i + 1}`}
                  />

                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="p-1.5 text-text-subtle hover:text-danger transition-colors"
                    aria-label="Remove step"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add step
            </button>
          </div>
        )}

        {form.steps.length === 0 && stepsGenerated === false && form.title.trim() && (
          <div className="card p-5">
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add steps manually
            </button>
          </div>
        )}

        {/* Bucket */}
        <div className="card p-5">
          <label className="label">When will you do this?</label>
          <div className="flex gap-2">
            {BUCKET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, bucket: opt.value }))}
                className={`flex-1 py-2.5 px-2 rounded border text-sm font-medium transition-all ${
                  form.bucket === opt.value
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'
                }`}
              >
                <div>{opt.label}</div>
                <div className={`text-xs mt-0.5 ${form.bucket === opt.value ? 'text-white/70' : 'text-text-subtle'}`}>
                  {opt.hint}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Effort + Duration */}
        <div className="card p-5 space-y-5">
          <div>
            <label className="label">Effort level</label>
            <div className="flex gap-2">
              {EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, effort: opt.value }))}
                  className={`flex-1 py-2 px-2 rounded border text-sm font-medium transition-all ${
                    form.effort === opt.value
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${form.effort === opt.value ? 'text-white/70' : 'text-text-subtle'}`}>
                    {opt.hint}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Estimated time</label>
            <div className="flex flex-wrap gap-2 items-center">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, durationMins: d })); setCustomDuration(false) }}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${
                    form.durationMins === d && !customDuration
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {d}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomDuration(!customDuration)}
                className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${
                  customDuration
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'
                }`}
              >
                Custom
              </button>
            </div>

            {customDuration && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  className="input w-24"
                  min={1}
                  max={480}
                  value={form.durationMins}
                  onChange={(e) => setForm((f) => ({ ...f, durationMins: Number(e.target.value) }))}
                />
                <span className="text-sm text-text-muted">minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="card p-5">
          <label htmlFor="description" className="label">
            Notes <span className="text-text-subtle font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            className="input resize-none"
            rows={3}
            placeholder="Any context, links, or details…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add task' : 'Save changes'}
          </button>
          <Link href="/tasks" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
