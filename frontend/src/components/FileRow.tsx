import { useRecursiveStats } from '../hooks/queries'
import { formatBytes, formatDate } from '../lib/format'
import { IconFile, IconFolder } from './icons'
import type { FbEntry } from '../api/types'

type Props = {
  entry: FbEntry
  download: string | null
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
}

// A folder's size column recomputes recursively on demand, mirroring
// Finder's own "Calculating size…" behavior for directories.
export function FileRow({ entry, download, onOpen, onRename, onMove, onDelete }: Props) {
  const stats = useRecursiveStats(entry.path, entry.isDir)

  const sizeLabel = entry.isDir
    ? stats.isLoading
      ? 'Calculating…'
      : stats.data
        ? formatBytes(stats.data.totalBytes)
        : '—'
    : formatBytes(entry.size)

  const countLabel = entry.isDir && stats.data ? `${stats.data.totalFiles} items` : null

  return (
    <div className="row file-row" onClick={onOpen}>
      <div className="row-icon">
        {entry.isDir ? <IconFolder className="row-svg" /> : <IconFile className="row-svg" />}
      </div>
      <div className="row-main">
        <div className="row-name">{entry.name}</div>
        {countLabel ? <div className="row-sub">{countLabel}</div> : null}
      </div>
      <div className="col-size">{sizeLabel}</div>
      <div className="col-date">{formatDate(entry.modified)}</div>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {download ? (
          <a className="row-action" href={download} download={entry.name}>
            Download
          </a>
        ) : null}
        <button className="row-action" onClick={onRename}>
          Rename
        </button>
        <button className="row-action" onClick={onMove}>
          Move
        </button>
        <button className="row-action danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
