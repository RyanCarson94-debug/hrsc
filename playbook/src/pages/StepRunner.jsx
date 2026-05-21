import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { evaluateConditions } from '../lib/conditions.js'
import { SystemBadge } from '../components/SystemBadge.jsx'
import { MarkdownContent } from '../components/MarkdownContent.jsx'

export function StepRunner() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const caseId = searchParams.get('case')

  const [playbook, setPlaybook] = useState(null)
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedPrev, setExpandedPrev] = useState({})
  const [skippingRequired, setSkippingRequired] = useState(null) // step id that is required but user tried to skip
  const activeRef = useRef(null)

  useEffect(() => {
    if (!caseId) { navigate(`/play/${slug}`, { replace: true }); return }
    Promise.all([
      api.getCase(caseId),
    ]).then(async ([c]) => {
      setCaseData(c)
      const pb = await api.getPlaybook(c.playbook_id)
      setPlaybook(pb)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [caseId, slug, navigate])

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [caseData?.completed_steps])

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading case…</div>
  if (error)   return <div className="p-8 text-red-600 text-sm">Error: {error}</div>
  if (!playbook || !caseData) return null

  const intakeData = JSON.parse(caseData.intake_data || '{}')
  const completedSteps = JSON.parse(caseData.completed_steps || '[]')

  const allSteps = playbook.steps || []
  const applicableSteps = allSteps.filter(s =>
    evaluateConditions(s.conditions, intakeData)
  )

  const totalApplicable = applicableSteps.length
  const completedCount = completedSteps.filter(id => applicableSteps.some(s => s.id === id)).length
  const allDone = completedCount === totalApplicable
  const progress = totalApplicable > 0 ? Math.round((completedCount / totalApplicable) * 100) : 100

  // Find the first incomplete applicable step = the active step
  const activeStep = applicableSteps.find(s => !completedSteps.includes(s.id))

  async function markComplete(stepId) {
    if (saving) return
    const step = applicableSteps.find(s => s.id === stepId)

    // If skipping required step, warn first
    if (step && step.required && step.id === activeStep?.id) {
      // They clicked Mark Complete on the active step — that's normal, allow it
    }

    setSaving(true)
    const next = [...completedSteps, stepId]
    try {
      await api.updateCase(caseId, { completed_steps: next })
      setCaseData(d => ({ ...d, completed_steps: JSON.stringify(next) }))
      setSkippingRequired(null)
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function undoStep(stepId) {
    if (saving) return
    setSaving(true)
    const next = completedSteps.filter(id => id !== stepId)
    try {
      await api.updateCase(caseId, { completed_steps: next })
      setCaseData(d => ({ ...d, completed_steps: JSON.stringify(next) }))
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
        >
          ← Back to home
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{playbook.name}</h1>
            <div className="text-sm text-gray-500 mt-0.5">
              {completedCount} of {totalApplicable} steps complete
              {Object.entries(intakeData).map(([k, v]) => v ? (
                <span key={k} className="ml-2 text-gray-400">· {v}</span>
              ) : null)}
            </div>
          </div>
          {allDone && (
            <span className="text-xs font-medium bg-green-100 text-green-800 border border-green-200 rounded px-2 py-0.5">
              ✓ Complete
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-3">
        {applicableSteps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id)
          const isActive = step.id === activeStep?.id

          if (isCompleted) {
            const isExpanded = expandedPrev[step.id]
            return (
              <div
                key={step.id}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setExpandedPrev(p => ({ ...p, [step.id]: !p[step.id] }))}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm text-gray-500 line-through truncate">{step.title}</span>
                    <SystemBadge system={step.system} size="xs" />
                  </div>
                  <span className="text-gray-300 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="mt-3">
                      <MarkdownContent>{step.body}</MarkdownContent>
                    </div>
                    <button
                      onClick={() => undoStep(step.id)}
                      disabled={saving}
                      className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Undo — mark as incomplete
                    </button>
                  </div>
                )}
              </div>
            )
          }

          if (isActive) {
            return (
              <div
                key={step.id}
                ref={activeRef}
                className="rounded-lg border-2 border-blue-400 bg-white shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h2 className="font-semibold text-gray-900 text-sm">{step.title}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <SystemBadge system={step.system} />
                    {step.required ? (
                      <span className="text-xs text-red-600 font-medium">Required</span>
                    ) : (
                      <span className="text-xs text-gray-400">Optional</span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <MarkdownContent>{step.body}</MarkdownContent>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => markComplete(step.id)}
                      disabled={saving}
                      className="px-5 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Mark complete ✓'}
                    </button>
                    {!step.required && (
                      <button
                        onClick={() => markComplete(step.id)}
                        disabled={saving}
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        Skip (optional)
                      </button>
                    )}
                    {step.required && skippingRequired === step.id && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-700">This step is required. Complete it before continuing.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          }

          // Upcoming step (not active, not complete)
          return (
            <div
              key={step.id}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3 opacity-50"
            >
              <span className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-sm text-gray-500 flex-1">{step.title}</span>
              <SystemBadge system={step.system} size="xs" />
            </div>
          )
        })}
      </div>

      {allDone && (
        <div className="mt-8 rounded-lg bg-green-50 border border-green-200 p-6 text-center">
          <div className="text-3xl mb-2">✅</div>
          <h3 className="font-semibold text-green-900 text-lg">All steps complete</h3>
          <p className="text-sm text-green-700 mt-1">
            This case has been fully processed. All actions have been recorded.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded bg-green-700 text-white text-sm font-medium hover:bg-green-800"
          >
            Back to home
          </button>
        </div>
      )}
    </div>
  )
}
