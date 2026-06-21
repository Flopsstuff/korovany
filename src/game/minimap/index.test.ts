import { describe, expect, it } from 'vitest'
import {
  clearMinimapSnapshot,
  MINIMAP_WORLD_SIZE,
  publishMinimapSnapshot,
  readMinimapSnapshot,
  worldToMinimap,
  type MinimapSnapshot,
} from './index'

describe('worldToMinimap', () => {
  const SIZE = 140

  it('maps the world centre to the canvas centre', () => {
    expect(worldToMinimap(0, 0, SIZE)).toEqual({ x: SIZE / 2, y: SIZE / 2 })
  })

  it('maps +X (east) to the right edge and -X to the left edge', () => {
    const half = MINIMAP_WORLD_SIZE / 2
    expect(worldToMinimap(half, 0, SIZE).x).toBe(SIZE)
    expect(worldToMinimap(-half, 0, SIZE).x).toBe(0)
  })

  it('maps +Z (north) to the top and -Z to the bottom (screen y inverted)', () => {
    const half = MINIMAP_WORLD_SIZE / 2
    expect(worldToMinimap(0, half, SIZE).y).toBe(0)
    expect(worldToMinimap(0, -half, SIZE).y).toBe(SIZE)
  })

  it('clamps positions outside the world box onto the edge', () => {
    const half = MINIMAP_WORLD_SIZE / 2
    expect(worldToMinimap(half * 5, 0, SIZE).x).toBe(SIZE)
    expect(worldToMinimap(-half * 5, half * 5, SIZE)).toEqual({ x: 0, y: 0 })
  })

  it('honours a custom world size', () => {
    expect(worldToMinimap(50, 0, 100, 200)).toEqual({ x: 75, y: 50 })
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
