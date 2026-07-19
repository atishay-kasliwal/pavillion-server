import { useState } from 'react'
import { useFolder } from '../hooks/queries'
import { IconCabinet, IconChevronRight, IconFolder } from './icons'

type NodeProps = {
  path: string
  name: string
  depth: number
  currentPath: string
  onNavigate: (path: string) => void
}

// Each node lazy-loads its children only once expanded, so opening the tree
// never fetches more of the archive than what's actually visible.
function TreeNode({ path, name, depth, currentPath, onNavigate }: NodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)
  const folder = useFolder(path, { enabled: expanded })
  const dirs = folder.data?.items.filter((i) => i.isDir) ?? []
  const isCurrent = currentPath === path

  return (
    <div>
      <div
        className={`tree-row${isCurrent ? ' current' : ''}`}
        style={{ paddingLeft: 6 + depth * 16 }}
        onClick={() => onNavigate(path)}
      >
        <button
          className="tree-toggle"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {dirs.length > 0 || !folder.isSuccess ? (
            <IconChevronRight className={`tree-chevron${expanded ? ' open' : ''}`} />
          ) : null}
        </button>
        {depth === 0 ? (
          <IconCabinet className="tree-icon" />
        ) : (
          <IconFolder className="tree-icon" />
        )}
        <span className="tree-label">{name}</span>
      </div>
      {expanded ? (
        folder.isLoading ? (
          <div className="tree-row" style={{ paddingLeft: 6 + (depth + 1) * 16 }}>
            <span className="tree-label" style={{ color: 'var(--text-muted)' }}>
              loading…
            </span>
          </div>
        ) : (
          dirs.map((d) => (
            <TreeNode
              key={d.path}
              path={d.path}
              name={d.name}
              depth={depth + 1}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))
        )
      ) : null}
    </div>
  )
}

type Props = {
  currentPath: string
  onNavigate: (path: string) => void
}

export function FolderTree({ currentPath, onNavigate }: Props) {
  return (
    <nav className="folder-tree" aria-label="Folder structure">
      <TreeNode
        path="/"
        name="root"
        depth={0}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
    </nav>
  )
}
