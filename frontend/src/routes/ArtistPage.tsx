import { Link, useParams } from 'react-router-dom'
import { mediaUrl } from '../api/client'
import { useArtistSongs, useArtists } from '../hooks/queries'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import { formatBytes } from '../lib/format'
import { usePlayer } from '../player/PlayerContext'

export function ArtistPage() {
  const { id = '' } = useParams()
  const songsQuery = useArtistSongs(id)
  const artists = useArtists()
  const artist = artists.data?.artists.find((a) => a.id === id)
  const player = usePlayer()

  const songs = songsQuery.data?.songs ?? []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <Link to="/music" style={{ color: 'var(--text-muted)' }}>
          ← Music
        </Link>
        <h1 className="page-title">{artist?.name ?? 'Artist'}</h1>
      </div>

      {songsQuery.isLoading ? <SkeletonRows /> : null}
      {songsQuery.isError ? <ErrorBanner>Couldn&apos;t load music.</ErrorBanner> : null}
      {songsQuery.isSuccess && songs.length === 0 ? (
        <EmptyState>No music for this artist.</EmptyState>
      ) : null}

      <div className="row-list">
        {songs.map((song, i) => {
          const cover = mediaUrl(song.thumbnailUrl)
          const isCurrent = player.current?.id === song.id
          return (
            <div
              key={song.id}
              className="row"
              onClick={() => player.playQueue(songs, i)}
            >
              <div className="row-icon">
                {cover ? <img src={cover} alt="" /> : '🎵'}
              </div>
              <div className="row-main">
                <div
                  className="row-name"
                  style={isCurrent ? { color: 'var(--accent-soft)' } : undefined}
                >
                  {isCurrent && player.playing ? '▸ ' : ''}
                  {song.name}
                </div>
                <div className="row-sub">{formatBytes(song.size)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
