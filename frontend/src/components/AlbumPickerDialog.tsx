import { useState } from 'react'
import { useAlbums } from '../hooks/queries'
import { useAddAlbumAssets, useCreateAlbum } from '../hooks/mutations'
import type { Item } from '../api/types'
import { Spinner } from './basics'
import { useEscapeKey } from '../lib/useEscapeKey'

type Props = {
  items: Item[]
  onDone: () => void
  onCancel: () => void
}

export function AlbumPickerDialog({ items, onDone, onCancel }: Props) {
  const albums = useAlbums()
  const addAssets = useAddAlbumAssets()
  const createAlbum = useCreateAlbum()
  const [newName, setNewName] = useState('')

  const busy = addAssets.isPending || createAlbum.isPending
  useEscapeKey(onCancel, !busy)

  const addTo = (albumId: string) => {
    addAssets.mutate({ albumId, items }, { onSuccess: onDone })
  }

  const createAndAdd = () => {
    const name = newName.trim()
    if (!name) return
    createAlbum.mutate(
      { name, assetIds: items.map((i) => i.id) },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>
          Add {items.length} {items.length === 1 ? 'item' : 'items'} to album
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="input"
            placeholder="New album name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
          />
          <button
            className="btn primary"
            onClick={createAndAdd}
            disabled={busy || !newName.trim()}
          >
            Create
          </button>
        </div>
        {albums.isLoading ? <Spinner /> : null}
        <div className="row-list">
          {albums.data?.albums.map((a) => (
            <button
              key={a.id}
              className="row"
              onClick={() => addTo(a.id)}
              disabled={busy}
              style={{ textAlign: 'left' }}
            >
              <div className="row-main">
                <div className="row-name">{a.name}</div>
                <div className="row-sub">{a.assetCount} items</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
