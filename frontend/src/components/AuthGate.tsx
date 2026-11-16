import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { onAuthRequired, ApiError } from '../api/client'
import { login } from '../api/endpoints'
import { useAuthStatus } from '../hooks/queries'
import { useQueryClient } from '@tanstack/react-query'

// App-level login — a second layer behind Cloudflare Access, not a
// replacement for it. Wraps the whole app: while logged out (or once any
// API call reports the session cookie missing/expired), this renders a
// login form instead of the real app.
export function AuthGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const status = useAuthStatus()
  const [forceGate, setForceGate] = useState(false)
  useEffect(() => onAuthRequired(() => setForceGate(true)), [])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status.isLoading) return null

  const needsLogin = forceGate || status.data?.authenticated === false
  if (!needsLogin) return <>{children}</>

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
      setForceGate(false)
      setPassword('')
      await qc.invalidateQueries({ queryKey: ['authStatus'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-gate">
      <form className="login-form" onSubmit={submit}>
        <h1>Archive</h1>
        <input
          className="input"
          placeholder="Username"
          value={username}
          autoFocus
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <div className="error-banner">{error}</div> : null}
        <button
          className="btn primary"
          type="submit"
          disabled={submitting || !username || !password}
        >
          {submitting ? '…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
