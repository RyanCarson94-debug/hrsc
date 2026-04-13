interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && (
        <div className="mb-4 text-text-subtle opacity-60">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-text-muted mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-subtle max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
