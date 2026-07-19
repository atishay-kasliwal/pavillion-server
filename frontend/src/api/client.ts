// Single core wrapper every API call routes through.
// - credentials:'include' so the Cloudflare Access cookie is always sent
// - detects HTML responses (Access login redirect) and throws SessionExpiredError
// - prefixes the API's relative media URLs with the origin (they already
//   include the /api prefix, so origin only — never origin + /api)

export const API_ORIGIN: string = import.meta.env.VITE_API_ORIGIN ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Cloudflare Access session expired')
  }
}

type SessionListener = () => void
let sessionListeners: SessionListener[] = []

export function onSessionExpired(fn: SessionListener): () => void {
  sessionListeners.push(fn)
  return () => {
    sessionListeners = sessionListeners.filter((l) => l !== fn)
  }
}

function notifySessionExpired() {
  for (const fn of sessionListeners) fn()
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
  })

  // Access's login interstitial comes back as a 200 HTML page (a redirect
  // through the login flow lands on that final 200) — that's the signal
  // an expired session looks like. A 4xx/5xx with an HTML body is a real
  // server error (e.g. Express's default 404 page for a missing route)
  // and should surface as a normal ApiError below, not a false session-
  // expired prompt.
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('text/html') && res.status === 200) {
    notifySessionExpired()
    throw new SessionExpiredError()
  }

  if (res.status === 204) return undefined as T

  if (!res.ok) {
    let message = `request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}

export function mediaUrl(rel: string): string
export function mediaUrl(rel: string | null): string | null
export function mediaUrl(rel: string | null): string | null {
  return rel === null ? null : `${API_ORIGIN}${rel}`
}
