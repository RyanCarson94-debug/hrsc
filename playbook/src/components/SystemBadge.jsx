const SYSTEM_CONFIG = {
  workday:     { label: 'Workday',     classes: 'bg-orange-100 text-orange-800 border-orange-200' },
  servicenow:  { label: 'ServiceNow',  classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  email:       { label: 'Email',       classes: 'bg-blue-100 text-blue-800 border-blue-200' },
  manual:      { label: 'Manual',      classes: 'bg-gray-100 text-gray-700 border-gray-200' },
}

export function SystemBadge({ system, size = 'sm' }) {
  const cfg = SYSTEM_CONFIG[system] || SYSTEM_CONFIG.manual
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  return (
    <span className={`inline-flex items-center rounded border font-medium ${sizeClass} ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
