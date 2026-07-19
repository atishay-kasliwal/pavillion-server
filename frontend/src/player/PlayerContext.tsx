import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { mediaUrl } from '../api/client'
import type { Item } from '../api/types'

type PlayerState = {
  queue: Item[]
  index: number
  playing: boolean
  position: number
  duration: number
  shuffle: boolean
}

type PlayerApi = PlayerState & {
  current: Item | null
  playQueue: (songs: Item[], startIndex: number) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
  stop: () => void
  purgeIds: (ids: string[]) => void
  toggleShuffle: () => void
}

const PlayerContext = createContext<PlayerApi | null>(null)

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: -1,
    playing: false,
    position: 0,
    duration: 0,
    shuffle: false,
  })

  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
  }

  const current = state.index >= 0 ? (state.queue[state.index] ?? null) : null

  const loadAndPlay = useCallback((song: Item) => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = mediaUrl(song.url)
    void audio.play()
  }, [])

  const playQueue = useCallback(
    (songs: Item[], startIndex: number) => {
      const song = songs[startIndex]
      if (!song) return
      setState((s) => ({ ...s, queue: songs, index: startIndex, position: 0 }))
      loadAndPlay(song)
    },
    [loadAndPlay],
  )

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }, [])

  const step = useCallback(
    (delta: number) => {
      setState((s) => {
        // Shuffle only affects "next" — a plain random jump each time
        // rather than a precomputed permutation, which is simple and good
        // enough for a personal music library. "Previous" stays sequential.
        let nextIndex: number
        if (s.shuffle && delta > 0 && s.queue.length > 1) {
          do {
            nextIndex = Math.floor(Math.random() * s.queue.length)
          } while (nextIndex === s.index)
        } else {
          nextIndex = s.index + delta
        }
        const song = s.queue[nextIndex]
        if (!song) return s
        loadAndPlay(song)
        return { ...s, index: nextIndex, position: 0 }
      })
    },
    [loadAndPlay],
  )

  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])

  const toggleShuffle = useCallback(() => {
    setState((s) => ({ ...s, shuffle: !s.shuffle }))
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = seconds
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setState((s) => ({ queue: [], index: -1, playing: false, position: 0, duration: 0, shuffle: s.shuffle }))
  }, [])

  // After a Navidrome rename the old id is dead — drop it from the queue,
  // stopping playback if it was the current song.
  const purgeIds = useCallback(
    (ids: string[]) => {
      setState((s) => {
        if (s.index >= 0 && ids.includes(s.queue[s.index]?.id ?? '')) {
          stop()
          return s
        }
        const queue = s.queue.filter((q) => !ids.includes(q.id))
        const currentId = s.queue[s.index]?.id
        const index = queue.findIndex((q) => q.id === currentId)
        return { ...s, queue, index }
      })
    },
    [stop],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setState((s) => ({ ...s, playing: true }))
    const onPause = () => setState((s) => ({ ...s, playing: false }))
    const onTime = () =>
      setState((s) => ({
        ...s,
        position: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }))
    const onEnded = () => step(1)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onTime)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [step])

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      current,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      stop,
      purgeIds,
      toggleShuffle,
    }),
    [state, current, playQueue, toggle, next, prev, seek, stop, purgeIds, toggleShuffle],
  )

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>
}
