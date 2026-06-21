/**
 * Minimap radar bridge (FLO-449).
 *
 * The HUD minimap shows where the player is and where the caravans (the raid
 * objective) and threats sit, in a top-down radar. Crucially, live player and
 * enemy world positions live ONLY in the Babylon scene — never Redux — so the
 * minimap must not stream positions through React/Redux state every frame (a
 * 60 fps re-render budget killer, see `docs/guide/performance-budget.md`).
 *
 * This module is the thin, render-free bridge between the two worlds, mirroring
 * the player-transform bridge in `../save/playerRuntime.ts`:
 *
 * - The active zone scene builds a {@link MinimapSnapshot} and `publish`es it
 *   from its fixed-step loop, **throttled** to ~10 Hz (not every frame).
 * - The `<Minimap>` component `read`s the latest snapshot from its own
 *   `requestAnimationFrame` draw loop and paints it imperatively onto a canvas.
 *
 * Neither side holds a reference to the other; the snapshot is the only contract.
 */
import { WORLD_SIZE } from '../../scenes/worldBounds'

/** Plain XZ world position (Babylon `Vector3` is not needed here). */
export interface MinimapPoint {
  readonly x: number
  readonly z: number
}

/**
 * One radar frame: the player pose plus the live objective + threat positions,
 * all in world coordinates. Built by the scene, consumed by the `<Minimap>`.
 */
export interface MinimapSnapshot {
  /** Player world position + capsule yaw (radians); drives the dot + facing. */
  readonly player: { readonly x: number; readonly z: number; readonly rotationY: number }
  /** Living caravans — the raid objective, drawn as gold dots. */
  readonly caravans: readonly MinimapPoint[]
  /** Living soldiers + archers — threats, drawn as red dots. */
  readonly soldiers: readonly MinimapPoint[]
}

/** Side length of the world the minimap maps, in world units (the play area). */
export const MINIMAP_WORLD_SIZE = WORLD_SIZE

/**
 * How far the radar is zoomed in relative to the full world (FLO-467). At a
 * `worldSize` of 600 a zoom of 10 shows a 60×60-unit window centred on the
 * player, so nearby blips spread out and read cleanly instead of collapsing into
 * one indistinct cluster.
 */
export const MINIMAP_ZOOM = 10

/** A 2D pixel coordinate inside the minimap canvas. */
export interface MinimapPixel {
  readonly x: number
  readonly y: number
}

/** World origin — the default radar centre when no player point is supplied. */
const WORLD_ORIGIN: MinimapPoint = { x: 0, z: 0 }

/**
 * Project a world XZ position onto the minimap canvas. Pure + exported so the
 * projection is unit-testable headlessly (no canvas).
 *
 * The radar is **player-centred and zoomed** (FLO-467): it shows a
 * `worldSize / zoom`-wide window around `center` (the player), who sits fixed at
 * the canvas centre while the world pans beneath. Screen origin is top-left, so
 * world **+X is east → right** and world **+Z is north → up** (a larger Z maps to
 * a *smaller* pixel-y). Nothing is clamped — points beyond the window fall
 * outside `[0, sizePx]` and the caller clips them at the frame edge.
 */
export function worldToMinimap(
  worldX: number,
  worldZ: number,
  sizePx: number,
  center: MinimapPoint = WORLD_ORIGIN,
  worldSize: number = MINIMAP_WORLD_SIZE,
  zoom: number = MINIMAP_ZOOM,
): MinimapPixel {
  // Pixels per world unit across the zoomed-in visible window.
  const scale = (sizePx * zoom) / worldSize
  return {
    x: sizePx / 2 + (worldX - center.x) * scale,
    y: sizePx / 2 - (worldZ - center.z) * scale,
  }
}

let latest: MinimapSnapshot | null = null

/** Publish the latest radar frame (called by the active scene, throttled). */
export function publishMinimapSnapshot(snapshot: MinimapSnapshot): void {
  latest = snapshot
}

/** Read the latest radar frame, or `null` when no scene is publishing. */
export function readMinimapSnapshot(): MinimapSnapshot | null {
  return latest
}

/** Drop the latest frame so a torn-down scene never lingers on the radar. */
export function clearMinimapSnapshot(): void {
  latest = null
}
