import { useState, useMemo } from 'react';
import { PriorityBadge, ProjectStatusBadge } from './Badge.jsx';

const PRIORITIES = ['High','Medium','Low'];
const STATUSES   = ['Planning','Active','On Hold','Complete'];

function EditableCell({ value, type = 'text', options, onSave, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft || null);
  }

  if (!editing) {
    return (
      <span
        className={className}
        onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        style={{ cursor: 'text', display: 'block', minHeight: 20 }}
        title="Click to edit"
      >
        {value || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{placeholder ?? '—'}</span>}
      </span>
    );
  }

  if (type === 'select') {
    return (
      <select
        className="inline-select"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft); }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input
      type="text"
      className="inline-input"
      value={draft ?? ''}
      autoFocus
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function ProjectRow({ project, onUpdate, onDelete }) {
  const isComplete = project.status === 'Complete';

  return (
    <tr className={isComplete ? 'row-done' : ''}>
      <td className="cell-name">
        <EditableCell
          value={project.name}
          className="cell-name-text"
          onSave={v => onUpdate(project.id, { name: v })}
        />
      </td>
      <td style={{ width: 80 }}>
        <EditableCell
          value={project.owner}
          onSave={v => onUpdate(project.id, { owner: v })}
        />
      </td>
      <td>
        <div
          onClick={() => {
            const next = { High: 'Medium', Medium: 'Low', Low: 'High' }[project.priority];
            onUpdate(project.id, { priority: next });
          }}
          style={{ cursor: 'pointer' }}
          title="Click to cycle priority"
        >
          <PriorityBadge value={project.priority} />
        </div>
      </td>
      <td>
        <div
          onClick={() => {
            const order = ['Planning','Active','On Hold','Complete'];
            const next = order[(order.indexOf(project.status) + 1) % order.length];
            onUpdate(project.id, { status: next });
          }}
          style={{ cursor: 'pointer' }}
          title="Click to cycle status"
        >
          <ProjectStatusBadge value={project.status} />
        </div>
      </td>
      <td style={{ width: 110 }}>
        <EditableCell
          value={project.deadline}
          placeholder="TBC"
          onSave={v => onUpdate(project.id, { deadline: v })}
        />
      </td>
      <td className="next-action-cell">
        <EditableCell
          value={project.next_action}
          placeholder="Add next action…"
          onSave={v => onUpdate(project.id, { next_action: v })}
        />
      </td>
      <td>
        <button
          className="btn-danger"
          onClick={() => {
            if (window.confirm('Delete this project?')) onDelete(project.id);
          }}
          title="Delete project"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function Projects({ projects, createProject, updateProject, deleteProject, error }) {
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [adding,         setAdding]         = useState(false);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (filterStatus)   list = list.filter(p => p.status === filterStatus);
    if (filterPriority) list = list.filter(p => p.priority === filterPriority);

    // Sort: incomplete first, by priority within status
    const pOrder = { High: 0, Medium: 1, Low: 2 };
    const sOrder = { Active: 0, Planning: 1, 'On Hold': 2, Complete: 3 };
    list.sort((a, b) => {
      const sd = (sOrder[a.status] ?? 4) - (sOrder[b.status] ?? 4);
      if (sd !== 0) return sd;
      return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
    });
    return list;
  }, [projects, filterStatus, filterPriority]);

  async function handleAdd() {
    setAdding(true);
    try {
      await createProject({ name: 'New Project', owner: 'Ryan', priority: 'Medium', status: 'Planning' });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Work Projects</h2>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      <div className="task-toolbar">
        <span className="filter-label">Filter:</span>
        <select className="filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-primary" onClick={handleAdd} disabled={adding}>
          {adding ? 'Adding…' : '+ Add Project'}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Project</th>
              <th style={{ width: 80 }}>Owner</th>
              <th>Priority</th>
              <th>Status</th>
              <th style={{ width: 110 }}>Deadline</th>
              <th style={{ minWidth: 220 }}>Next Action</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  No projects match the current filters
                </td>
              </tr>
            )}
            {filtered.map(project => (
              <ProjectRow
                key={project.id}
                project={project}
                onUpdate={updateProject}
                onDelete={deleteProject}
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
