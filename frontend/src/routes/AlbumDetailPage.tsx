import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAlbum, useAlbums } from '../hooks/queries'
import { useAddAlbumAssets, useRemoveAlbumAssets } from '../hooks/mutations'
import { MediaGrid } from '../components/MediaGrid'
import { Lightbox } from '../components/Lightbox'
import { QuickUploadButton } from '../components/QuickUploadButton'
import { SkeletonGrid } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import type { Item, UploadResult } from '../api/types'

export function AlbumDetailPage() {
  const { id = '' } = useParams()
  const album = useAlbum(id)
  const albums = useAlbums()
  const removeAssets = useRemoveAlbumAssets()
  const addAssets = useAddAlbumAssets()
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Immich's upload response includes the created asset — build an Item from
  // it (using the known /api/media/immich/:id/... shapes) so a freshly
  // uploaded photo can go straight into this album without a re-browse.
  const handleUploaded = (result: UploadResult, file: File) => {
    if (result.destination !== 'immich') return
    const asset = result.asset as
      | { id: string; originalFileName?: string; fileCreatedAt?: string }
      | undefined
    if (!asset?.id) return
    const item: Item = {
      source: 'immich',
      type: file.type.startsWith('video/') ? 'video' : 'photo',
      id: asset.id,
      name: asset.originalFileName ?? file.name,
      createdAt: asset.fileCreatedAt ?? null,
      size: file.size,
      thumbnailUrl: `/api/media/immich/${asset.id}/thumbnail`,
      url: `/api/media/immich/${asset.id}/original`,
    }
    addAssets.mutate({ albumId: id, items: [item] })
  }

  const meta = albums.data?.albums.find((a) => a.id === id)
  const items = album.data?.items ?? []

  const itemKey = (item: Item) => `${item.source}:${item.id}`

  const toggleSelect = (item: Item) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const key = itemKey(item)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/albums" style={{ color: 'var(--text-muted)' }}>
            ← Albums
          </Link>
          <h1 className="page-title">{meta?.name ?? 'Album'}</h1>
        </div>
        <QuickUploadButton
          label="+ Add photos"
          accept="image/*,video/*"
          onUploaded={handleUploaded}
        />
      </div>

      {selected.size > 0 ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {selected.size} selected
          </span>
          <button
            className="btn danger"
            disabled={removeAssets.isPending}
            onClick={() =>
              removeAssets.mutate(
                { albumId: id, assetIds: [...selected] },
                { onSuccess: () => setSelected(new Set()) },
              )
            }
          >
            Remove from album
          </button>
          <button className="btn" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {album.isLoading ? <SkeletonGrid /> : null}
      {album.isError ? <ErrorBanner>Couldn&apos;t load this album.</ErrorBanner> : null}
      {album.isSuccess && items.length === 0 ? (
        <EmptyState>This album is empty.</EmptyState>
      ) : null}

      <MediaGrid
        items={items}
        onOpen={setLightbox}
        selectedIds={selected}
        onToggleSelect={toggleSelect}
      />

      {lightbox !== null ? (
        <Lightbox
          items={items}
          index={lightbox}
          onNavigate={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  )
}
