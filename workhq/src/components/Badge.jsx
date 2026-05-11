export function PriorityBadge({ value }) {
  const map = {
    High:   { cls: 'badge-high',   label: 'High' },
    Medium: { cls: 'badge-medium', label: 'Medium' },
    Low:    { cls: 'badge-low',    label: 'Low' },
  };
  const { cls, label } = map[value] ?? { cls: 'badge-todo', label: value };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function StatusBadge({ value }) {
  const map = {
    'To Do':     { cls: 'badge-todo',      label: 'To Do' },
    'Active':    { cls: 'badge-active',    label: 'Active' },
    'Done':      { cls: 'badge-done',      label: 'Done' },
    'Blocked':   { cls: 'badge-blocked',   label: 'Blocked' },
    'Delegated': { cls: 'badge-delegated', label: 'Delegated' },
  };
  const { cls, label } = map[value] ?? { cls: 'badge-todo', label: value };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function ProjectStatusBadge({ value }) {
  const map = {
    'Planning':  { cls: 'badge-medium',   label: 'Planning' },
    'Active':    { cls: 'badge-active',   label: 'Active' },
    'On Hold':   { cls: 'badge-blocked',  label: 'On Hold' },
    'Complete':  { cls: 'badge-done',     label: 'Complete' },
  };
  const { cls, label } = map[value] ?? { cls: 'badge-todo', label: value };
  return <span className={`badge ${cls}`}>{label}</span>;
}
