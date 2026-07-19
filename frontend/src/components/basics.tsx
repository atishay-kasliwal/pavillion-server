import type { ReactNode } from 'react'

export function Spinner() {
  return <div className="spinner" />
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div className="error-banner">{children}</div>
}
