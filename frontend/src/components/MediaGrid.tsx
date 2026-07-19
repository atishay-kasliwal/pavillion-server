import { mediaUrl } from '../api/client'
import type { Item } from '../api/types'

type Props = {
  items: Item[]
  onOpen: (index: number) => void
  selectedIds?: Set<string>
  onToggleSelect?: (item: Item) => void
}

export function MediaGrid({ items, onOpen, selectedIds, onToggleSelect }: Props) {
  const selecting = (selectedIds?.size ?? 0) > 0
  const itemKey = (item: Item) => `${item.source}:${item.id}`
  return (
    <div className={`media-grid${selecting ? ' selecting' : ''}`}>
      {items.map((item, i) => {
        const selected = selectedIds?.has(itemKey(item)) ?? false
        const thumb = mediaUrl(item.thumbnailUrl)
        return (
          <div
            key={itemKey(item)}
            className={`media-tile${selected ? ' selected' : ''}`}
            onClick={() => {
              if (selecting && onToggleSelect) onToggleSelect(item)
              else onOpen(i)
            }}
          >
            {thumb ? (
              <img src={thumb} alt={item.name} loading="lazy" />
            ) : (
              <div className="tile-placeholder">
                {item.type === 'video' ? '🎬' : '🖼'}
              </div>
            )}
            {onToggleSelect ? (
              <div
                className="tile-check"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect(item)
                }}
              >
                {selected ? '✓' : ''}
              </div>
            ) : null}
            {item.type === 'video' ? <div className="tile-badge">▶</div> : null}
          </div>
        )
      })}
    </div>
  )
}
