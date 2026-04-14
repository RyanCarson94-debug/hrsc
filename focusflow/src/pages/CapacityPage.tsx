import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiFetch, apiDelete } from '../lib/api'
import { ScheduledBlock, Task } from '../lib/types'

const today = () => new Date().toISOString().split('T')[0]
const addDays = (d: string, n: number) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0] }
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const minsBetween = (s: string, e: string) => { const [sh,sm] = s.split(':').map(Number); const [eh,em] = e.split(':').map(Number); return (eh*60+em)-(sh*60+sm) }
const TIMES = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00']

export function CapacityPage() {
  const [weekStart, setWeekStart] = useState(today())
  const [blocks, setBlocks] = useState<ScheduledBlock[]>([])
  const [tasks, setTasks] = useState<Pick<Task,'id'|'title'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(today())
  const [formStart, setFormStart] = useState('09:00')
  const [formEnd, setFormEnd] = useState('09:30')
  const [formTaskId, setFormTaskId] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadBlocks = useCallback(async () => {
    setLoading(true)
    try { setBlocks(await apiGet<ScheduledBlock[]>(`/capacity?from=${weekStart}&to=${addDays(weekStart, 6)}`)) }
    finally { setLoading(false) }
  }, [weekStart])

  const loadTasks = useCallback(async () => {
    try { setTasks(await apiGet<Pick<Task,'id'|'title'>[]>('/tasks?status=ACTIVE')) }
    catch { /* ignore */ }
  }, [])

  useEffect(() => { loadBlocks(); loadTasks() }, [loadBlocks, loadTasks])

  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const byDate = (d: string) => blocks.filter(b => b.date === d)
  const weekMins = blocks.reduce((s, b) => s + minsBetween(b.start_time, b.end_time), 0)
  const overloaded = weekMins > 40 * 60

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (minsBetween(formStart, formEnd) <= 0) { setFormError('End time must be after start time'); return }
    let title = formTitle.trim()
    if (!title) { title = tasks.find(t => t.id === formTaskId)?.title ?? ''; }
    if (!title) { setFormError('Title is required'); return }
    setSaving(true)
    try {
      const res = await apiFetch('/capacity', { method: 'POST', body: JSON.stringify({ title, date: formDate, start_time: formStart, end_time: formEnd, task_id: formTaskId || null }) })
      if (res.ok) {
        const b = await res.json()
        setBlocks(prev => [...prev, b])
        setShowForm(false); setFormTitle(''); setFormTaskId('')
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/capacity?id=${id}`, { method: 'DELETE' })
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  async function handleExport() {
    const a = document.createElement('a')
    a.href = `/api/focusflow/export/ics?from=${weekStart}&to=${addDays(weekStart, 6)}`
    a.download = 'focusflow-schedule.ics'
    // Attach bearer token via a form or direct fetch
    const res = await fetch(a.href, { headers: { Authorization: `Bearer ${localStorage.getItem('ff_token')}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text">Plan</h1>
          <p className="text-text-muted text-sm mt-0.5">Scheduled focus blocks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export .ics
          </button>
          <button onClick={() => { setShowForm(true); setFormDate(weekStart) }} className="btn-primary text-sm flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add block
          </button>
        </div>
      </div>

      {/* Capacity summary */}
      <div className={`card p-4 mb-6 flex items-center gap-4 ${overloaded ? 'border-amber-200 bg-amber-50' : ''}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text">This week</span>
            {overloaded && <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-medium">Overloaded</span>}
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-semibold text-text">{Math.floor(weekMins / 60)}h {weekMins % 60}m</span>
            <span className="text-text-muted text-sm mb-0.5"> planned</span>
          </div>
        </div>
        {overloaded && <p className="text-sm text-amber-700 max-w-xs">You've scheduled a lot. Consider moving some blocks later.</p>}
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setWeekStart(d => addDays(d, -7))} className="btn-ghost p-2" aria-label="Previous week">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-sm font-medium text-text">{fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}</span>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} className="btn-ghost p-2" aria-label="Next week">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button onClick={() => setWeekStart(today())} className="ml-auto btn-ghost text-sm text-primary">Today</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="card p-4 h-20 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {dates.map(date => {
            const dayBlocks = byDate(date)
            const isToday = date === today()
            const dayMins = dayBlocks.reduce((s, b) => s + minsBetween(b.start_time, b.end_time), 0)
            return (
              <div key={date} className={`card p-4 ${isToday ? 'border-primary/30' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-text'}`}>{fmtDate(date)}</span>
                    {isToday && <span className="text-xs bg-primary-light text-primary px-1.5 py-0.5 rounded font-medium">Today</span>}
                  </div>
                  {dayMins > 0 && <span className="text-xs text-text-muted">{Math.floor(dayMins/60)}h {dayMins%60}m</span>}
                </div>
                {dayBlocks.length === 0 ? (
                  <button onClick={() => { setShowForm(true); setFormDate(date) }} className="flex items-center gap-1.5 text-sm text-text-subtle hover:text-text-muted transition-colors py-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    Add a focus block
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {dayBlocks.map(b => (
                      <div key={b.id} className="flex items-center gap-3 group">
                        <span className="text-xs text-text-subtle w-20 flex-shrink-0">{b.start_time}–{b.end_time}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                            <span className="text-sm text-text truncate">{b.title}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDelete(b.id)} className="p-1 text-text-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition-all">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
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

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-modal w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <h2 className="text-base font-semibold text-text">Add focus block</h2>
              <button onClick={() => setShowForm(false)} className="text-text-subtle hover:text-text-muted p-1 rounded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="label">Link to task (optional)</label>
                <select className="input" value={formTaskId} onChange={e => { setFormTaskId(e.target.value); if (!formTitle && e.target.value) setFormTitle(tasks.find(t => t.id === e.target.value)?.title ?? '') }}>
                  <option value="">— Free block —</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Block title</label>
                <input type="text" className="input" placeholder="e.g. Deep work" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={formDate} onChange={e => setFormDate(e.target.value)} required />
              </div>
              <div className="flex gap-3">
                <div className="flex-1"><label className="label">Start</label>
                  <select className="input" value={formStart} onChange={e => setFormStart(e.target.value)}>{TIMES.map(t => <option key={t}>{t}</option>)}</select>
                </div>
                <div className="flex-1"><label className="label">End</label>
                  <select className="input" value={formEnd} onChange={e => setFormEnd(e.target.value)}>{TIMES.map(t => <option key={t}>{t}</option>)}</select>
                </div>
              </div>
              {formError && <p className="text-danger text-sm">{formError}</p>}
              <div className="flex gap-2.5">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Adding…' : 'Add block'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
