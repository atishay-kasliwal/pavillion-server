import { useEffect, useMemo, useRef, useState } from 'react'
import { useTimeline } from '../hooks/queries'
import { useDeleteImmich } from '../hooks/mutations'
import { MediaGrid } from '../components/MediaGrid'
import { Lightbox } from '../components/Lightbox'
import { AlbumPickerDialog } from '../components/AlbumPickerDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { QuickUploadButton } from '../components/QuickUploadButton'
import { SkeletonGrid } from '../components/Skeleton'
import { EmptyState, ErrorBanner, Spinner } from '../components/basics'
import { IconTrash } from '../components/icons'
import { dateGroupLabel } from '../lib/format'
import type { Item } from '../api/types'

export function GalleryPage() {
  const timeline = useTimeline()
  const deleteImmich = useDeleteImmich()
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showPicker, setShowPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null)
  const [permanent, setPermanent] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const items = useMemo(
    () => timeline.data?.pages.flatMap((p) => p.items) ?? [],
    [timeline.data],
  )

  // Apple Photos-style day sections. The timeline is already newest-first,
  // so a single pass grouping consecutive same-label items is enough — no
  // need to re-sort or bucket by exact date.
  const groups = useMemo(() => {
    const out: { label: string; items: Item[]; startIndex: number }[] = []
    items.forEach((item, i) => {
      const label = dateGroupLabel(item.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(item)
      else out.push({ label, items: [item], startIndex: i })
    })
    return out
  }, [items])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && timeline.hasNextPage && !timeline.isFetchingNextPage) {
        void timeline.fetchNextPage()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [timeline])

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

  const selectedItems = items.filter((i) => selected.has(itemKey(i)))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Photos</h1>
        <QuickUploadButton label="+ Add photos/videos" accept="image/*,video/*" />
      </div>

      {selected.size > 0 ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {selected.size} selected
          </span>
          <button className="btn" onClick={() => setShowPicker(true)}>
            Add to album
          </button>
          <button className="btn" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {timeline.isLoading ? <SkeletonGrid /> : null}
      {timeline.isError ? (
        <ErrorBanner>Couldn&apos;t load the timeline. Is the API reachable?</ErrorBanner>
      ) : null}
      {timeline.isSuccess && items.length === 0 ? (
        <EmptyState>No photos yet — upload some!</EmptyState>
      ) : null}

      {groups.map((g) => (
        <div key={g.startIndex}>
          <div className="date-header">{g.label}</div>
          <MediaGrid
            items={g.items}
            onOpen={(i) => setLightbox(g.startIndex + i)}
            selectedIds={selected}
            onToggleSelect={toggleSelect}
          />
        </div>
      ))}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {timeline.isFetchingNextPage ? <Spinner /> : null}

      {lightbox !== null ? (
        <Lightbox
          items={items}
          index={lightbox}
          onNavigate={setLightbox}
          onClose={() => setLightbox(null)}
          actions={
            <button
              className="icon-btn danger"
              aria-label="Delete"
              onClick={() => {
                setPermanent(false)
                setConfirmDelete(items[lightbox])
              }}
            >
              <IconTrash />
            </button>
          }
        />
      ) : null}

      {showPicker ? (
        <AlbumPickerDialog
          items={selectedItems}
          onDone={() => {
            setShowPicker(false)
            setSelected(new Set())
          }}
          onCancel={() => setShowPicker(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete “${confirmDelete.name}”?`}
          confirmLabel={permanent ? 'Delete permanently' : 'Move to trash'}
          danger
          busy={deleteImmich.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            deleteImmich.mutate(
              { id: confirmDelete.id, permanent },
              {
                onSuccess: () => {
                  setConfirmDelete(null)
                  setLightbox(null)
                },
              },
            )
          }
        >
          <p style={{ color: 'var(--text-dim)', margin: '0 0 8px' }}>
            Trashed items are recoverable for ~30 days from Immich.
          </p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
            />
            Delete permanently instead
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
