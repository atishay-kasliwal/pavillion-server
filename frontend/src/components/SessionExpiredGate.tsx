import { useEffect, useState } from 'react'
import { onSessionExpired } from '../api/client'

export function SessionExpiredGate() {
  const [expired, setExpired] = useState(false)

  useEffect(() => onSessionExpired(() => setExpired(true)), [])

  if (!expired) return null

  return (
    <div className="session-gate">
      <h2>Session expired</h2>
      <p>
        Your Cloudflare Access session has expired. Reload to sign in again —
        you&apos;ll come right back here.
      </p>
      <button className="btn primary" onClick={() => location.reload()}>
        Reload &amp; sign in
      </button>
    </div>
  )
}
