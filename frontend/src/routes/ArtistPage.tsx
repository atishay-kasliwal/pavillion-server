import { Link, useParams } from 'react-router-dom'
import { mediaUrl } from '../api/client'
import { useArtistAlbums, useArtists } from '../hooks/queries'
import { SkeletonCards } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'

export function ArtistPage() {
  const { id = '' } = useParams()
  const albums = useArtistAlbums(id)
  const artists = useArtists()
  const artist = artists.data?.artists.find((a) => a.id === id)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <Link to="/music" style={{ color: 'var(--text-muted)' }}>
          ← Music
        </Link>
        <h1 className="page-title">{artist?.name ?? 'Artist'}</h1>
      </div>

      {albums.isLoading ? <SkeletonCards /> : null}
      {albums.isError ? <ErrorBanner>Couldn&apos;t load albums.</ErrorBanner> : null}
      {albums.isSuccess && albums.data.albums.length === 0 ? (
        <EmptyState>No albums for this artist.</EmptyState>
      ) : null}

      <div className="card-grid">
        {albums.data?.albums.map((a) => {
          const thumb = mediaUrl(a.thumbnailUrl)
          return (
            <Link key={a.id} to={`/music/album/${a.id}`} className="card album-card">
              <div className="album-art">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : '💿'}
              </div>
              <div className="album-meta">
                <div className="album-name">{a.name}</div>
                <div className="album-sub">
                  {a.year ? `${a.year} · ` : ''}
                  {a.songCount} songs
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
