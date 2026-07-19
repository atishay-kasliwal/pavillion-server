import { useRef, useState } from 'react'
import { useUploadQueue } from '../upload/UploadQueueContext'
import { destinationLabel, statusMeta } from '../upload/uploadMeta'
import { walkDrop } from '../lib/walkDrop'
import { FolderPicker } from '../components/FolderPicker'
import { EmptyState } from '../components/basics'
import { IconCamera, IconFolder, IconUpload } from '../components/icons'
import { formatBytes } from '../lib/format'
import { useEscapeKey } from '../lib/useEscapeKey'

const joinFolder = (base: string, sub: string) =>
  [base === '/' ? '' : base, sub].filter(Boolean).join('/') || undefined

export function UploadPage() {
  const { rows, summary, retry, renameAndRetry, clearCompleted, addFiles } = useUploadQueue()
  const [folder, setFolder] = useState('/')
  const [pickingFolder, setPickingFolder] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  useEscapeKey(() => setRenamingKey(null), renamingKey !== null)
  useEscapeKey(() => setPickingFolder(false), pickingFolder)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files).map((file) => ({ file, folder: joinFolder(folder, '') })))
    }
    e.target.value = ''
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = await walkDrop(e.dataTransfer)
    addFiles(
      dropped.map(({ file, relativeDir }) => ({
        file,
        relativeDir,
        folder: joinFolder(folder, relativeDir),
      })),
    )
  }

  const renamingRow = rows.find((r) => r.key === renamingKey)

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
        <IconUpload className="dropzone-icon" />
        {/* Drag-and-drop isn't a real interaction on touch devices — swap
            the copy instead of describing an affordance that doesn't exist. */}
        <div className="dropzone-label pointer-fine-only">
          Drag &amp; drop files or folders here, or tap to browse
        </div>
        <div className="dropzone-label pointer-coarse-only">Tap to choose photos or files</div>
        <div className="dropzone-hint">
          Photos &amp; videos → Photos · Audio → Music · Everything else → Files · 200MB max per
          file
        </div>
      </div>

      {/* Camera capture is a mobile-native affordance with no desktop
          equivalent — only worth showing where it actually works. */}
      <div className="mobile-quick-actions pointer-coarse-only">
        <button
          className="btn"
          onClick={(e) => {
            e.stopPropagation()
            cameraInputRef.current?.click()
          }}
        >
          <IconCamera className="btn-icon" />
          Take photo
        </button>
      </div>

      <input ref={inputRef} type="file" multiple hidden onChange={handleFileInput} />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={handleFileInput}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Destination folder for plain files:
        </span>
        <button className="btn" onClick={() => setPickingFolder(true)}>
          <IconFolder className="btn-icon" />
          {folder === '/' ? 'root' : folder}
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState>Nothing uploaded yet this session.</EmptyState>
      ) : (
        <div>
          <div className="upload-summary">
            <div className="upload-summary-top">
              <span className="upload-summary-text">
                <span className="upload-summary-count">
                  {summary.done + summary.failed}/{summary.total}
                </span>
                {summary.active > 0
                  ? ' uploading…'
                  : summary.failed > 0
                    ? ` — ${summary.failed} failed`
                    : ' uploaded'}
              </span>
              {summary.done + summary.failed > 0 && summary.active === 0 ? (
                <button className="upload-clear" onClick={clearCompleted}>
                  Clear completed
                </button>
              ) : null}
            </div>
            <div className="upload-progress-track">
              <div
                className={`upload-progress-fill${summary.failed > 0 && summary.active === 0 ? ' has-errors' : ''}`}
                style={{ width: `${summary.percent}%` }}
              />
            </div>
          </div>

          {rows.map((row) => {
            const meta = statusMeta[row.status]
            return (
              <div key={row.key} className="upload-row">
                <span className={`dest-badge dest-${row.destination}`}>
                  {destinationLabel[row.destination]}
                </span>
                <div className="row-main">
                  <div className="row-name">
                    {row.relativeDir ? `${row.relativeDir}/` : ''}
                    {row.file.name}
                  </div>
                  <div className="row-sub">{formatBytes(row.file.size)}</div>
                </div>
                <span className={`upload-status tone-${meta.tone}`}>
                  {meta.icon}
                  {meta.label}
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
                    <button className="row-action" onClick={() => retry(row.key)}>
                      Retry
                    </button>
                  </>
                ) : null}
                {row.status === 'error' ? (
                  <button className="row-action" onClick={() => retry(row.key)}>
                    Retry
                  </button>
                ) : null}
              </div>
            )
          })}
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

      {renamingRow ? (
        <div className="dialog-backdrop" onClick={() => setRenamingKey(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rename and retry</h3>
            <input
              className="input"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  renameAndRetry(renamingRow.key, newName)
                  setRenamingKey(null)
                }
              }}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setRenamingKey(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  renameAndRetry(renamingRow.key, newName)
                  setRenamingKey(null)
                }}
                disabled={!newName.trim()}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
