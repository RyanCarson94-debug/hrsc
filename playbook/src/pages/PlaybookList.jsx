import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export function PlaybookList() {
  const [playbooks, setPlaybooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  function load() {
    api.listPlaybooks(true)
      .then(setPlaybooks)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function createNew() {
    setCreating(true)
    try {
      const slug = `playbook-${Date.now()}`
      const pb = await api.createPlaybook({
        slug,
        name: 'Untitled Playbook',
        description: '',
        active: false,
      })
      navigate(`/admin/playbooks/${pb.id}`)
    } catch (e) {
      alert('Failed to create: ' + e.message)
      setCreating(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Playbooks</h1>
        <button
          onClick={createNew}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : '+ New playbook'}
        </button>
      </div>

      {playbooks.length === 0 ? (
        <div className="rounded-xl border border-violet-100 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500 text-sm mb-4">No playbooks yet.</p>
          <button onClick={createNew} className="text-violet-600 text-sm hover:underline">
            Create your first playbook →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {playbooks.map(pb => (
            <Link
              key={pb.id}
              to={`/admin/playbooks/${pb.id}`}
              className="flex items-center justify-between rounded-xl border border-violet-100 bg-white px-5 py-4 hover:border-violet-300 hover:shadow-sm transition-all group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 group-hover:text-violet-700">
                    {pb.name}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                      pb.active
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {pb.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  /{pb.slug}
                  {pb.description ? ` · ${pb.description}` : ''}
                </div>
              </div>
              <span className="text-gray-300 group-hover:text-violet-400 text-lg">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
