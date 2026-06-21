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

/** A 2D pixel coordinate inside the minimap canvas. */
export interface MinimapPixel {
  readonly x: number
  readonly y: number
}

/**
 * Map a world XZ position to a minimap pixel coordinate. Pure + exported so the
 * projection is unit-testable headlessly (no canvas).
 *
 * The world spans `[-worldSize/2, +worldSize/2]` on both axes. The minimap is a
 * `sizePx`-square canvas with the conventional screen origin at the top-left:
 * world **+X is east → right**, world **+Z is north → up** (so a larger Z maps
 * to a *smaller* pixel-y). Positions outside the world box are clamped to the
 * edge so a wandering enemy can never draw off-canvas.
 */
export function worldToMinimap(
  worldX: number,
  worldZ: number,
  sizePx: number,
  worldSize: number = MINIMAP_WORLD_SIZE,
): MinimapPixel {
  const half = worldSize / 2
  const cx = Math.min(half, Math.max(-half, worldX))
  const cz = Math.min(half, Math.max(-half, worldZ))
  return {
    x: ((cx + half) / worldSize) * sizePx,
    y: ((half - cz) / worldSize) * sizePx,
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
