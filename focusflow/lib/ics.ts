interface Task {
  id: string
  title: string
}

interface ScheduledBlock {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
}

type BlockWithTask = ScheduledBlock & { task: Task | null }

function toICSDate(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM
  const [year, month, day] = dateStr.split('-')
  const [hour, minute] = timeStr.split(':')
  return `${year}${month}${day}T${hour}${minute}00`
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function generateICS(blocks: BlockWithTask[]): string {
  const now = new Date()
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

  const events = blocks
    .map((block) => {
      const dtstart = toICSDate(block.date, block.startTime)
      const dtend = toICSDate(block.date, block.endTime)
      const summary = escapeICSText(block.title)
      const description = block.task
        ? escapeICSText(`FocusFlow task: ${block.task.title}`)
        : 'FocusFlow focus block'

      return [
        'BEGIN:VEVENT',
        `UID:focusflow-${block.id}@focusflow`,
        `DTSTAMP:${stamp}Z`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    .join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FocusFlow//FocusFlow Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
}
