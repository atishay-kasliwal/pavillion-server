import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mediaUrl } from '../api/client'
import { useAlbumSongs } from '../hooks/queries'
import { useDeleteSong, useRenameSong } from '../hooks/mutations'
import { usePlayer } from '../player/PlayerContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import { formatBytes } from '../lib/format'
import { useEscapeKey } from '../lib/useEscapeKey'
import type { Item } from '../api/types'

export function MusicAlbumPage() {
  const { id = '' } = useParams()
  const songsQuery = useAlbumSongs(id)
  const player = usePlayer()
  const deleteSong = useDeleteSong()
  const renameSong = useRenameSong()
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null)
  const [renaming, setRenaming] = useState<Item | null>(null)
  const [newPath, setNewPath] = useState('')
  useEscapeKey(() => setRenaming(null), renaming !== null)

  const songs = songsQuery.data?.songs ?? []

  const startRename = (song: Item) => {
    setRenaming(song)
    setNewPath('')
  }

  const doRename = () => {
    if (!renaming || !newPath.trim()) return
    const oldId = renaming.id
    renameSong.mutate(
      { id: oldId, path: newPath.trim() },
      {
        onSuccess: () => {
          // The old id is dead after a rename — purge it from the player queue.
          player.purgeIds([oldId])
          setRenaming(null)
        },
      },
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <Link to="/music" style={{ color: 'var(--text-muted)' }}>
          ← Music
        </Link>
        <h1 className="page-title">Album</h1>
      </div>

      {songsQuery.isLoading ? <SkeletonRows /> : null}
      {songsQuery.isError ? <ErrorBanner>Couldn&apos;t load songs.</ErrorBanner> : null}
      {songsQuery.isSuccess && songs.length === 0 ? (
        <EmptyState>No songs in this album.</EmptyState>
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
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                <button className="row-action" onClick={() => startRename(song)}>
                  Rename
                </button>
                <button
                  className="row-action danger"
                  onClick={() => setConfirmDelete(song)}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete “${confirmDelete.name}”?`}
          confirmLabel="Delete"
          danger
          busy={deleteSong.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const target = confirmDelete
            deleteSong.mutate(target.id, {
              onSuccess: () => {
                player.purgeIds([target.id])
                setConfirmDelete(null)
              },
            })
          }}
        >
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>
            This permanently deletes the file from the music library.
          </p>
        </ConfirmDialog>
      ) : null}

      {renaming ? (
        <div className="dialog-backdrop" onClick={() => setRenaming(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Move / rename song</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 0 }}>
              New path relative to the music library root, e.g.{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>
                Artist/Album/track.mp3
              </code>
            </p>
            <input
              className="input"
              placeholder="new/relative/path.mp3"
              value={newPath}
              autoFocus
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doRename()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={doRename}
                disabled={renameSong.isPending || !newPath.trim()}
              >
                {renameSong.isPending ? '…' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
