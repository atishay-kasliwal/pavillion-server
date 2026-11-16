import { useState } from 'react'
import { useFolder } from '../hooks/queries'
import { Breadcrumbs } from './Breadcrumbs'
import { Spinner } from './basics'
import { useEscapeKey } from '../lib/useEscapeKey'

type Props = {
  onPick: (path: string) => void
  onCancel: () => void
  // Optional title override (e.g. "Move X to…") and a starting folder.
  title?: string
  initialPath?: string
  // Verb on the confirm button ("Use" for choosing an upload folder, "Move
  // here" when relocating an entry).
  confirmVerb?: string
  // A folder path that can't be a destination and can't be entered — used
  // when moving a folder, so you can't drop it inside itself or a descendant.
  // Its own subtree is filtered out of the listing and blocked as a target.
  excludePath?: string
  // A path already ruled out as the destination (e.g. the folder the item is
  // already in) — offered for navigation but the confirm button is disabled.
  disablePath?: string
}

// True when `candidate` is `base` or lives inside it — so a folder can't be
// moved into itself or any of its own descendants.
function isSelfOrDescendant(candidate: string, base: string): boolean {
  return candidate === base || candidate.startsWith(base.endsWith('/') ? base : `${base}/`)
}

export function FolderPicker({
  onPick,
  onCancel,
  title = 'Choose destination folder',
  initialPath = '/',
  confirmVerb = 'Use',
  excludePath,
  disablePath,
}: Props) {
  const [path, setPath] = useState(initialPath)
  const folder = useFolder(path)
  useEscapeKey(onCancel)
  const dirs = (folder.data?.items.filter((i) => i.isDir) ?? []).filter(
    (d) => !excludePath || !isSelfOrDescendant(d.path, excludePath),
  )

  // A destination is invalid if it's inside the moved folder's own subtree,
  // or it's the folder the item already sits in.
  const blockedBySelf = excludePath ? isSelfOrDescendant(path, excludePath) : false
  const blockedByCurrent = disablePath ? path === disablePath : false
  const canUse = !blockedBySelf && !blockedByCurrent

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <Breadcrumbs path={folder.data?.path ?? path} onNavigate={setPath} />
        {folder.isLoading ? <Spinner /> : null}
        <div className="row-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {dirs.map((d) => (
            <div key={d.path} className="row" onClick={() => setPath(d.path)}>
              <div className="row-icon">📁</div>
              <div className="row-main">
                <div className="row-name">{d.name}</div>
              </div>
            </div>
          ))}
          {folder.isSuccess && dirs.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              No subfolders here.
            </div>
          ) : null}
        </div>
        {blockedByCurrent ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', margin: '4px 0 0' }}>
            Already in this folder — pick a different one.
          </p>
        ) : blockedBySelf ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', margin: '4px 0 0' }}>
            Can’t move a folder into itself.
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onPick(path)} disabled={!canUse}>
            {confirmVerb} {path === '/' ? 'root' : path}
          </button>
        </div>
      </div>
    </div>
  )
}
