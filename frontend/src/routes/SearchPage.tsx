import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mediaUrl } from '../api/client'
import { useSearch } from '../hooks/queries'
import { usePlayer } from '../player/PlayerContext'
import { MediaGrid } from '../components/MediaGrid'
import { Lightbox } from '../components/Lightbox'
import { EmptyState, ErrorBanner, Spinner } from '../components/basics'
import { formatBytes } from '../lib/format'
import type { Item } from '../api/types'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const [input, setInput] = useState(urlQuery)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const player = usePlayer()

  useEffect(() => {
    setInput(urlQuery)
  }, [urlQuery])

  // Debounce input → URL param (which drives the query)
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = input.trim()
      if (trimmed !== urlQuery) setParams(trimmed ? { q: trimmed } : {})
    }, 400)
    return () => clearTimeout(t)
  }, [input, urlQuery, setParams])

  const search = useSearch(urlQuery)

  const groups = useMemo(() => {
    const results = search.data?.results ?? []
    return {
      visual: results.filter((r) => r.type === 'photo' || r.type === 'video'),
      audio: results.filter((r) => r.type === 'audio'),
      files: results.filter((r) => r.type === 'file'),
    }
  }, [search.data])

  const playAudio = (songs: Item[], index: number) => player.playQueue(songs, index)

  return (
    <div>
      <h1 className="page-title">Search</h1>
      <div className="search-bar">
        <input
          className="input"
          placeholder="Search photos, music, files…"
          value={input}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      {search.isFetching ? <Spinner /> : null}

      {search.data?.errors.map((err) => (
        <ErrorBanner key={err.source}>
          Couldn&apos;t search {err.source}: {err.message}
        </ErrorBanner>
      ))}

      {search.isSuccess && search.data.count === 0 ? (
        <EmptyState>No results for “{search.data.query}”.</EmptyState>
      ) : null}

      {groups.visual.length > 0 ? (
        <div className="source-group">
          <h2>Photos &amp; videos</h2>
          <MediaGrid items={groups.visual} onOpen={setLightbox} />
        </div>
      ) : null}

      {groups.audio.length > 0 ? (
        <div className="source-group">
          <h2>Music</h2>
          <div className="row-list">
            {groups.audio.map((song, i) => {
              const cover = mediaUrl(song.thumbnailUrl)
              return (
                <div key={song.id} className="row" onClick={() => playAudio(groups.audio, i)}>
                  <div className="row-icon">
                    {cover ? <img src={cover} alt="" /> : '🎵'}
                  </div>
                  <div className="row-main">
                    <div className="row-name">{song.name}</div>
                    <div className="row-sub">{formatBytes(song.size)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {groups.files.length > 0 ? (
        <div className="source-group">
          <h2>Files</h2>
          <div className="row-list">
            {groups.files.map((file) => {
              const href = mediaUrl(file.url)
              return (
                <a key={file.id} className="row" href={href} download={file.name}>
                  <div className="row-icon">📄</div>
                  <div className="row-main">
                    <div className="row-name">{file.name}</div>
                    <div className="row-sub">{formatBytes(file.size)}</div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      ) : null}

      {lightbox !== null ? (
        <Lightbox
          items={groups.visual}
          index={lightbox}
          onNavigate={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  )
}
