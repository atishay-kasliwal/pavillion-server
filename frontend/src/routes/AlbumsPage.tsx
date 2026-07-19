import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '../api/client'
import { useAlbums } from '../hooks/queries'
import { useCreateAlbum } from '../hooks/mutations'
import { SkeletonCards } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import { useEscapeKey } from '../lib/useEscapeKey'

export function AlbumsPage() {
  const albums = useAlbums()
  const createAlbum = useCreateAlbum()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  useEscapeKey(() => setCreating(false), creating)

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createAlbum.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setCreating(false)
          setName('')
        },
      },
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Albums</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          + New album
        </button>
      </div>

      {albums.isLoading ? <SkeletonCards /> : null}
      {albums.isError ? <ErrorBanner>Couldn&apos;t load albums.</ErrorBanner> : null}
      {albums.isSuccess && albums.data.albums.length === 0 ? (
        <EmptyState>No albums yet.</EmptyState>
      ) : null}

      <div className="card-grid">
        {albums.data?.albums.map((a) => {
          const thumb = mediaUrl(a.thumbnailUrl)
          return (
            <Link key={a.id} to={`/albums/${a.id}`} className="card album-card">
              <div className="album-art">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : '📚'}
              </div>
              <div className="album-meta">
                <div className="album-name">{a.name}</div>
                <div className="album-sub">{a.assetCount} items</div>
              </div>
            </Link>
          )
        })}
      </div>

      {creating ? (
        <div className="dialog-backdrop" onClick={() => setCreating(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>New album</h3>
            <input
              className="input"
              placeholder="Album name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={create}
                disabled={createAlbum.isPending || !name.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
