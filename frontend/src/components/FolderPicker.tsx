import { useState } from 'react'
import { useFolder } from '../hooks/queries'
import { Breadcrumbs } from './Breadcrumbs'
import { Spinner } from './basics'
import { useEscapeKey } from '../lib/useEscapeKey'

type Props = {
  onPick: (path: string) => void
  onCancel: () => void
}

export function FolderPicker({ onPick, onCancel }: Props) {
  const [path, setPath] = useState('/')
  const folder = useFolder(path)
  useEscapeKey(onCancel)
  const dirs = folder.data?.items.filter((i) => i.isDir) ?? []

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Choose destination folder</h3>
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
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onPick(path)}>
            Use {path === '/' ? 'root' : path}
          </button>
        </div>
      </div>
    </div>
  )
}
