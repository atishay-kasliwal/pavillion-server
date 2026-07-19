import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { upload } from '../api/endpoints'
import { ApiError } from '../api/client'
import { walkDrop } from '../lib/walkDrop'
import { FolderPicker } from '../components/FolderPicker'
import { EmptyState } from '../components/basics'
import { formatBytes } from '../lib/format'
import { useEscapeKey } from '../lib/useEscapeKey'
import type { Source } from '../api/types'

const MAX_SIZE = 200 * 1024 * 1024 // matches the server's in-memory cap

type RowStatus = 'queued' | 'uploading' | 'done' | 'error' | 'conflict' | 'too-large'

type UploadRow = {
  key: string
  file: File
  relativeDir: string
  status: RowStatus
  message?: string
  destination: Source
}

// Mirrors the server's MIME routing so the badge predicts where a file lands.
function predictDestination(file: File): Source {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return 'immich'
  if (file.type.startsWith('audio/')) return 'navidrome'
  return 'filebrowser'
}

let keyCounter = 0

export function UploadPage() {
  const [rows, setRows] = useState<UploadRow[]>([])
  const [folder, setFolder] = useState('/')
  const [pickingFolder, setPickingFolder] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  useEscapeKey(() => setRenamingKey(null), renamingKey !== null)
  useEscapeKey(() => setPickingFolder(false), pickingFolder)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadingRef = useRef(false)
  const rowsRef = useRef<UploadRow[]>([])
  const qc = useQueryClient()

  const setRowsState = (updater: React.SetStateAction<UploadRow[]>) => {
    setRows((currentRows) => {
      const nextRows = typeof updater === 'function' ? updater(currentRows) : updater
      rowsRef.current = nextRows
      return nextRows
    })
  }

  const patchRow = (key: string, patch: Partial<UploadRow>) =>
    setRowsState((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addFiles = (files: { file: File; relativeDir: string }[]) => {
    const newRows: UploadRow[] = files.map(({ file, relativeDir }) => ({
      key: `u${keyCounter++}`,
      file,
      relativeDir,
      status: file.size > MAX_SIZE ? 'too-large' : 'queued',
      message: file.size > MAX_SIZE ? 'over the 200MB limit' : undefined,
      destination: predictDestination(file),
    }))
    setRowsState((rs) => [...rs, ...newRows])
    void pump()
  }

  // Sequential upload — the server buffers each file fully in RAM.
  const pump = async () => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    try {
      while (true) {
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
  }

  const uploadOne = async (row: UploadRow) => {
    patchRow(row.key, { status: 'uploading' })
    const isFb = row.destination === 'filebrowser'
    const base = folder === '/' ? '' : folder
    const effectiveFolder = isFb
      ? [base, row.relativeDir].filter(Boolean).join('/') || undefined
      : undefined
    try {
      await upload(row.file, effectiveFolder)
      patchRow(row.key, { status: 'done' })
      invalidateFor(row.destination)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        patchRow(row.key, { status: 'conflict', message: 'name already exists' })
      } else {
        patchRow(row.key, {
          status: 'error',
          message: err instanceof Error ? err.message : 'upload failed',
        })
      }
    }
  }

  const invalidateFor = (dest: Source) => {
    if (dest === 'immich') void qc.invalidateQueries({ queryKey: ['timeline'] })
    else if (dest === 'navidrome') {
      void qc.invalidateQueries({ queryKey: ['artists'] })
      void qc.invalidateQueries({ queryKey: ['albumSongs'] })
    } else void qc.invalidateQueries({ queryKey: ['folder'] })
  }

  const retry = (row: UploadRow) => {
    patchRow(row.key, { status: 'queued', message: undefined })
    void pump()
  }

  const renameAndRetry = () => {
    const row = rows.find((r) => r.key === renamingKey)
    const name = newName.trim()
    if (!row || !name) return
    const renamed = new File([row.file], name, { type: row.file.type })
    const updated: UploadRow = { ...row, file: renamed, status: 'queued', message: undefined }
    setRowsState((rs) => rs.map((r) => (r.key === row.key ? updated : r)))
    setRenamingKey(null)
    setNewName('')
    void pump()
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(await walkDrop(e.dataTransfer))
  }

  const statusLabel: Record<RowStatus, string> = {
    queued: 'queued',
    uploading: 'uploading…',
    done: '✓ done',
    error: 'failed',
    conflict: 'name conflict',
    'too-large': 'too large',
  }

  return (
    <div>
      <h1 className="page-title">Upload</h1>

      <div
        className={`dropzone${dragOver ? ' over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>⬆️</div>
        Drop files or folders here, or click to pick files
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
          Photos &amp; videos → Immich · Audio → Navidrome · Everything else → Files
          · 200MB max per file
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) {
            addFiles(Array.from(e.target.files).map((file) => ({ file, relativeDir: '' })))
            e.target.value = ''
          }
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Destination folder for plain files:
        </span>
        <button className="btn" onClick={() => setPickingFolder(true)}>
          📁 {folder === '/' ? 'root' : folder}
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState>Nothing uploaded yet this session.</EmptyState>
      ) : (
        <div>
          {rows.map((row) => (
            <div key={row.key} className="upload-row">
              <span className="dest-badge">{row.destination}</span>
              <div className="row-main">
                <div className="row-name">
                  {row.relativeDir ? `${row.relativeDir}/` : ''}
                  {row.file.name}
                </div>
                <div className="row-sub">{formatBytes(row.file.size)}</div>
              </div>
              <span className={`upload-status ${row.status}`}>
                {statusLabel[row.status]}
                {row.message && row.status !== 'conflict' ? ` — ${row.message}` : ''}
              </span>
              {row.status === 'conflict' ? (
                <>
                  <button
                    className="row-action"
                    onClick={() => {
                      setRenamingKey(row.key)
                      setNewName(row.file.name)
                    }}
                  >
                    Rename
                  </button>
                  <button className="row-action" onClick={() => retry(row)}>
                    Retry
                  </button>
                </>
              ) : null}
              {row.status === 'error' ? (
                <button className="row-action" onClick={() => retry(row)}>
                  Retry
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {pickingFolder ? (
        <FolderPicker
          onPick={(p) => {
            setFolder(p)
            setPickingFolder(false)
          }}
          onCancel={() => setPickingFolder(false)}
        />
      ) : null}

      {renamingKey ? (
        <div className="dialog-backdrop" onClick={() => setRenamingKey(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rename and retry</h3>
            <input
              className="input"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && renameAndRetry()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setRenamingKey(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={renameAndRetry} disabled={!newName.trim()}>
                Upload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
