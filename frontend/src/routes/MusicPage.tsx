import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useArtists } from '../hooks/queries'
import { randomSongs } from '../api/endpoints'
import { usePlayer } from '../player/PlayerContext'
import { pushToast } from '../lib/toast'
import { QuickUploadButton } from '../components/QuickUploadButton'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import { IconShuffle } from '../components/icons'

export function MusicPage() {
  const artists = useArtists()
  const player = usePlayer()
  const [shuffling, setShuffling] = useState(false)

  const hasMusic = (artists.data?.artists.length ?? 0) > 0

  // Shuffle the whole library right from the Music tab — grab a random
  // cross-library set and start playing immediately, with shuffle on so
  // "next" keeps jumping around rather than marching through the fetched
  // order.
  const shuffleAll = async () => {
    setShuffling(true)
    try {
      const { songs } = await randomSongs()
      if (songs.length === 0) {
        pushToast('No music to shuffle yet', 'error')
        return
      }
      if (!player.shuffle) player.toggleShuffle()
      player.playQueue(songs, 0)
    } catch {
      pushToast('Couldn’t start shuffle', 'error')
    } finally {
      setShuffling(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Music</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {hasMusic ? (
            <button className="btn" onClick={shuffleAll} disabled={shuffling}>
              <IconShuffle className="btn-icon" />
              {shuffling ? 'Shuffling…' : 'Shuffle all'}
            </button>
          ) : null}
          <QuickUploadButton label="+ Add music" accept="audio/*" />
        </div>
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
