import { Color3, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { WORLD_SIZE, createWorldBounds } from './worldBounds'

// jsdom has no WebGL, so drive the meshes through a headless NullEngine.
function makeScene(): Scene {
  return new Scene(new NullEngine())
}

describe('worldBounds', () => {
  it('scales the world to 600 units per axis (10× the original 60)', () => {
    expect(WORLD_SIZE).toBe(600)
  })

  let scene: Scene
  beforeEach(() => {
    scene = makeScene()
  })

  it('builds a ground plane sized to WORLD_SIZE and four perimeter walls', () => {
    const { ground, walls } = createWorldBounds(scene, new Color3(0.2, 0.38, 0.15))

    expect(ground.name).toBe('ground')
    expect(ground.isPickable).toBe(true)
    // CreateGround centres the plane on the origin, so its extent is ±size/2.
    const { minimum, maximum } = ground.getBoundingInfo().boundingBox
    expect(maximum.x - minimum.x).toBeCloseTo(WORLD_SIZE)
    expect(maximum.z - minimum.z).toBeCloseTo(WORLD_SIZE)

    expect(walls).toHaveLength(4)
    expect(walls.map((w) => w.name).sort()).toEqual(['wall-e', 'wall-n', 'wall-s', 'wall-w'])
    // Walls are scenery, not ground — the controller's downward ray must skip them.
    for (const wall of walls) expect(wall.isPickable).toBe(false)
  })

  it('clamps a position outside the walls back inside, leaving interior points untouched', () => {
    const { clamp } = createWorldBounds(scene, new Color3(0.2, 0.38, 0.15))

    const out = clamp(new Vector3(99999, 5, -99999))
    expect(out.x).toBeLessThan(WORLD_SIZE / 2)
    expect(out.x).toBeGreaterThan(WORLD_SIZE / 2 - 10)
    expect(out.z).toBeGreaterThan(-WORLD_SIZE / 2)
    expect(out.z).toBeLessThan(-(WORLD_SIZE / 2) + 10)
    expect(out.y).toBe(5) // height is never clamped

    const inside = clamp(new Vector3(10, 2, -20))
    expect(inside.x).toBe(10)
    expect(inside.z).toBe(-20)
  })

  it('mutates and returns the same Vector3 instance', () => {
    const { clamp } = createWorldBounds(scene, new Color3(0, 0, 0))
    const v = new Vector3(0, 0, 0)
    expect(clamp(v)).toBe(v)
  })
})
