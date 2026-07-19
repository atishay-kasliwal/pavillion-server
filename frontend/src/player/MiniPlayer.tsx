import { usePlayer } from './PlayerContext'
import { formatDuration } from '../lib/format'
import {
  IconPause,
  IconPlay,
  IconShuffle,
  IconSkipBack,
  IconSkipForward,
  IconX,
} from '../components/icons'

// A compact, self-contained player that lives in the middle of the topbar:
// a transport row with the seek bar directly beneath it (scoped to the
// player's own width, not stretched across the whole topbar — so nothing
// overlays the seek track and it's fully grabbable).
export function MiniPlayer() {
  const player = usePlayer()
  const { current } = player
  if (!current) return null

  const duration = player.duration || 0
  const pct = duration > 0 ? (player.position / duration) * 100 : 0

  return (
    <div className="topbar-player">
      <div className="topbar-player-controls">
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

      <div className="topbar-seek">
        <span className="topbar-seek-time">{formatDuration(player.position)}</span>
        <div className="topbar-seek-bar">
          {/* A filled progress line under the input purely for looks — the
              range input itself (transparent track) is what you actually drag. */}
          <div className="topbar-seek-fill" style={{ width: `${pct}%` }} />
          <input
            type="range"
            className="topbar-seek-input"
            min={0}
            max={duration}
            step={0.1}
            value={player.position}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label="Seek"
          />
        </div>
        <span className="topbar-seek-time">{formatDuration(duration)}</span>
      </div>
    </div>
  )
}
