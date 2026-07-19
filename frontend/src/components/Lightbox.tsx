import { useCallback, useEffect, useState } from 'react'
import { mediaUrl } from '../api/client'
import { formatBytes, formatDateTime } from '../lib/format'
import {
  IconCalendar,
  IconChevronLeft,
  IconDownload,
  IconFile,
  IconInfo,
  IconMapPin,
} from './icons'
import type { Item } from '../api/types'

type Props = {
  items: Item[]
  index: number
  onNavigate: (index: number) => void
  onClose: () => void
  actions?: React.ReactNode
}

export function Lightbox({ items, index, onNavigate, onClose, actions }: Props) {
  const item = items[index]
  const [showInfo, setShowInfo] = useState(false)

  const prev = useCallback(() => {
    if (index > 0) onNavigate(index - 1)
  }, [index, onNavigate])
  const next = useCallback(() => {
    if (index < items.length - 1) onNavigate(index + 1)
  }, [index, items.length, onNavigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (showInfo ? setShowInfo(false) : onClose())
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'i' || e.key === 'I') setShowInfo((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, showInfo])

  // Info panel is per-photo state, not per-session — start fresh each time
  // the viewed item changes so it doesn't linger while paging through.
  useEffect(() => {
    setShowInfo(false)
  }, [index])

  if (!item) return null
  const src = mediaUrl(item.url)

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-stage">
        {item.type === 'video' ? (
          <video src={src} controls autoPlay onClick={(e) => e.stopPropagation()} />
        ) : (
          <img src={src} alt={item.name} onClick={(e) => e.stopPropagation()} />
        )}
      </div>

      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-bar-left">
          <button className="icon-btn" onClick={onClose} aria-label="Back">
            <IconChevronLeft />
          </button>
          <span className="lightbox-name">{item.name}</span>
        </div>
        <div className="lightbox-bar-right">
          <button
            className={`icon-btn${showInfo ? ' active' : ''}`}
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Info"
          >
            <IconInfo />
          </button>
          <a className="icon-btn" href={src} download={item.name} aria-label="Download">
            <IconDownload />
          </a>
          {actions}
        </div>
      </div>

      {index > 0 ? (
        <button
          className="lightbox-nav prev"
          onClick={(e) => {
            e.stopPropagation()
            prev()
          }}
        >
          ‹
        </button>
      ) : null}
      {index < items.length - 1 ? (
        <button
          className="lightbox-nav next"
          onClick={(e) => {
            e.stopPropagation()
            next()
          }}
        >
          ›
        </button>
      ) : null}

      {showInfo ? (
        <div className="lightbox-info" onClick={(e) => e.stopPropagation()}>
          <h3>Details</h3>
          <div className="info-row">
            <IconCalendar className="info-icon" />
            <div>
              <div className="info-label">{formatDateTime(item.createdAt)}</div>
              <div className="info-sub">
                {item.type} · {item.source}
              </div>
            </div>
          </div>
          {item.size !== null ? (
            <div className="info-row">
              <IconFile className="info-icon" />
              <div className="info-label">{formatBytes(item.size)}</div>
            </div>
          ) : null}
          <div className="info-row">
            <IconMapPin className="info-icon" />
            <div className="info-muted">Location not available</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
