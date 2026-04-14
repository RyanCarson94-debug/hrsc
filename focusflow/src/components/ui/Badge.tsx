import { Bucket, Effort } from '../../lib/types'

type Variant = 'effort-low' | 'effort-medium' | 'effort-high' | 'now' | 'soon' | 'later' | 'neutral'

const styles: Record<Variant, string> = {
  'effort-low': 'bg-effort-low text-effort-low-text',
  'effort-medium': 'bg-effort-medium text-effort-medium-text',
  'effort-high': 'bg-effort-high text-effort-high-text',
  now: 'bg-primary-light text-primary',
  soon: 'bg-amber-50 text-amber-700',
  later: 'bg-gray-100 text-text-muted',
  neutral: 'bg-gray-100 text-text-muted',
}

export function Badge({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  )
}

export const effortVariant = (e: Effort): Variant =>
  e === 'LOW' ? 'effort-low' : e === 'HIGH' ? 'effort-high' : 'effort-medium'

export const effortLabel = (e: Effort): string =>
  e.charAt(0) + e.slice(1).toLowerCase()
