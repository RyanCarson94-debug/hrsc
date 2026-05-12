import { useState, useEffect, useCallback, useMemo } from 'react';
import { PriorityBadge, StatusBadge } from './Badge.jsx';

const AREAS    = ['HRSC Ops','Projects','People','Strategy','Admin','Other'];
const STATUSES = ['Upcoming','In Progress','Done'];

const STATUS_STYLE = {
  'Upcoming':    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'In Progress': { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'Done':        { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`/api/workhq${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Request failed');
  return res.json();
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function isToday(str) {
  if (!str) return false;
  return str === new Date().toISOString().slice(0, 10);
}

function isTomorrow(str) {
  if (!str) return false;
  const d = new Date(); d.setDate(d.getDate() + 1);
  return str === d.toISOString().slice(0, 10);
}

function isPast(str) {
  if (!str) return false;
  return str < new Date().toISOString().slice(0, 10);
}

function dateLabel(str) {
  if (!str) return '';
  if (isToday(str))    return '📅 Today';
  if (isTomorrow(str)) return '⏰ Tomorrow';
  if (isPast(str))     return `⚠ ${formatDate(str)}`;
  return formatDate(str);
}

// ─── Meeting List ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting, onSelect, onDelete }) {
  const s = STATUS_STYLE[meeting.status] ?? STATUS_STYLE['Upcoming'];
  const past = meeting.status !== 'Done' && isPast(meeting.date);

  return (
    <div
      className="meeting-card"
      onClick={() => onSelect(meeting)}
      style={{ opacity: meeting.status === 'Done' ? 0.6 : 1 }}
    >
      <div className="meeting-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="meeting-card-title">{meeting.title}</div>
          {meeting.attendees && (
            <div className="meeting-card-meta">👥 {meeting.attendees}</div>
          )}
        </div>
        <button
          className="btn-danger"
          onClick={e => { e.stopPropagation(); if (window.confirm('Delete meeting?')) onDelete(meeting.id); }}
          style={{ flexShrink: 0 }}
        >✕</button>
      </div>
      <div className="meeting-card-footer">
        {meeting.date && (
          <span className={`meeting-date-chip${past ? ' past' : ''}`}>
            {dateLabel(meeting.date)}
          </span>
        )}
        <span className="badge" style={{
          background: s.bg, color: s.text,
          border: `1.5px solid ${s.border}`, fontSize: 11
        }}>
          {meeting.status}
        </span>
        <span className="badge badge-todo" style={{ fontSize: 11 }}>{meeting.area}</span>
      </div>
    </div>
  );
}

// ─── Talking Point Row ────────────────────────────────────────────────────────

function TalkingPoint({ tp, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(tp.content);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft !== tp.content) onEdit(tp.id, draft.trim());
  }

  return (
    <div className={`tp-row${tp.done ? ' tp-done' : ''}`}>
      <button
        className={`tp-check${tp.done ? ' checked' : ''}`}
        onClick={() => onToggle(tp.id, !tp.done)}
        title={tp.done ? 'Mark undone' : 'Mark done'}
      >
        {tp.done ? '✓' : ''}
      </button>
      {editing ? (
        <input
          className="inline-input"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{ flex: 1 }}
        />
      ) : (
        <span
          className="tp-content"
          onClick={() => { setDraft(tp.content); setEditing(true); }}
        >
          {tp.content}
        </span>
      )}
      <button className="btn-danger" onClick={() => onDelete(tp.id)}>✕</button>
    </div>
  );
}

// ─── Meeting Detail ───────────────────────────────────────────────────────────

function MeetingDetail({ meetingId, tasks, onBack, onTaskCreated }) {
  const [meeting,  setMeeting]  = useState(null);
  const [tps,      setTps]      = useState([]);
  const [actions,  setActions]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [mode,     setMode]     = useState('prep'); // 'prep' | 'notes'
  const [newTp,    setNewTp]    = useState('');
  const [newAction,setNewAction]= useState('');
  const [addingTp, setAddingTp] = useState(false);
  const [addingAct,setAddingAct]= useState(false);
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/meetings/${meetingId}`);
      setMeeting(data);
      setTps(data.talking_points ?? []);
      setActions(data.actions ?? []);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  async function updateField(field, value) {
    setSaving(true);
    try {
      const updated = await apiFetch(`/meetings/${meetingId}`, {
        method: 'PUT', body: JSON.stringify({ [field]: value }),
      });
      setMeeting(updated);
    } finally {
      setSaving(false);
    }
  }

  async function addTp() {
    if (!newTp.trim()) return;
    setAddingTp(true);
    try {
      const tp = await apiFetch(`/meetings/${meetingId}/talking-points`, {
        method: 'POST', body: JSON.stringify({ content: newTp.trim() }),
      });
      setTps(prev => [...prev, tp]);
      setNewTp('');
    } finally {
      setAddingTp(false);
    }
  }

  async function toggleTp(tpId, done) {
    const updated = await apiFetch(`/meetings/${meetingId}/talking-points/${tpId}`, {
      method: 'PUT', body: JSON.stringify({ done }),
    });
    setTps(prev => prev.map(t => t.id === tpId ? updated : t));
  }

  async function deleteTp(tpId) {
    await apiFetch(`/meetings/${meetingId}/talking-points/${tpId}`, { method: 'DELETE' });
    setTps(prev => prev.filter(t => t.id !== tpId));
  }

  async function editTp(tpId, content) {
    const updated = await apiFetch(`/meetings/${meetingId}/talking-points/${tpId}`, {
      method: 'PUT', body: JSON.stringify({ content }),
    });
    setTps(prev => prev.map(t => t.id === tpId ? updated : t));
  }

  async function addAction() {
    if (!newAction.trim()) return;
    setAddingAct(true);
    try {
      const task = await apiFetch(`/meetings/${meetingId}/actions`, {
        method: 'POST', body: JSON.stringify({
          name: newAction.trim(), area: meeting?.area ?? 'Other',
        }),
      });
      setActions(prev => [...prev, task]);
      onTaskCreated(task);
      setNewAction('');
    } finally {
      setAddingAct(false);
    }
  }

  // Related tasks: same area as meeting, not done, not already an action
  const actionIds = new Set(actions.map(a => a.id));
  const relatedTasks = useMemo(() => {
    if (!meeting) return [];
    return tasks.filter(t =>
      t.area === meeting.area &&
      t.status !== 'Done' &&
      !actionIds.has(t.id) &&
      t.meeting_id !== meetingId
    ).slice(0, 6);
  }, [tasks, meeting, actionIds, meetingId]);

  const tpDone  = tps.filter(t => t.done).length;
  const s       = meeting ? (STATUS_STYLE[meeting.status] ?? STATUS_STYLE['Upcoming']) : {};

  if (loading) return (
    <div className="loading-state"><div className="loading-spinner" /></div>
  );

  if (!meeting) return <div className="error-banner">Meeting not found</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <EditableTitle
            value={meeting.title}
            onSave={v => updateField('title', v)}
          />
        </div>
        {saving && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Saving…</span>}
      </div>

      {/* Meeting meta bar */}
      <div className="meeting-meta-bar">
        <div className="meta-item">
          <span className="meta-label">📅 Date</span>
          <EditableInline value={meeting.date} type="date" onSave={v => updateField('date', v)} />
        </div>
        <div className="meta-item">
          <span className="meta-label">👥 Attendees</span>
          <EditableInline value={meeting.attendees} placeholder="Add attendees…" onSave={v => updateField('attendees', v)} />
        </div>
        <div className="meta-item">
          <span className="meta-label">🗂 Area</span>
          <EditableInline value={meeting.area} type="select" options={AREAS} onSave={v => updateField('area', v)} />
        </div>
        <div className="meta-item">
          <span className="meta-label">Status</span>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => {
              const order = STATUSES;
              const next = order[(order.indexOf(meeting.status) + 1) % order.length];
              updateField('status', next);
            }}
          >
            <span className="badge" style={{
              background: s.bg, color: s.text, border: `1.5px solid ${s.border}`
            }}>
              {meeting.status} ↻
            </span>
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="meeting-tabs">
        <button
          className={`meeting-tab${mode === 'prep' ? ' active' : ''}`}
          onClick={() => setMode('prep')}
        >
          📋 Prep {tpDone > 0 && `(${tpDone}/${tps.length})`}
        </button>
        <button
          className={`meeting-tab${mode === 'notes' ? ' active' : ''}`}
          onClick={() => setMode('notes')}
        >
          📝 Notes & Actions
        </button>
      </div>

      {/* Prep mode */}
      {mode === 'prep' && (
        <div className="meeting-body">
          <div className="meeting-col">
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon">🎯</span>
                  Talking Points
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {tpDone}/{tps.length} covered
                </span>
              </div>
              <div className="card-body" style={{ padding: '12px 20px' }}>
                {tps.length === 0 && (
                  <p className="empty-state" style={{ padding: '12px 0' }}>No talking points yet — add below</p>
                )}
                {tps.map(tp => (
                  <TalkingPoint
                    key={tp.id} tp={tp}
                    onToggle={toggleTp} onDelete={deleteTp} onEdit={editTp}
                  />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input
                    className="brain-dump-input"
                    value={newTp}
                    onChange={e => setNewTp(e.target.value)}
                    placeholder="Add a talking point…"
                    onKeyDown={e => { if (e.key === 'Enter') addTp(); }}
                    disabled={addingTp}
                  />
                  <button
                    className="btn-primary"
                    onClick={addTp}
                    disabled={!newTp.trim() || addingTp}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Prep notes */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon">💡</span>
                  Prep Notes
                </span>
              </div>
              <div className="card-body">
                <AutoSaveTextarea
                  value={meeting.prep_notes ?? ''}
                  placeholder="Anything to prepare before this meeting…"
                  onSave={v => updateField('prep_notes', v)}
                />
              </div>
            </div>
          </div>

          {/* Related tasks sidebar */}
          <div className="meeting-col meeting-col-sm">
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon">🔗</span>
                  Related Tasks
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{meeting.area}</span>
              </div>
              <div className="card-body" style={{ padding: '8px 20px' }}>
                {relatedTasks.length === 0 ? (
                  <p className="empty-state" style={{ padding: '12px 0' }}>No open tasks in {meeting.area}</p>
                ) : (
                  <ul className="panel-list">
                    {relatedTasks.map(t => (
                      <li key={t.id} className="panel-item" style={{ gap: 8 }}>
                        <span className="panel-item-name">{t.name}</span>
                        <StatusBadge value={t.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes mode */}
      {mode === 'notes' && (
        <div className="meeting-body">
          <div className="meeting-col">
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon">📝</span>
                  Meeting Notes
                </span>
              </div>
              <div className="card-body">
                <AutoSaveTextarea
                  value={meeting.notes ?? ''}
                  placeholder="Type your notes here… capture decisions, discussion points, anything worth remembering."
                  rows={12}
                  onSave={v => updateField('notes', v)}
                />
              </div>
            </div>
          </div>

          <div className="meeting-col meeting-col-sm">
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon">⚡</span>
                  Actions Captured
                </span>
                <span className="badge badge-active">{actions.length}</span>
              </div>
              <div className="card-body" style={{ padding: '12px 20px' }}>
                {actions.map(a => (
                  <div key={a.id} className="tp-row">
                    <span style={{ fontSize: 13 }}>→</span>
                    <span className="tp-content">{a.name}</span>
                    <StatusBadge value={a.status} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input
                    className="brain-dump-input"
                    value={newAction}
                    onChange={e => setNewAction(e.target.value)}
                    placeholder="Capture an action item…"
                    onKeyDown={e => { if (e.key === 'Enter') addAction(); }}
                    disabled={addingAct}
                  />
                  <button
                    className="btn-primary"
                    onClick={addAction}
                    disabled={!newAction.trim() || addingAct}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    → Task
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  Actions go straight into your Task List
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editable helpers ─────────────────────────────────────────────────────────

function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft !== value) onSave(draft.trim());
  }

  if (editing) return (
    <input
      className="inline-input"
      style={{ fontSize: 20, fontWeight: 800 }}
      value={draft}
      autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />
  );

  return (
    <h2
      className="section-title"
      style={{ cursor: 'text' }}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value}
    </h2>
  );
}

function EditableInline({ value, type = 'text', options, placeholder, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value ?? '');

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft || null);
  }

  const display = type === 'date' && value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : value;

  if (!editing) return (
    <span
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: value ? 'var(--text)' : 'var(--muted)' }}
      title="Click to edit"
    >
      {display || placeholder || '—'}
    </span>
  );

  if (type === 'select') return (
    <select className="inline-select" value={draft} autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onSave(draft); }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  if (type === 'date') return (
    <input type="date" className="inline-input" value={draft} autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />
  );

  return (
    <input type="text" className="inline-input" value={draft} autoFocus placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function AutoSaveTextarea({ value, placeholder, rows = 8, onSave }) {
  const [draft, setDraft] = useState(value ?? '');

  // Sync if parent updates
  useEffect(() => setDraft(value ?? ''), [value]);

  return (
    <textarea
      className="meeting-textarea"
      value={draft}
      rows={rows}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); }}
    />
  );
}

// ─── Main Meetings view ───────────────────────────────────────────────────────

export default function Meetings({ tasks, onTaskCreated }) {
  const [meetings,   setMeetings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [filterStat, setFilterStat] = useState('');
  const [adding,     setAdding]     = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/meetings');
      setMeetings(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setAdding(true);
    try {
      const m = await apiFetch('/meetings', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Meeting', status: 'Upcoming', area: 'Other' }),
      });
      setMeetings(prev => [m, ...prev]);
      setSelected(m.id);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    await apiFetch(`/meetings/${id}`, { method: 'DELETE' });
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selected === id) setSelected(null);
  }

  const filtered = useMemo(() => {
    if (!filterStat) return meetings;
    return meetings.filter(m => m.status === filterStat);
  }, [meetings, filterStat]);

  const upcoming = filtered.filter(m => m.status !== 'Done');
  const past     = filtered.filter(m => m.status === 'Done');

  if (selected) return (
    <MeetingDetail
      meetingId={selected}
      tasks={tasks}
      onBack={() => { setSelected(null); load(); }}
      onTaskCreated={onTaskCreated}
    />
  );

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Meetings</h2>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {upcoming.length} upcoming
        </span>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      <div className="task-toolbar">
        <span className="filter-label">Show:</span>
        {['', 'Upcoming', 'In Progress', 'Done'].map(s => (
          <button
            key={s}
            className={`btn-ghost${filterStat === s ? ' active' : ''}`}
            onClick={() => setFilterStat(s)}
          >
            {s || 'All'}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn-primary" onClick={handleAdd} disabled={adding}>
          {adding ? 'Adding…' : '+ New Meeting'}
        </button>
      </div>

      {loading && <div className="loading-state"><div className="loading-spinner" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          No meetings yet — add one above
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div>
          <div className="meetings-section-label">Upcoming & In Progress</div>
          <div className="meetings-grid">
            {upcoming.map(m => (
              <MeetingCard key={m.id} meeting={m} onSelect={m => setSelected(m.id)} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {!loading && past.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="meetings-section-label">Past Meetings</div>
          <div className="meetings-grid">
            {past.map(m => (
              <MeetingCard key={m.id} meeting={m} onSelect={m => setSelected(m.id)} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
