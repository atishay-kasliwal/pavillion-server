import { Link } from 'react-router-dom'
import { useArtists } from '../hooks/queries'
import { QuickUploadButton } from '../components/QuickUploadButton'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'

export function MusicPage() {
  const artists = useArtists()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Music</h1>
        <QuickUploadButton label="+ Add music" accept="audio/*" />
      </div>

      {artists.isLoading ? <SkeletonRows /> : null}
      {artists.isError ? <ErrorBanner>Couldn&apos;t load artists.</ErrorBanner> : null}
      {artists.isSuccess && artists.data.artists.length === 0 ? (
        <EmptyState>No music yet — upload some audio files!</EmptyState>
      ) : null}

      <div className="row-list">
        {artists.data?.artists.map((a) => (
          <Link key={a.id} to={`/music/artist/${a.id}`} className="row">
            <div className="row-icon">🎤</div>
            <div className="row-main">
              <div className="row-name">{a.name}</div>
              <div className="row-sub">
                {a.albumCount} {a.albumCount === 1 ? 'album' : 'albums'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
