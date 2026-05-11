import { useState, useMemo } from 'react';
import { PriorityBadge, StatusBadge } from './Badge.jsx';

const AREAS     = ['HRSC Ops','Projects','People','Strategy','Admin','Other'];
const PRIORITIES = ['High','Medium','Low'];
const STATUSES  = ['To Do','Active','Done','Blocked','Delegated'];

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(str) {
  if (!str) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(str + 'T00:00:00') < today;
}

function EditableCell({ value, type = 'text', options, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft || null);
  }

  if (!editing) {
    const display = type === 'date' && value ? formatDate(value) : value;
    return (
      <span
        className={className}
        onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        style={{ cursor: 'text', display: 'block', minHeight: 20 }}
        title="Click to edit"
      >
        {display || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
      </span>
    );
  }

  if (type === 'select') {
    return (
      <select
        className="inline-select"
        value={draft}
        autoFocus
        onChange={e => { setDraft(e.target.value); }}
        onBlur={() => { setEditing(false); onSave(draft); }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        className="inline-input"
        value={draft ?? ''}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }

  return (
    <input
      type="text"
      className="inline-input"
      value={draft ?? ''}
      autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function TaskRow({ task, onUpdate, onDelete }) {
  const isDone = task.status === 'Done';

  return (
    <tr className={isDone ? 'row-done' : ''}>
      <td className="cell-name">
        <EditableCell
          value={task.name}
          className="cell-name-text"
          onSave={v => onUpdate(task.id, { name: v })}
        />
      </td>
      <td>
        <EditableCell
          value={task.area}
          type="select"
          options={AREAS}
          onSave={v => onUpdate(task.id, { area: v })}
        />
      </td>
      <td>
        <div
          onClick={() => {
            const next = { High: 'Medium', Medium: 'Low', Low: 'High' }[task.priority];
            onUpdate(task.id, { priority: next });
          }}
          style={{ cursor: 'pointer' }}
          title="Click to cycle priority"
        >
          <PriorityBadge value={task.priority} />
        </div>
      </td>
      <td>
        <div
          onClick={() => {
            const order = ['To Do','Active','Done','Blocked','Delegated'];
            const next = order[(order.indexOf(task.status) + 1) % order.length];
            onUpdate(task.id, { status: next });
          }}
          style={{ cursor: 'pointer' }}
          title="Click to cycle status"
        >
          <StatusBadge value={task.status} />
        </div>
      </td>
      <td>
        <EditableCell
          value={task.due_date}
          type="date"
          className={`date-cell${task.due_date && isOverdue(task.due_date) && !isDone ? ' overdue' : ''}`}
          onSave={v => onUpdate(task.id, { due_date: v || null })}
        />
      </td>
      <td>
        <EditableCell
          value={task.notes}
          className="notes-cell"
          onSave={v => onUpdate(task.id, { notes: v })}
        />
      </td>
      <td>
        <button
          className="btn-danger"
          onClick={() => {
            if (window.confirm('Delete this task?')) onDelete(task.id);
          }}
          title="Delete task"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function TaskList({ tasks, createTask, updateTask, deleteTask, error }) {
  const [filterArea,     setFilterArea]     = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [sortBy,         setSortBy]         = useState('');
  const [adding,         setAdding]         = useState(false);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (filterArea)     list = list.filter(t => t.area === filterArea);
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (filterStatus)   list = list.filter(t => t.status === filterStatus);

    if (sortBy === 'due_date') {
      list.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
    } else if (sortBy === 'priority') {
      const order = { High: 0, Medium: 1, Low: 2 };
      list.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    } else if (sortBy === 'status') {
      const order = { Active: 0, 'To Do': 1, Blocked: 2, Delegated: 3, Done: 4 };
      list.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
    }

    return list;
  }, [tasks, filterArea, filterPriority, filterStatus, sortBy]);

  async function handleAdd() {
    setAdding(true);
    try {
      await createTask({ name: 'New task', area: 'Other', priority: 'Medium', status: 'To Do' });
    } finally {
      setAdding(false);
    }
  }

  function sortToggle(field) {
    setSortBy(prev => prev === field ? '' : field);
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Task List</h2>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      <div className="task-toolbar">
        <span className="filter-label">Filter:</span>
        <select className="filter-select" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">All areas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="filter-label" style={{ marginLeft: 8 }}>Sort:</span>
        <button
          className={`btn-ghost${sortBy === 'due_date' ? ' active' : ''}`}
          onClick={() => sortToggle('due_date')}
        >
          Due Date
        </button>
        <button
          className={`btn-ghost${sortBy === 'priority' ? ' active' : ''}`}
          onClick={() => sortToggle('priority')}
        >
          Priority
        </button>
        <button
          className={`btn-ghost${sortBy === 'status' ? ' active' : ''}`}
          onClick={() => sortToggle('status')}
        >
          Status
        </button>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-primary" onClick={handleAdd} disabled={adding}>
          {adding ? 'Adding…' : '+ Add Task'}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Task</th>
              <th>Area</th>
              <th className="sortable" onClick={() => sortToggle('priority')}>
                Priority {sortBy === 'priority' ? '↑' : ''}
              </th>
              <th className="sortable" onClick={() => sortToggle('status')}>
                Status {sortBy === 'status' ? '↑' : ''}
              </th>
              <th className="sortable" onClick={() => sortToggle('due_date')}>
                Due {sortBy === 'due_date' ? '↑' : ''}
              </th>
              <th style={{ minWidth: 160 }}>Notes</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  No tasks match the current filters
                </td>
              </tr>
            )}
            {filtered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onUpdate={updateTask}
                onDelete={deleteTask}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
        Click any cell to edit inline. Click priority or status badges to cycle values.
      </p>
    </div>
  );
}
