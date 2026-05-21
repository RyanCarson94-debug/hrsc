import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export function AdviserHome({ user }) {
  const [playbooks, setPlaybooks] = useState([])
  const [recentCases, setRecentCases] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.listPlaybooks(),
      api.listCases({ mine: 'true', limit: 5 }),
    ]).then(([pbs, { cases }]) => {
      setPlaybooks(pbs)
      setRecentCases(cases)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-csl-gray3 text-sm">Loading…</div>

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-csl-black mb-1">
          Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-csl-gray3 text-sm">Select a playbook to start a guided HR case.</p>
      </div>

      {playbooks.length === 0 ? (
        <div className="rounded border border-csl-gray2 bg-white p-10 text-center text-csl-gray3 text-sm">
          No active playbooks yet. Ask your admin to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {playbooks.map(pb => (
            <button
              key={pb.id}
              onClick={() => navigate(`/play/${pb.slug}`)}
              className="w-full text-left rounded border border-csl-gray2 bg-white p-5 hover:border-csl-red hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-csl-black group-hover:text-csl-red">
                    {pb.name}
                  </div>
                  {pb.description && (
                    <div className="text-sm text-csl-gray3 mt-0.5 font-light">{pb.description}</div>
                  )}
                </div>
                <span className="text-csl-gray2 group-hover:text-csl-red text-lg ml-4 transition-colors">→</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {recentCases.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-bold text-csl-gray3 uppercase tracking-widest mb-3">
            Resume In-Progress Cases
          </h2>
          <div className="space-y-2">
            {recentCases.map(c => {
              const completed = JSON.parse(c.completed_steps || '[]').length
              const intake = JSON.parse(c.intake_data || '{}')
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/play/${c.playbook_slug}/run?case=${c.id}`)}
                  className="w-full text-left rounded border border-csl-gray2 bg-white px-4 py-3 hover:border-csl-red hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-semibold text-csl-black group-hover:text-csl-red">
                      {c.playbook_name}
                    </div>
                    <div className="text-xs text-csl-gray3 mt-0.5 font-light">
                      {completed} step{completed !== 1 ? 's' : ''} completed ·{' '}
                      {new Date(c.updated_at).toLocaleDateString()}
                      {intake.termination_type ? ` · ${intake.termination_type}` : ''}
                      {intake.country ? ` · ${intake.country}` : ''}
                    </div>
                  </div>
                  <span className="text-xs text-csl-red font-semibold group-hover:underline">Resume →</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
