import { useState, useEffect } from 'react'
import { apiGet } from '../lib/api'
import { EmptyState } from '../components/shared/EmptyState'
import { Insight } from '../lib/types'

const ICONS: Record<string, React.ReactNode> = {
  'best-time': <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  'session-length': <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  'effort-level': <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  'resistance': <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  'completion-rate': <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

export function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<Insight[]>('/insights').then(setInsights).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text">Insights</h1>
        <p className="text-text-muted text-sm mt-0.5">Patterns from your focus sessions</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="card p-5 animate-pulse h-16" />)}</div>
      ) : insights.length === 0 ? (
        <EmptyState
          icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          title="No insights yet"
          description="Complete a few focus sessions and your patterns will start to appear here."
        />
      ) : (
        <div className="space-y-3">
          {insights.map(insight => (
            <div key={insight.id} className="card p-5">
              <div className="flex items-start gap-3.5">
                <div className="text-primary mt-0.5 flex-shrink-0">{ICONS[insight.id] ?? ICONS['session-length']}</div>
                <div>
                  <p className="font-medium text-text text-sm leading-snug">{insight.text}</p>
                  {insight.detail && <p className="text-text-muted text-sm mt-1 leading-relaxed">{insight.detail}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-primary-light/50 rounded-lg">
        <p className="text-sm text-text-muted">Insights are based on your last 100 sessions. The more you use FocusFlow, the more useful they become.</p>
      </div>
    </div>
  )
}
