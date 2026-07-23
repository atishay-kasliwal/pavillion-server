import { useState } from 'react'
import { useMusicSongs } from '../hooks/queries'
import { usePlayer } from '../player/PlayerContext'
import { pushToast } from '../lib/toast'
import { QuickUploadButton } from '../components/QuickUploadButton'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import { IconClock, IconShuffle } from '../components/icons'
import { mediaUrl } from '../api/client'
import { formatBytes } from '../lib/format'

export function MusicPage() {
  const songsQuery = useMusicSongs()
  const player = usePlayer()
  const [shuffling, setShuffling] = useState(false)

  const songs = songsQuery.data?.songs ?? []
  const hasMusic = songs.length > 0
  const recentSongs = player.recent.slice(0, 21)

  const shuffleQueue = [...songs]
  for (let i = shuffleQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffleQueue[i], shuffleQueue[j]] = [shuffleQueue[j], shuffleQueue[i]]
  }

  // Shuffle the whole library right from the Music tab using the full song
  // list, then turn shuffle on so "next" keeps jumping around.
  const shuffleAll = async () => {
    if (!songs.length) return
    setShuffling(true)
    try {
      if (!player.shuffle) player.toggleShuffle()
      player.playQueue(shuffleQueue, 0)
    } catch {
      pushToast('Couldn’t start shuffle', 'error')
    } finally {
      setShuffling(false)
    }
  }

  const playSong = (songId: string) => {
    const index = songs.findIndex((song) => song.id === songId)
    const queue = index >= 0 ? songs : recentSongs
    const queueIndex = index >= 0 ? index : queue.findIndex((song) => song.id === songId)
    if (queue.length === 0) return
    if (queueIndex < 0) return
    player.playQueue(queue, queueIndex)
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

      {songsQuery.isLoading ? <SkeletonRows /> : null}
      {songsQuery.isError ? <ErrorBanner>Couldn&apos;t load music.</ErrorBanner> : null}
      {songsQuery.isSuccess && songs.length === 0 ? (
        <EmptyState>No music yet — upload some audio files!</EmptyState>
      ) : null}

      {recentSongs.length > 0 ? (
        <section className="music-section">
          <div className="music-section-head">
            <div className="music-section-kicker">
              <IconClock className="btn-icon" />
              Recently played
            </div>
          </div>
          <div className="row-list recent-row-list">
            {recentSongs.map((song) => {
              const cover = mediaUrl(song.thumbnailUrl)
              const isCurrent = player.current?.id === song.id
              return (
                <div key={`recent-${song.id}`} className="row" onClick={() => playSong(song.id)}>
                  <div className="row-icon">{cover ? <img src={cover} alt="" /> : '🎵'}</div>
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
        </section>
      ) : null}

      {recentSongs.length > 0 ? <div className="music-divider" /> : null}

      <div className="row-list">
        {songs.map((song, i) => {
          const cover = mediaUrl(song.thumbnailUrl)
          const isCurrent = player.current?.id === song.id
          return (
            <div key={song.id} className="row" onClick={() => player.playQueue(songs, i)}>
              <div className="row-icon">{cover ? <img src={cover} alt="" /> : '🎵'}</div>
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
      {hasMusic ? (
        <div style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          All tracks from the music library are shown here directly. Use Shuffle all to
          start a full-library random queue.
        </div>
      ) : null}
    </div>
  )
}
