import { useState, useMemo, useEffect } from 'react';
import { StatusBadge } from './Badge.jsx';

const SLOT_LABELS = ['🔴 Top Priority', '🟡 Medium Focus', '🟢 Quick Win'];

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function isOverdue(str) {
  if (!str) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(str + 'T00:00:00') < today;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`/api/workhq${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Request failed');
  return res.json();
}

export default function Dashboard({ tasks, updateTask }) {
  const [slots, setSlots] = useState([
    { slot_index: 0, task_id: null, done: 0, task_name: null },
    { slot_index: 1, task_id: null, done: 0, task_name: null },
    { slot_index: 2, task_id: null, done: 0, task_name: null },
  ]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [tickingSlot, setTickingSlot] = useState(null);

  useEffect(() => {
    apiFetch('/focus')
      .then(data => setSlots(data))
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, []);

  const kpis = useMemo(() => ({
    total:  tasks.length,
    active: tasks.filter(t => t.status === 'Active').length,
    done:   tasks.filter(t => t.status === 'Done').length,
    high:   tasks.filter(t => t.priority === 'High' && t.status !== 'Done').length,
  }), [tasks]);

  const highPriority = useMemo(
    () => tasks.filter(t => t.priority === 'High' && t.status !== 'Done'),
    [tasks]
  );

  const upcoming = useMemo(() => {
    return tasks
      .filter(t => t.due_date && t.status !== 'Done')
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }, [tasks]);

  const activeTasks = useMemo(
    () => tasks.filter(t => t.status !== 'Done'),
    [tasks]
  );

  async function handleSlotChange(slotIndex, taskId) {
    const updated = await apiFetch(`/focus/${slotIndex}`, {
      method: 'PUT',
      body: JSON.stringify({ task_id: taskId || null, done: 0 }),
    });
    setSlots(prev => prev.map(s => s.slot_index === slotIndex ? updated : s));
  }

  async function handleTick(slot) {
    if (!slot.task_id || slot.done) return;
    setTickingSlot(slot.slot_index);
    try {
      const updated = await apiFetch(`/focus/${slot.slot_index}`, {
        method: 'PUT',
        body: JSON.stringify({ task_id: slot.task_id, done: 1 }),
      });
      setSlots(prev => prev.map(s => s.slot_index === slot.slot_index ? updated : s));
      updateTask(slot.task_id, { status: 'Done' });
    } finally {
      setTickingSlot(null);
    }
  }

  const doneToday = kpis.done;
  const pctDone = kpis.total > 0 ? Math.round((doneToday / kpis.total) * 100) : 0;

  return (
    <div>
      {/* KPI bar */}
      <div className="kpi-bar">
        <div className="kpi-card kpi-total">
          <div className="kpi-label">📋 Total Tasks</div>
          <div className="kpi-value">{kpis.total}</div>
          <div className="kpi-sub">in your list</div>
        </div>
        <div className="kpi-card kpi-active">
          <div className="kpi-label">⚡ In Flight</div>
          <div className="kpi-value">{kpis.active}</div>
          <div className="kpi-sub">active right now</div>
        </div>
        <div className="kpi-card kpi-done">
          <div className="kpi-label">✅ Crushed It</div>
          <div className="kpi-value">{kpis.done}</div>
          <div className="kpi-sub">{pctDone}% complete</div>
        </div>
        <div className="kpi-card kpi-high">
          <div className="kpi-label">🔥 On Fire</div>
          <div className="kpi-value">{kpis.high}</div>
          <div className="kpi-sub">{kpis.high === 0 ? 'all clear! 🎉' : 'need attention'}</div>
        </div>
      </div>

      {/* Today's Focus */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon">🎯</span>
            Today's Focus
          </span>
          {slotsLoading && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</span>}
          {!slotsLoading && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {slots.filter(s => s.done).length}/3 done
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="focus-slots">
            {slots.map(slot => (
              <div
                key={slot.slot_index}
                className={`focus-slot slot-${slot.slot_index}${slot.done ? ' slot-done' : ''}`}
              >
                <span className="focus-slot-label">{SLOT_LABELS[slot.slot_index]}</span>
                <div className="focus-select-wrap">
                  {slot.done ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--emerald-text)' }}>
                      {slot.task_name}
                    </span>
                  ) : (
                    <select
                      className="focus-select"
                      value={slot.task_id ?? ''}
                      onChange={e => handleSlotChange(slot.slot_index, e.target.value)}
                    >
                      <option value="">— Pick a task —</option>
                      {activeTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="focus-status">
                  {slot.done ? '✅ Done!' : slot.task_id ? '🔄 In progress' : ''}
                </span>
                <button
                  className={`tick-btn${slot.done ? ' ticked' : ''}`}
                  onClick={() => handleTick(slot)}
                  disabled={!slot.task_id || !!slot.done || tickingSlot === slot.slot_index}
                  title="Mark done"
                >
                  ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="dash-grid">
        {/* High Priority Tasks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon">🔥</span>
              High Priority
            </span>
            <span className="badge badge-high">{highPriority.length} open</span>
          </div>
          <div className="card-body" style={{ padding: '6px 20px' }}>
            {highPriority.length === 0 ? (
              <p className="empty-state">🎉 Nothing urgent right now</p>
            ) : (
              <ul className="panel-list">
                {highPriority.map(t => (
                  <li key={t.id} className="panel-item">
                    <span className="panel-item-name" title={t.name}>{t.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{t.area}</span>
                    <StatusBadge value={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon">📅</span>
              Upcoming Deadlines
            </span>
            <span className="badge badge-medium">{upcoming.length}</span>
          </div>
          <div className="card-body" style={{ padding: '6px 20px' }}>
            {upcoming.length === 0 ? (
              <p className="empty-state">No upcoming deadlines</p>
            ) : (
              <ul className="panel-list">
                {upcoming.map(t => (
                  <li key={t.id} className="panel-item">
                    <span className="panel-item-name" title={t.name}>{t.name}</span>
                    <span className={`panel-item-date${isOverdue(t.due_date) ? ' overdue' : ''}`}>
                      {isOverdue(t.due_date) ? '⚠ ' : ''}{formatDate(t.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
