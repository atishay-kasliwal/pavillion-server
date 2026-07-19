// Same subscribe/notify pattern as api/client.ts's session-expired signal —
// lets code outside the component tree (the QueryClient's mutation cache)
// push user-facing feedback without needing a hook.

export type Toast = { id: number; type: 'success' | 'error'; message: string }
type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let listeners: Listener[] = []
let counter = 0

function emit() {
  for (const l of listeners) l(toasts)
}

export function pushToast(message: string, type: Toast['type'] = 'success') {
  const id = counter++
  toasts = [...toasts, { id, type, message }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 3500)
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
