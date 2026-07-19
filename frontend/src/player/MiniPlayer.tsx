import { mediaUrl } from '../api/client'
import { formatDuration } from '../lib/format'
import { usePlayer } from './PlayerContext'

export function MiniPlayer() {
  const player = usePlayer()
  const { current } = player
  if (!current) return null

  const cover = mediaUrl(current.thumbnailUrl)

  return (
    <div className="mini-player">
      <div className="cover">
        {cover ? <img src={cover} alt="" /> : null}
      </div>
      <div className="track-info">
        <div className="track-name">{current.name}</div>
        <div className="row-sub">
          {player.index + 1} / {player.queue.length}
        </div>
      </div>
      <div className="controls">
        <button className="ctrl" onClick={player.prev} title="Previous">
          ⏮
        </button>
        <button className="ctrl play" onClick={player.toggle} title="Play/pause">
          {player.playing ? '⏸' : '▶'}
        </button>
        <button className="ctrl" onClick={player.next} title="Next">
          ⏭
        </button>
      </div>
      <div className="seek">
        <span>{formatDuration(player.position)}</span>
        <input
          type="range"
          min={0}
          max={player.duration || 0}
          step={1}
          value={player.position}
          onChange={(e) => player.seek(Number(e.target.value))}
        />
        <span>{formatDuration(player.duration)}</span>
      </div>
      <button className="close" onClick={player.stop} title="Close player">
        ✕
      </button>
    </div>
  )
}
