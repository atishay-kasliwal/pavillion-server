// Loading placeholders shaped like the content they'll become, so layout
// doesn't jump when data arrives.

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="media-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="media-tile skeleton" />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 8 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card album-card">
          <div className="album-art skeleton" />
          <div className="album-meta">
            <div className="skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton-line" style={{ width: '40%', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="row-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="row" style={{ cursor: 'default' }}>
          <div className="row-icon skeleton" />
          <div className="row-main">
            <div className="skeleton-line" style={{ width: '55%' }} />
            <div className="skeleton-line" style={{ width: '28%', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
