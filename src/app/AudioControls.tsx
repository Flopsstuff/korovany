import { useEffect, useState } from 'react'
import { audioBus } from '../game/audio'

/**
 * Mute toggle + master-volume slider, reachable from the pause menu. The
 * {@link audioBus} owns the canonical state (persisted to `localStorage`); this
 * component write-through-updates it and re-renders off `audioBus.subscribe`, so
 * any other surface that changes audio settings stays in sync.
 */
export function AudioControls() {
  const [muted, setMuted] = useState(() => audioBus.isMuted())
  const [volume, setVolume] = useState(() => audioBus.getVolume())

  useEffect(() => {
    return audioBus.subscribe((s) => {
      setMuted(s.muted)
      setVolume(s.volume)
    })
  }, [])

  return (
    <div className="audio-controls" role="group" aria-label="Audio settings">
      <button
        type="button"
        className="audio-mute-toggle"
        aria-pressed={muted}
        onClick={() => audioBus.setMuted(!muted)}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <label className="audio-volume">
        <span className="audio-volume-label">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          disabled={muted}
          aria-label="Master volume"
          onChange={(e) => audioBus.setVolume(Number(e.target.value) / 100)}
        />
      </label>
    </div>
  )
}
