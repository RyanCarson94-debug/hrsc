import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export function AdminHome() {
  const [playbooks, setPlaybooks] = useState([])
  const [components, setComponents] = useState([])
  const [cases, setCases] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.listPlaybooks(true),
      api.listComponents(),
      api.listCases({ limit: 1 }),
    ]).then(([pbs, comps, cs]) => {
      setPlaybooks(pbs)
      setComponents(comps)
      setCases(cs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>

  const active = playbooks.filter(p => p.active)
  const inactive = playbooks.filter(p => !p.active)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Admin overview</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active playbooks" value={active.length} to="/admin/playbooks" />
        <StatCard label="Components" value={components.length} to="/admin/components" />
        <StatCard label="Total cases" value={cases.total} to="/admin/cases" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <QuickLink
          to="/admin/playbooks"
          title="Playbook builder"
          desc="Create and edit playbooks, intake fields, steps, and conditions."
        />
        <QuickLink
          to="/admin/playbooks"
          action="new"
          title="New playbook"
          desc="Start a new guided playbook from scratch."
        />
        <QuickLink
          to="/admin/components"
          title="Component library"
          desc="Browse and manage reusable instruction blocks."
        />
        <QuickLink
          to="/admin/cases"
          title="Case history"
          desc="View all adviser case sessions and their progress."
        />
      </div>

      {inactive.length > 0 && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800 font-medium mb-1">
            {inactive.length} inactive playbook{inactive.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-amber-700">
            {inactive.map(p => p.name).join(', ')} — activate them in the playbook editor.
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, to }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </Link>
  )
}

function QuickLink({ to, title, desc }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="font-semibold text-gray-900 group-hover:text-blue-700 mb-1">{title}</div>
      <div className="text-sm text-gray-500">{desc}</div>
    </Link>
  )
}
