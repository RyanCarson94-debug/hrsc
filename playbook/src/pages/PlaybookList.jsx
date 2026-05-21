import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export function PlaybookList() {
  const [playbooks, setPlaybooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  function load() {
    api.listPlaybooks(true).then(setPlaybooks).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function createNew() {
    setCreating(true)
    try {
      const slug = `playbook-${Date.now()}`
      const pb = await api.createPlaybook({ slug, name: 'Untitled Playbook', description: '', active: false })
      navigate(`/admin/playbooks/${pb.id}`)
    } catch (e) {
      alert('Failed to create: ' + e.message)
      setCreating(false)
    }
  }

  if (loading) return <div className="p-8 text-csl-gray3 text-sm">Loading…</div>

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-csl-black">Playbooks</h1>
        <button
          onClick={createNew}
          disabled={creating}
          className="px-4 py-2 rounded bg-csl-red text-white text-sm font-bold hover:bg-csl-red-dark disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : '+ New Playbook'}
        </button>
      </div>

      {playbooks.length === 0 ? (
        <div className="rounded border border-csl-gray2 bg-white p-12 text-center">
          <p className="text-csl-gray3 text-sm mb-4 font-light">No playbooks yet.</p>
          <button onClick={createNew} className="text-csl-red text-sm font-semibold hover:underline">
            Create your first playbook →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {playbooks.map(pb => (
            <Link
              key={pb.id}
              to={`/admin/playbooks/${pb.id}`}
              className="flex items-center justify-between rounded border border-csl-gray2 bg-white px-5 py-4 hover:border-csl-red hover:shadow-sm transition-all group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-csl-black group-hover:text-csl-red">
                    {pb.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${
                    pb.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-csl-gray1 text-csl-gray3 border-csl-gray2'
                  }`}>
                    {pb.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs text-csl-gray3 mt-0.5 font-light">
                  /{pb.slug}{pb.description ? ` · ${pb.description}` : ''}
                </div>
              </div>
              <span className="text-csl-gray2 group-hover:text-csl-red text-lg transition-colors">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
