import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { evaluateConditions } from '../lib/conditions.js'
import { triggerDovetailIntent, clearDovetailSession } from '../lib/dovetail.js'
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
  const [skippingRequired, setSkippingRequired] = useState(null)
  const [copilotFiring, setCopilotFiring] = useState(null)
  const [sessionClearing, setSessionClearing] = useState(false)
  const activeRef = useRef(null)

  useEffect(() => {
    if (!caseId) { navigate(`/play/${slug}`, { replace: true }); return }
    Promise.all([api.getCase(caseId)]).then(async ([c]) => {
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

  if (loading) return <div className="p-8 text-csl-gray3 text-sm">Loading case…</div>
  if (error)   return <div className="p-8 text-red-600 text-sm">Error: {error}</div>
  if (!playbook || !caseData) return null

  const intakeData = JSON.parse(caseData.intake_data || '{}')
  const completedSteps = JSON.parse(caseData.completed_steps || '[]')
  const allSteps = playbook.steps || []
  const applicableSteps = allSteps.filter(s => evaluateConditions(s.conditions, intakeData))

  const totalApplicable = applicableSteps.length
  const completedCount = completedSteps.filter(id => applicableSteps.some(s => s.id === id)).length
  const allDone = completedCount === totalApplicable
  const progress = totalApplicable > 0 ? Math.round((completedCount / totalApplicable) * 100) : 100
  const activeStep = applicableSteps.find(s => !completedSteps.includes(s.id))

  async function markComplete(stepId) {
    if (saving) return
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

  async function fireCopilot(step) {
    setCopilotFiring(step.id)
    try {
      await triggerDovetailIntent(step.dovetail_intent, { newSession: true })
    } finally {
      setCopilotFiring(null)
    }
  }

  async function resetCopilotSession() {
    setSessionClearing(true)
    try {
      await clearDovetailSession()
    } finally {
      setSessionClearing(false)
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
    <div className="max-w-3xl mx-auto px-5 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-csl-gray3 hover:text-csl-red mb-3 flex items-center gap-1 transition-colors font-semibold"
        >
          ← Back to Home
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-csl-black">{playbook.name}</h1>
            <div className="text-sm text-csl-gray3 mt-0.5 font-light">
              {completedCount} of {totalApplicable} steps complete
              {Object.entries(intakeData).map(([k, v]) => v ? (
                <span key={k} className="ml-2">· {v}</span>
              ) : null)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {allDone && (
              <span className="text-xs font-bold bg-green-100 text-green-800 border border-green-200 rounded px-3 py-1">
                ✓ Complete
              </span>
            )}
            <button
              onClick={resetCopilotSession}
              disabled={sessionClearing}
              title="Start a new Copilot conversation"
              className="text-xs text-csl-gray3 hover:text-csl-black border border-csl-gray2 hover:border-csl-black rounded px-2.5 py-1 font-semibold transition-colors disabled:opacity-40"
            >
              {sessionClearing ? 'Resetting…' : '💬 New Session'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-csl-gray2 rounded-full overflow-hidden">
          <div
            className="h-full bg-csl-red rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {applicableSteps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id)
          const isActive = step.id === activeStep?.id

          if (isCompleted) {
            const isExpanded = expandedPrev[step.id]
            return (
              <div key={step.id} className="rounded border border-csl-gray2 bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedPrev(p => ({ ...p, [step.id]: !p[step.id] }))}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-csl-gray1"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">✓</span>
                    <span className="text-sm text-csl-gray3 line-through truncate font-light">{step.title}</span>
                    <SystemBadge system={step.system} size="xs" />
                  </div>
                  <span className="text-csl-gray3 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-csl-gray2">
                    <div className="mt-3">
                      <MarkdownContent>{step.body}</MarkdownContent>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <button
                        onClick={() => undoStep(step.id)}
                        disabled={saving}
                        className="text-xs text-csl-gray3 hover:text-csl-red underline font-semibold transition-colors"
                      >
                        Undo — mark as incomplete
                      </button>
                      {step.dovetail_intent && (
                        <button
                          onClick={() => fireCopilot(step)}
                          disabled={copilotFiring === step.id}
                          className="text-xs text-csl-black font-bold hover:text-csl-red transition-colors disabled:opacity-50"
                        >
                          {copilotFiring === step.id ? 'Opening…' : '💬 Open in Copilot'}
                        </button>
                      )}
                    </div>
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
                className="rounded border-2 border-csl-red bg-white shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 bg-csl-red flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-white text-csl-red flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <h2 className="font-bold text-white text-sm">{step.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <SystemBadge system={step.system} />
                    {step.required ? (
                      <span className="text-xs text-white/80 font-semibold border border-white/30 rounded px-2 py-0.5">Required</span>
                    ) : (
                      <span className="text-xs text-white/60">Optional</span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <MarkdownContent>{step.body}</MarkdownContent>

                  {/* Dovetail Copilot trigger button */}
                  {step.dovetail_intent && (
                    <div className="mt-4 flex items-center gap-3 p-3 rounded border border-csl-gray2 bg-csl-gray1">
                      <span className="text-lg">💬</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-csl-black">HR Copilot</p>
                        <p className="text-xs text-csl-gray3 font-light truncate">{step.dovetail_intent}</p>
                      </div>
                      <button
                        onClick={() => fireCopilot(step)}
                        disabled={copilotFiring === step.id}
                        className="flex-shrink-0 px-4 py-1.5 rounded bg-csl-black text-white text-xs font-bold hover:bg-csl-gray3 disabled:opacity-50 transition-colors"
                      >
                        {copilotFiring === step.id ? 'Opening…' : 'Open in Copilot →'}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => markComplete(step.id)}
                      disabled={saving}
                      className="px-5 py-2 rounded bg-csl-red text-white text-sm font-bold hover:bg-csl-red-dark disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Mark Complete ✓'}
                    </button>
                    {!step.required && (
                      <button
                        onClick={() => markComplete(step.id)}
                        disabled={saving}
                        className="text-sm text-csl-gray3 hover:text-csl-red font-semibold transition-colors"
                      >
                        Skip (optional)
                      </button>
                    )}
                    {step.required && skippingRequired === step.id && (
                      <span className="text-xs text-amber-700 font-semibold">This step is required. Complete it before continuing.</span>
                    )}
                  </div>
                </div>
              </div>
            )
          }

          // Upcoming step
          return (
            <div
              key={step.id}
              className="rounded border border-csl-gray2 bg-white px-4 py-3 flex items-center gap-3 opacity-40"
            >
              <span className="w-5 h-5 rounded-full border-2 border-csl-gray2 flex items-center justify-center text-xs text-csl-gray3 flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-sm text-csl-gray3 flex-1 font-light">{step.title}</span>
              <SystemBadge system={step.system} size="xs" />
            </div>
          )
        })}
      </div>

      {allDone && (
        <div className="mt-8 rounded border border-green-200 bg-green-50 p-6 text-center">
          <div className="text-3xl mb-2">✅</div>
          <h3 className="font-bold text-green-900 text-lg">All Steps Complete</h3>
          <p className="text-sm text-green-700 mt-1 font-light">
            This case has been fully processed. All actions have been recorded.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-5 py-2 rounded bg-csl-red text-white text-sm font-bold hover:bg-csl-red-dark transition-colors"
          >
            Back to Home
          </button>
        </div>
      )}
    </div>
  )
}
