interface Task {
  id: string
  effort: string
  title: string
  resistanceCount: number
}

interface FocusSessionBase {
  id: string
  startedAt: Date
  status: string
  durationMins: number | null
  taskId: string
}

type SessionWithTask = FocusSessionBase & { task: Task }

export interface Insight {
  id: string
  text: string
  detail?: string
}

function getHour(date: Date): number {
  return date.getHours()
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export function computeInsights(sessions: SessionWithTask[]): Insight[] {
  const completed = sessions.filter((s) => s.status === 'COMPLETED')
  if (completed.length === 0) return []

  const insights: Insight[] = []

  // Best time of day
  const hourCounts: Record<number, number> = {}
  for (const s of completed) {
    const h = getHour(new Date(s.startedAt))
    hourCounts[h] = (hourCounts[h] || 0) + 1
  }
  const bestHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  if (bestHour) {
    const h = Number(bestHour[0])
    const label = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
    const timeStr = new Date(0, 0, 0, h).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    })
    insights.push({
      id: 'best-time',
      text: `You complete most sessions in the ${label}`,
      detail: `Around ${timeStr} is when you tend to start and finish tasks.`,
    })
  }

  // Optimal session length
  const durations = completed.filter((s) => s.durationMins).map((s) => s.durationMins!)
  if (durations.length >= 3) {
    const med = Math.round(median(durations))
    insights.push({
      id: 'session-length',
      text: `Your sweet spot is around ${med}-minute sessions`,
      detail: `Sessions in this range have the highest completion rate for you.`,
    })
  }

  // Most completed effort level
  const effortCounts: Record<string, number> = {}
  for (const s of completed) {
    const e = s.task.effort
    effortCounts[e] = (effortCounts[e] || 0) + 1
  }
  const topEffort = Object.entries(effortCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  if (topEffort) {
    const effortLabel = topEffort[0].toLowerCase()
    insights.push({
      id: 'effort-level',
      text: `You complete ${effortLabel}-effort tasks most often`,
      detail: `Consider starting your day with one of these to build momentum.`,
    })
  }

  // High resistance tasks
  const highResistance = sessions.filter((s) => s.task.resistanceCount >= 2)
  if (highResistance.length > 0) {
    const uniqueTasks = new Set(highResistance.map((s) => s.taskId)).size
    insights.push({
      id: 'resistance',
      text: `${uniqueTasks} task${uniqueTasks > 1 ? 's are' : ' is'} showing signs of avoidance`,
      detail: `Try breaking them into a 5-minute first step to reduce resistance.`,
    })
  }

  // Completion rate
  const total = sessions.length
  const rate = Math.round((completed.length / total) * 100)
  if (total >= 5) {
    insights.push({
      id: 'completion-rate',
      text: `You complete ${rate}% of the sessions you start`,
      detail:
        rate >= 70
          ? `That's strong. Keep your session length comfortable to maintain it.`
          : `Starting shorter sessions may help you build momentum.`,
    })
  }

  return insights.slice(0, 5)
}
