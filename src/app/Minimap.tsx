import { useEffect, useRef } from 'react'
import type { AppPhase } from '../store/appSlice'
import {
  readMinimapSnapshot,
  worldToMinimap,
  type MinimapSnapshot,
} from '../game/minimap'

/** Rendered size of the minimap canvas, in CSS pixels (a small radar square). */
const MINIMAP_SIZE = 140
/** Radius (px) of the various radar dots. */
const PLAYER_DOT = 3.5
const CARAVAN_DOT = 3
const THREAT_DOT = 2.5
/** Length (px) of the player's facing indicator line. */
const FACING_LEN = 9

const COLOR_BG = 'rgba(12, 16, 12, 0.55)'
const COLOR_BORDER = 'rgba(255, 255, 255, 0.35)'
const COLOR_PLAYER = '#7fd4ff'
const COLOR_CARAVAN = '#ffcc33'
const COLOR_THREAT = '#ff5145'

export interface MinimapProps {
  /** Current app phase; the radar only draws during live `playing`. */
  phase: AppPhase
  /**
   * Source of the latest radar frame. Defaults to the scene→HUD bridge
   * ({@link readMinimapSnapshot}); tests inject a stub to drive the draw.
   */
  getSnapshot?: () => MinimapSnapshot | null
  /** Optional objective counter (caravans raided / target) shown under the radar. */
  objectiveDone?: number
  objectiveTarget?: number
}

/**
 * Bottom-centre HUD radar (FLO-449). Owns its own `<canvas>` and a
 * `requestAnimationFrame` draw loop that reads the latest {@link MinimapSnapshot}
 * from the scene bridge and paints it imperatively — never through React state,
 * so the player/enemy positions that live only in the Babylon scene never force
 * a React re-render (perf budget). The canvas is `pointer-events: none` so it
 * never eats clicks meant for the world.
 *
 * Renders nothing outside live play, matching the spec ("hidden in menu").
 */
export function Minimap({
  phase,
  getSnapshot = readMinimapSnapshot,
  objectiveDone,
  objectiveTarget,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Keep the latest getSnapshot in a ref so the rAF loop always calls the
  // current source without re-arming the effect (and restarting the loop).
  const getSnapshotRef = useRef(getSnapshot)
  getSnapshotRef.current = getSnapshot

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / headless: no 2D context — skip drawing

    // Size the backing store for crisp rendering on hi-dpi displays while the
    // CSS size stays MINIMAP_SIZE. Guard devicePixelRatio for jsdom.
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
    canvas.width = MINIMAP_SIZE * dpr
    canvas.height = MINIMAP_SIZE * dpr
    ctx.scale(dpr, dpr)

    let frameId = 0
    const draw = () => {
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

      // Backdrop.
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

      const snapshot = getSnapshotRef.current()
      if (snapshot) {
        // The radar is zoomed in and centred on the player, who stays pinned at
        // the canvas centre while the world pans beneath (FLO-467). Clip markers
        // to the frame so blips outside the zoomed window are cut off at the
        // edges instead of piling up on the rim.
        const center = snapshot.player
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
        ctx.clip()

        // Caravans (objective) — gold.
        ctx.fillStyle = COLOR_CARAVAN
        for (const c of snapshot.caravans) {
          const p = worldToMinimap(c.x, c.z, MINIMAP_SIZE, center)
          ctx.beginPath()
          ctx.arc(p.x, p.y, CARAVAN_DOT, 0, Math.PI * 2)
          ctx.fill()
        }

        // Threats (soldiers + archers) — red.
        ctx.fillStyle = COLOR_THREAT
        for (const s of snapshot.soldiers) {
          const p = worldToMinimap(s.x, s.z, MINIMAP_SIZE, center)
          ctx.beginPath()
          ctx.arc(p.x, p.y, THREAT_DOT, 0, Math.PI * 2)
          ctx.fill()
        }

        // Player — dot + facing line, fixed at the centre. World forward at yaw 0
        // is +Z (up on the radar); +X is east (right). So facing = (sin yaw,
        // -cos yaw) in px.
        const pp = worldToMinimap(center.x, center.z, MINIMAP_SIZE, center)
        const fx = Math.sin(snapshot.player.rotationY)
        const fy = -Math.cos(snapshot.player.rotationY)
        ctx.strokeStyle = COLOR_PLAYER
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(pp.x, pp.y)
        ctx.lineTo(pp.x + fx * FACING_LEN, pp.y + fy * FACING_LEN)
        ctx.stroke()
        ctx.fillStyle = COLOR_PLAYER
        ctx.beginPath()
        ctx.arc(pp.x, pp.y, PLAYER_DOT, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }

      // World-bounds frame, drawn on top so clipped markers tuck under it.
      ctx.strokeStyle = COLOR_BORDER
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, MINIMAP_SIZE - 1, MINIMAP_SIZE - 1)

      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(frameId)
  }, [phase])

  if (phase !== 'playing') return null

  const hasObjective = objectiveTarget !== undefined && objectiveDone !== undefined

  return (
    <div className="hud-minimap" aria-label="Minimap radar">
      <canvas
        ref={canvasRef}
        className="hud-minimap-canvas"
        data-testid="minimap-canvas"
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
        aria-hidden="true"
      />
      {hasObjective ? (
        <span className="hud-minimap-label">
          Caravans {Math.min(objectiveDone, objectiveTarget)}/{objectiveTarget}
        </span>
      ) : null}
    </div>
  )
}
