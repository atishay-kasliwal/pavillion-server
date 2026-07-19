import { usePlayer } from './PlayerContext'
import {
  IconPause,
  IconPlay,
  IconShuffle,
  IconSkipBack,
  IconSkipForward,
  IconX,
} from '../components/icons'

// Lives inside the topbar rather than a bottom bar (see App.tsx) — the
// track transport sits in the middle row, and the seek control is a thin
// draggable strip along the topbar's bottom edge so it doesn't need its
// own row of vertical space.
export function MiniPlayer() {
  const player = usePlayer()
  const { current } = player
  if (!current) return null

  return (
    <>
      <div className="topbar-player">
        <button
          className={`ctrl-icon${player.shuffle ? ' active' : ''}`}
          onClick={player.toggleShuffle}
          title="Shuffle"
          aria-label="Shuffle"
          aria-pressed={player.shuffle}
        >
          <IconShuffle />
        </button>
        <button className="ctrl-icon" onClick={player.prev} title="Previous" aria-label="Previous">
          <IconSkipBack />
        </button>
        <button
          className="ctrl-icon play"
          onClick={player.toggle}
          title="Play/pause"
          aria-label="Play/pause"
        >
          {player.playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="ctrl-icon" onClick={player.next} title="Next" aria-label="Next">
          <IconSkipForward />
        </button>
        <span className="topbar-player-name">{current.name}</span>
        <button
          className="ctrl-icon"
          onClick={player.stop}
          title="Close player"
          aria-label="Close player"
        >
          <IconX />
        </button>
      </div>
      <input
        type="range"
        className="topbar-seek-input"
        min={0}
        max={player.duration || 0}
        step={0.1}
        value={player.position}
        onChange={(e) => player.seek(Number(e.target.value))}
        aria-label="Seek"
      />
    </>
  )
}
