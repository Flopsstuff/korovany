import { describe, expect, it } from 'vitest'
import {
  clearMinimapSnapshot,
  MINIMAP_WORLD_SIZE,
  MINIMAP_ZOOM,
  publishMinimapSnapshot,
  readMinimapSnapshot,
  worldToMinimap,
  type MinimapSnapshot,
} from './index'

describe('worldToMinimap (player-centred, zoomed)', () => {
  const SIZE = 140
  // Half-width of the visible window, in world units (FLO-467 zoom).
  const VIEW_HALF = MINIMAP_WORLD_SIZE / MINIMAP_ZOOM / 2

  it('pins the centre point to the canvas centre', () => {
    expect(worldToMinimap(0, 0, SIZE)).toEqual({ x: SIZE / 2, y: SIZE / 2 })
    // The player is always its own centre → dead centre, wherever they roam.
    const center = { x: 123, z: -45 }
    expect(worldToMinimap(center.x, center.z, SIZE, center)).toEqual({
      x: SIZE / 2,
      y: SIZE / 2,
    })
  })

  it('maps a point one view-half east/west of centre to the right/left edge', () => {
    expect(worldToMinimap(VIEW_HALF, 0, SIZE).x).toBe(SIZE)
    expect(worldToMinimap(-VIEW_HALF, 0, SIZE).x).toBe(0)
  })

  it('maps +Z (north) up and -Z down at the window edges (screen y inverted)', () => {
    expect(worldToMinimap(0, VIEW_HALF, SIZE).y).toBe(0)
    expect(worldToMinimap(0, -VIEW_HALF, SIZE).y).toBe(SIZE)
  })

  it('pans with the centre: a blip stays put while the player moves toward it', () => {
    // Blip 15 units east of origin, player at origin → right of centre.
    const atOrigin = worldToMinimap(15, 0, SIZE, { x: 0, z: 0 })
    expect(atOrigin.x).toBeGreaterThan(SIZE / 2)
    // Player walks 15 east onto the blip → it slides to dead centre.
    const reached = worldToMinimap(15, 0, SIZE, { x: 15, z: 0 })
    expect(reached.x).toBe(SIZE / 2)
  })

  it('lets distant points fall outside the canvas so the caller can clip them', () => {
    // A point far beyond the zoomed window projects off-canvas (not clamped).
    const p = worldToMinimap(MINIMAP_WORLD_SIZE, 0, SIZE)
    expect(p.x).toBeGreaterThan(SIZE)
  })

  it('honours a custom zoom', () => {
    // zoom 1 → the full worldSize window: +X half-world maps to the right edge.
    const half = MINIMAP_WORLD_SIZE / 2
    expect(worldToMinimap(half, 0, SIZE, { x: 0, z: 0 }, MINIMAP_WORLD_SIZE, 1).x).toBe(SIZE)
  })
})

describe('minimap snapshot bridge', () => {
  it('publishes and reads back the latest snapshot, and clears it', () => {
    clearMinimapSnapshot()
    expect(readMinimapSnapshot()).toBeNull()

    const snap: MinimapSnapshot = {
      player: { x: 1, z: 2, rotationY: 0.5 },
      caravans: [{ x: 10, z: 20 }],
      soldiers: [{ x: -5, z: -5 }],
    }
    publishMinimapSnapshot(snap)
    expect(readMinimapSnapshot()).toBe(snap)

    clearMinimapSnapshot()
    expect(readMinimapSnapshot()).toBeNull()
  })
})
