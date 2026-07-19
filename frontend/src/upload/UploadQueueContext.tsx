import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { upload } from '../api/endpoints'
import { ApiError, DirectUploadUnavailableError } from '../api/client'
import { pushToast } from '../lib/toast'
import type { Source, UploadResult } from '../api/types'

const MAX_SIZE = 200 * 1024 * 1024 // the API's hard in-memory cap

export type UploadRowStatus =
  | 'queued'
  | 'uploading'
  | 'done'
  | 'duplicate'
  | 'error'
  | 'conflict'
  | 'too-large'

export type UploadRow = {
  key: string
  file: File
  relativeDir: string
  folder?: string
  status: UploadRowStatus
  message?: string
  destination: Source
  onUploaded?: (result: UploadResult) => void
}

export type AddFilesEntry = {
  file: File
  relativeDir?: string
  // Filebrowser destinations only — the server ignores this field for
  // photo/video/audio uploads, so callers can pass it unconditionally.
  folder?: string
  onUploaded?: (result: UploadResult) => void
}

export type UploadSummary = {
  total: number
  done: number
  failed: number
  active: number
  percent: number
}

// A persisted record of a settled upload — survives page refreshes and
// sessions (the live UploadRow can't: its File can't be re-read after a
// reload). This is history/audit only, not something that can resume.
export type UploadHistoryEntry = {
  key: string
  name: string
  size: number
  destination: Source
  status: 'done' | 'duplicate' | 'error' | 'conflict' | 'too-large'
  at: number
}

const HISTORY_KEY = 'pavillion.uploadHistory'
const HISTORY_LIMIT = 200

function loadHistory(): UploadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as UploadHistoryEntry[]) : []
  } catch {
    return []
  }
}

type UploadQueueApi = {
  rows: UploadRow[]
  summary: UploadSummary
  history: UploadHistoryEntry[]
  addFiles: (entries: AddFilesEntry[]) => void
  retry: (key: string) => void
  renameAndRetry: (key: string, newName: string) => void
  clearCompleted: () => void
  clearHistory: () => void
}

const UploadQueueContext = createContext<UploadQueueApi | null>(null)

export function useUploadQueue(): UploadQueueApi {
  const ctx = useContext(UploadQueueContext)
  if (!ctx) throw new Error('useUploadQueue must be used within UploadQueueProvider')
  return ctx
}

// Mirrors the server's MIME routing so the UI can predict where a file lands
// before the upload finishes.
function predictDestination(file: File): Source {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return 'immich'
  if (file.type.startsWith('audio/')) return 'navidrome'
  return 'filebrowser'
}

let keyCounter = 0

// A single upload queue shared across the whole app — the dedicated Upload
// page, the per-page "+ Add" quick-upload buttons, and Files' drag-and-drop
// all feed into this one place, so progress is visible everywhere (UploadTray)
// regardless of which screen started the upload.
export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<UploadRow[]>([])
  const [history, setHistory] = useState<UploadHistoryEntry[]>(() => loadHistory())
  const rowsRef = useRef<UploadRow[]>([])
  const uploadingRef = useRef(false)
  const qc = useQueryClient()

  // Persist history whenever it changes so a refresh/return keeps the record.
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      // localStorage full/unavailable — history is best-effort, not critical.
    }
  }, [history])

  const recordHistory = useCallback((row: UploadRow, status: UploadHistoryEntry['status']) => {
    setHistory((h) =>
      [
        {
          key: `${row.key}-${Date.now()}`,
          name: row.file.name,
          size: row.file.size,
          destination: row.destination,
          status,
          at: Date.now(),
        },
        ...h,
      ].slice(0, HISTORY_LIMIT),
    )
  }, [])

  const clearHistory = useCallback(() => setHistory([]), [])

  const setRowsState = useCallback((updater: React.SetStateAction<UploadRow[]>) => {
    setRows((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      rowsRef.current = next
      return next
    })
  }, [])

  const patchRow = useCallback(
    (key: string, patch: Partial<UploadRow>) =>
      setRowsState((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))),
    [setRowsState],
  )

  const invalidateFor = useCallback(
    (dest: Source) => {
      if (dest === 'immich') void qc.invalidateQueries({ queryKey: ['timeline'] })
      else if (dest === 'navidrome') {
        void qc.invalidateQueries({ queryKey: ['artists'] })
        void qc.invalidateQueries({ queryKey: ['albumSongs'] })
      } else void qc.invalidateQueries({ queryKey: ['folder'] })
    },
    [qc],
  )

  const uploadOne = useCallback(
    async (row: UploadRow) => {
      patchRow(row.key, { status: 'uploading' })
      try {
        const result = await upload(row.file, row.folder)
        patchRow(row.key, { status: result.duplicate ? 'duplicate' : 'done' })
        recordHistory(row, result.duplicate ? 'duplicate' : 'done')
        invalidateFor(row.destination)
        row.onUploaded?.(result)
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          patchRow(row.key, { status: 'conflict', message: 'name already exists' })
          recordHistory(row, 'conflict')
        } else if (err instanceof DirectUploadUnavailableError) {
          // Over Cloudflare's 100 MB cap with no reachable bypass — mark it
          // too-large (not a transient error) with a message that says why.
          patchRow(row.key, { status: 'too-large', message: err.message })
          recordHistory(row, 'too-large')
        } else {
          patchRow(row.key, {
            status: 'error',
            message: err instanceof Error ? err.message : 'upload failed',
          })
          recordHistory(row, 'error')
        }
      }
    },
    [patchRow, invalidateFor, recordHistory],
  )

  // Sequential — the server buffers each file fully in RAM (200MB cap).
  const pump = useCallback(async () => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    try {
      for (;;) {
        const queue = rowsRef.current.filter((row) => row.status === 'queued')
        if (queue.length === 0) break
        for (const row of queue) {
          if (row.status !== 'queued') continue
          await uploadOne(row)
        }
      }
    } finally {
      uploadingRef.current = false
    }
  }, [uploadOne])

  const addFiles = useCallback(
    (entries: AddFilesEntry[]) => {
      if (entries.length === 0) return
      const newRows: UploadRow[] = entries.map(
        ({ file, relativeDir = '', folder, onUploaded }) => ({
          key: `u${keyCounter++}`,
          file,
          relativeDir,
          folder,
          status: file.size > MAX_SIZE ? 'too-large' : 'queued',
          message: file.size > MAX_SIZE ? 'over the 200MB limit' : undefined,
          destination: predictDestination(file),
          onUploaded,
        }),
      )
      setRowsState((rs) => [...rs, ...newRows])
      // Too-large rows never reach the queue/uploadOne, so record them here.
      for (const row of newRows) {
        if (row.status === 'too-large') recordHistory(row, 'too-large')
      }
      void pump()
    },
    [setRowsState, pump, recordHistory],
  )

  const retry = useCallback(
    (key: string) => {
      patchRow(key, { status: 'queued', message: undefined })
      void pump()
    },
    [patchRow, pump],
  )

  const renameAndRetry = useCallback(
    (key: string, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed) return
      setRowsState((rs) =>
        rs.map((r) =>
          r.key === key
            ? {
                ...r,
                file: new File([r.file], trimmed, { type: r.file.type }),
                status: 'queued' as const,
                message: undefined,
              }
            : r,
        ),
      )
      void pump()
    },
    [setRowsState, pump],
  )

  const clearCompleted = useCallback(() => {
    setRowsState((rs) => rs.filter((r) => r.status === 'queued' || r.status === 'uploading'))
  }, [setRowsState])

  const summary = useMemo<UploadSummary>(() => {
    const total = rows.length
    const done = rows.filter((r) => r.status === 'done' || r.status === 'duplicate').length
    const failed = rows.filter(
      (r) => r.status === 'error' || r.status === 'conflict' || r.status === 'too-large',
    ).length
    const active = rows.filter((r) => r.status === 'queued' || r.status === 'uploading').length
    const settled = total - active
    return { total, done, failed, active, percent: total === 0 ? 0 : (settled / total) * 100 }
  }, [rows])

  // Warn before a refresh/close while uploads are still in flight — the
  // browser can't re-read a File after a reload, so an accidental navigation
  // silently kills whatever hasn't finished. (History still survives, but the
  // in-progress bytes don't.)
  useEffect(() => {
    if (summary.active === 0) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers show their own generic message; a non-empty
      // returnValue is what actually triggers the prompt.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [summary.active])

  const prevActiveRef = useRef(0)
  useEffect(() => {
    const wasActive = prevActiveRef.current > 0
    prevActiveRef.current = summary.active

    if (!wasActive || summary.active > 0 || summary.total === 0) return

    // A batch just finished settling, regardless of which page/button
    // started it — one toast, and if nothing failed, clear the tray on its
    // own shortly after so it doesn't just sit there once there's nothing
    // left to do.
    pushToast(
      summary.failed > 0
        ? `Upload finished — ${summary.done} done, ${summary.failed} failed`
        : summary.done === 1
          ? 'Uploaded 1 file'
          : `Uploaded ${summary.done} files`,
      summary.failed > 0 ? 'error' : 'success',
    )

    if (summary.failed === 0) {
      const timer = setTimeout(() => clearCompleted(), 2500)
      return () => clearTimeout(timer)
    }
  }, [summary.active, summary.total, summary.done, summary.failed, clearCompleted])

  const api = useMemo<UploadQueueApi>(
    () => ({ rows, summary, history, addFiles, retry, renameAndRetry, clearCompleted, clearHistory }),
    [rows, summary, history, addFiles, retry, renameAndRetry, clearCompleted, clearHistory],
  )

  return <UploadQueueContext.Provider value={api}>{children}</UploadQueueContext.Provider>
}
