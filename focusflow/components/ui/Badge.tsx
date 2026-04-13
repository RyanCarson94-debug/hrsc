interface BadgeProps {
  children: React.ReactNode
  variant?: 'effort-low' | 'effort-medium' | 'effort-high' | 'now' | 'soon' | 'later' | 'neutral'
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const styles = {
    'effort-low': 'bg-effort-low text-effort-low-text',
    'effort-medium': 'bg-effort-medium text-effort-medium-text',
    'effort-high': 'bg-effort-high text-effort-high-text',
    now: 'bg-primary-light text-primary',
    soon: 'bg-amber-50 text-amber-700',
    later: 'bg-gray-100 text-text-muted',
    neutral: 'bg-gray-100 text-text-muted',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  )
}

export function effortVariant(effort: string): BadgeProps['variant'] {
  if (effort === 'LOW') return 'effort-low'
  if (effort === 'HIGH') return 'effort-high'
  return 'effort-medium'
}

export function bucketVariant(bucket: string): BadgeProps['variant'] {
  if (bucket === 'NOW') return 'now'
  if (bucket === 'SOON') return 'soon'
  return 'later'
}

export function effortLabel(effort: string): string {
  return effort.charAt(0) + effort.slice(1).toLowerCase()
}

export function bucketLabel(bucket: string): string {
  return bucket.charAt(0) + bucket.slice(1).toLowerCase()
}
