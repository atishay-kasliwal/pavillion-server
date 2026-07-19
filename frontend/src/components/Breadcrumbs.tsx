// Crumbs are derived by splitting the server-returned path — each crumb links
// to its own prefix, which is itself a server-normalized path.
type Props = {
  path: string
  onNavigate: (path: string) => void
}

export function Breadcrumbs({ path, onNavigate }: Props) {
  const parts = path.split('/').filter(Boolean)
  const prefixes = parts.map((_, i) => '/' + parts.slice(0, i + 1).join('/'))

  return (
    <div className="breadcrumbs">
      <button
        className={`crumb${parts.length === 0 ? ' current' : ''}`}
        onClick={() => onNavigate('/')}
      >
        root
      </button>
      {parts.map((part, i) => (
        <span key={prefixes[i]}>
          <span className="sep">/</span>
          <button
            className={`crumb${i === parts.length - 1 ? ' current' : ''}`}
            onClick={() => onNavigate(prefixes[i])}
          >
            {part}
          </button>
        </span>
      ))}
    </div>
  )
}
