import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export function CaseHistory() {
  const [cases, setCases] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const LIMIT = 20
  const navigate = useNavigate()

  function load(p = 0) {
    setLoading(true)
    api.listCases({ limit: LIMIT, offset: p * LIMIT })
      .then(({ cases: cs, total: t }) => {
        setCases(cs)
        setTotal(t)
        setPage(p)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-csl-black">Case History</h1>
        <span className="text-sm text-csl-gray3 font-light">{total} total</span>
      </div>

      {loading ? (
        <div className="text-sm text-csl-gray3">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="rounded border border-dashed border-csl-gray2 p-10 text-center text-csl-gray3 text-sm font-light">
          No cases yet.
        </div>
      ) : (
        <>
          <div className="bg-white rounded border border-csl-gray2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-csl-gray2 bg-csl-gray1">
                  <th className="text-left px-4 py-3 font-bold text-csl-black text-xs uppercase tracking-wide">Playbook</th>
                  <th className="text-left px-4 py-3 font-bold text-csl-black text-xs uppercase tracking-wide">Adviser</th>
                  <th className="text-left px-4 py-3 font-bold text-csl-black text-xs uppercase tracking-wide">Details</th>
                  <th className="text-left px-4 py-3 font-bold text-csl-black text-xs uppercase tracking-wide">Progress</th>
                  <th className="text-left px-4 py-3 font-bold text-csl-black text-xs uppercase tracking-wide">Last Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-csl-gray1">
                {cases.map(c => {
                  const completed = JSON.parse(c.completed_steps || '[]').length
                  const intake = JSON.parse(c.intake_data || '{}')
                  const summaryKeys = ['termination_type', 'country', 'employee_type']
                  const summary = summaryKeys.map(k => intake[k]).filter(Boolean).join(' · ')

                  return (
                    <tr key={c.id} className="hover:bg-csl-gray1 transition-colors">
                      <td className="px-4 py-3 font-semibold text-csl-black">{c.playbook_name || c.playbook_id}</td>
                      <td className="px-4 py-3 text-csl-gray3 text-xs font-light">{c.created_by}</td>
                      <td className="px-4 py-3 text-csl-gray3 text-xs font-light">{summary || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-csl-gray3 font-light">{completed} step{completed !== 1 ? 's' : ''} done</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-csl-gray3 font-light">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/play/${c.playbook_slug}/run?case=${c.id}`)}
                          className="text-xs text-csl-red hover:underline font-semibold"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > LIMIT && (
            <div className="mt-4 flex items-center justify-between text-sm text-csl-gray3">
              <button
                disabled={page === 0}
                onClick={() => load(page - 1)}
                className="px-3 py-1.5 rounded border border-csl-gray2 hover:border-csl-red disabled:opacity-40 font-semibold text-xs transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs font-light">Page {page + 1} of {Math.ceil(total / LIMIT)}</span>
              <button
                disabled={(page + 1) * LIMIT >= total}
                onClick={() => load(page + 1)}
                className="px-3 py-1.5 rounded border border-csl-gray2 hover:border-csl-red disabled:opacity-40 font-semibold text-xs transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
