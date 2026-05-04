import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon}
      <p>{message}</p>
      {action}
    </div>
  )
}
