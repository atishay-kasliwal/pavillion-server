import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUploadQueue } from './UploadQueueContext'
import { destinationLabel, statusMeta } from './uploadMeta'
import { IconChevronRight, IconUpload, IconX } from '../components/icons'
import { formatBytes } from '../lib/format'

// Persistent across every page — uploads started from a quick-add button on
// Photos/Music/Files, or from Files' drag-and-drop, stay visible here even
// after navigating away, instead of only showing progress on /upload.
export function UploadTray() {
  const { rows, summary, retry, clearCompleted } = useUploadQueue()
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  if (rows.length === 0) return null

  const label =
    summary.active > 0
      ? `Uploading ${summary.done + summary.failed}/${summary.total}…`
      : summary.failed > 0
        ? `${summary.done}/${summary.total} uploaded — ${summary.failed} failed`
        : `${summary.total} uploaded`

  // Most recent first, capped — this is a glance-and-go tray, not the full
  // manager (that's still the Upload page, one tap away).
  const recent = [...rows].reverse().slice(0, 6)

  return (
    <div className="upload-tray">
      {expanded ? (
        <div className="upload-tray-panel">
          <div className="upload-tray-panel-header">
            <span>Uploads</span>
            <button
              className="upload-tray-viewall"
              onClick={() => {
                setExpanded(false)
                navigate('/upload')
              }}
            >
              View all
            </button>
          </div>
          <div className="upload-tray-list">
            {recent.map((row) => {
              const meta = statusMeta[row.status]
              return (
                <div key={row.key} className="upload-tray-row">
                  <span className={`dest-badge dest-${row.destination}`}>
                    {destinationLabel[row.destination]}
                  </span>
                  <div className="row-main">
                    <div className="row-name">{row.file.name}</div>
                    <div className="row-sub">{formatBytes(row.file.size)}</div>
                  </div>
                  <span className={`upload-status tone-${meta.tone}`}>{meta.icon}</span>
                  {row.status === 'error' || row.status === 'conflict' ? (
                    <button
                      className="row-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        retry(row.key)
                      }}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <button
        className="upload-tray-pill"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {summary.active > 0 ? (
          <span className="mini-spinner" />
        ) : (
          <IconUpload className="btn-icon" />
        )}
        <span className="upload-tray-label">{label}</span>
        <div className="upload-progress-track upload-tray-track">
          <div
            className={`upload-progress-fill${summary.failed > 0 && summary.active === 0 ? ' has-errors' : ''}`}
            style={{ width: `${summary.percent}%` }}
          />
        </div>
        <IconChevronRight className={`upload-tray-chevron${expanded ? ' open' : ''}`} />
      </button>

      {/* Only lets you dismiss finished work — active uploads keep the tray
          visible, since there's nothing to hide that isn't still running. */}
      {summary.active === 0 ? (
        <button
          className="upload-tray-close"
          onClick={(e) => {
            e.stopPropagation()
            clearCompleted()
          }}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <IconX />
        </button>
      ) : null}
    </div>
  )
}
