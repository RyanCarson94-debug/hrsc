'use client'

import { useState, useEffect, useCallback } from 'react'

interface Task {
  id: string
  title: string
  durationMins: number
}

interface Block {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  taskId: string | null
  task: Task | null
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function totalMinutes(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0)
}

const TIME_OPTIONS = [
  '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
  '19:00','19:30','20:00',
]

export default function CapacityPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [blocks, setBlocks] = useState<Block[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(todayStr())
  const [formStart, setFormStart] = useState('09:00')
  const [formEnd, setFormEnd] = useState('09:30')
  const [formTaskId, setFormTaskId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadBlocks = useCallback(async () => {
    setLoading(true)
    try {
      const from = selectedDate
      const to = addDays(selectedDate, 6)
      const res = await fetch(`/api/capacity?from=${from}&to=${to}`)
      setBlocks(await res.json())
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/tasks?status=ACTIVE')
    const data = await res.json()
    setTasks(data.map((t: Task) => ({ id: t.id, title: t.title, durationMins: t.durationMins })))
  }, [])

  useEffect(() => { loadBlocks(); loadTasks() }, [loadBlocks, loadTasks])

  // Group blocks by date
  const dates = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i))
  const byDate = (date: string) => blocks.filter((b) => b.date === date)

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (minutesBetween(formStart, formEnd) <= 0) {
      setFormError('End time must be after start time')
      return
    }
    setSaving(true)
    try {
      let title = formTitle.trim()
      if (!title && formTaskId) {
        const t = tasks.find((t) => t.id === formTaskId)
        if (t) title = t.title
      }
      if (!title) { setFormError('Title is required'); setSaving(false); return }

      const res = await fetch('/api/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          date: formDate,
          startTime: formStart,
          endTime: formEnd,
          taskId: formTaskId || null,
        }),
      })
      if (res.ok) {
        const block = await res.json()
        setBlocks((prev) => [...prev, block])
        setShowForm(false)
        setFormTitle('')
        setFormTaskId('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBlock(id: string) {
    await fetch(`/api/capacity?id=${id}`, { method: 'DELETE' })
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  async function handleExport() {
    const from = selectedDate
    const to = addDays(selectedDate, 6)
    const url = `/api/export/ics?from=${from}&to=${to}`
    const link = document.createElement('a')
    link.href = url
    link.download = 'focusflow-schedule.ics'
    link.click()
  }

  const weekTotal = totalMinutes(blocks.filter((b) => {
    return b.date >= selectedDate && b.date <= addDays(selectedDate, 6)
  }))
  const isOverloaded = weekTotal > 40 * 60 // 40 hours

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text">Plan</h1>
          <p className="text-text-muted text-sm mt-0.5">Scheduled focus blocks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export .ics
          </button>
          <button
            onClick={() => { setShowForm(true); setFormDate(selectedDate) }}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Add block
          </button>
        </div>
      </div>

      {/* Capacity summary */}
      <div className={`card p-4 mb-6 flex items-center gap-4 ${isOverloaded ? 'border-amber-200 bg-amber-50' : ''}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text">This week</span>
            {isOverloaded && (
              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-medium">
                Overloaded
              </span>
            )}
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-semibold text-text">{Math.round(weekTotal / 60)}h</span>
            <span className="text-text-muted text-sm mb-0.5"> planned</span>
          </div>
        </div>

        {isOverloaded && (
          <p className="text-sm text-amber-700 max-w-xs">
            You've scheduled a lot. Consider moving some blocks later.
          </p>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setSelectedDate((d) => addDays(d, -7))}
          className="btn-ghost p-2"
          aria-label="Previous week"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-medium text-text">
          {formatDate(selectedDate)} – {formatDate(addDays(selectedDate, 6))}
        </span>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 7))}
          className="btn-ghost p-2"
          aria-label="Next week"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          onClick={() => setSelectedDate(todayStr())}
          className="ml-auto btn-ghost text-sm text-primary"
        >
          Today
        </button>
      </div>

      {/* Days */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map((date) => {
            const dayBlocks = byDate(date)
            const isToday = date === todayStr()
            const dayTotal = totalMinutes(dayBlocks)

            return (
              <div key={date} className={`card p-4 ${isToday ? 'border-primary/30' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-text'}`}>
                      {formatDate(date)}
                    </span>
                    {isToday && <span className="text-xs bg-primary-light text-primary px-1.5 py-0.5 rounded font-medium">Today</span>}
                  </div>
                  {dayTotal > 0 && (
                    <span className="text-xs text-text-muted">{Math.round(dayTotal / 60)}h {dayTotal % 60}m planned</span>
                  )}
                </div>

                {dayBlocks.length === 0 ? (
                  <button
                    onClick={() => { setShowForm(true); setFormDate(date) }}
                    className="flex items-center gap-1.5 text-sm text-text-subtle hover:text-text-muted transition-colors py-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Add a focus block
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {dayBlocks.map((block) => (
                      <div key={block.id} className="flex items-center gap-3 group">
                        <div className="flex-shrink-0 text-xs text-text-subtle w-20">
                          {block.startTime}–{block.endTime}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="h-1 flex-shrink-0 w-1 rounded-full bg-primary" />
                            <span className="text-sm text-text truncate">{block.title}</span>
                          </div>
                          {block.task && (
                            <span className="text-xs text-text-muted ml-3">
                              Task: {block.task.title}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteBlock(block.id)}
                          className="p-1 text-text-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Remove block"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add block form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-modal w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <h2 className="text-base font-semibold text-text">Add focus block</h2>
              <button onClick={() => setShowForm(false)} className="text-text-subtle hover:text-text-muted p-1 rounded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddBlock} className="p-5 space-y-4">
              <div>
                <label className="label">Link to task (optional)</label>
                <select
                  className="input"
                  value={formTaskId}
                  onChange={(e) => {
                    setFormTaskId(e.target.value)
                    if (e.target.value) {
                      const t = tasks.find((t) => t.id === e.target.value)
                      if (t && !formTitle) setFormTitle(t.title)
                    }
                  }}
                >
                  <option value="">— Free block —</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Block title</label>
                <input
                  type="text"
                  className="input"
                  placeholder={formTaskId ? tasks.find((t) => t.id === formTaskId)?.title : 'e.g. Deep work'}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Start</label>
                  <select className="input" value={formStart} onChange={(e) => setFormStart(e.target.value)}>
                    {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">End</label>
                  <select className="input" value={formEnd} onChange={(e) => setFormEnd(e.target.value)}>
                    {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {formError && <p className="text-danger text-sm">{formError}</p>}

              <div className="flex gap-2.5">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Adding…' : 'Add block'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
