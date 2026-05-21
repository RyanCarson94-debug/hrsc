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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Case history</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          No cases yet.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Playbook</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Adviser</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Details</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Progress</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Last updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map(c => {
                  const completed = JSON.parse(c.completed_steps || '[]').length
                  const intake = JSON.parse(c.intake_data || '{}')
                  const summaryKeys = ['termination_type', 'country', 'employee_type']
                  const summary = summaryKeys.map(k => intake[k]).filter(Boolean).join(' · ')

                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.playbook_name || c.playbook_id}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.created_by}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{summary || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{completed} step{completed !== 1 ? 's' : ''} done</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/play/${c.playbook_slug}/run?case=${c.id}`)}
                          className="text-xs text-blue-600 hover:underline"
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
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <button
                disabled={page === 0}
                onClick={() => load(page - 1)}
                className="px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300 disabled:opacity-40"
              >
                ← Previous
              </button>
              <span>Page {page + 1} of {Math.ceil(total / LIMIT)}</span>
              <button
                disabled={(page + 1) * LIMIT >= total}
                onClick={() => load(page + 1)}
                className="px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300 disabled:opacity-40"
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
