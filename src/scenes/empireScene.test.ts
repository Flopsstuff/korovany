import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { EMPIRE_ZONE_ID, createEmpireScene } from './empireScene'
import { createZoneScene } from './zoneScenes'
import { stageSpawn, takeSpawn } from '../game/save/playerRuntime'

// jsdom has no WebGL, so inject a headless NullEngine and skip the hero GLB fetch.
function boot(opts: Parameters<typeof createEmpireScene>[1] = {}) {
  const canvas = document.createElement('canvas')
  return createEmpireScene(canvas, {
    heroUrl: null,
    createEngine: () => new NullEngine(),
    ...opts,
  })
}

describe('createEmpireScene', () => {
  it('exposes the canonical zone id', () => {
    expect(EMPIRE_ZONE_ID).toBe('empire')
  })

  it('boots a live scene with an active camera', () => {
    const game = boot()
    expect(game.scene).toBeInstanceOf(Scene)
    expect(game.scene.activeCamera).not.toBeNull()
    game.dispose()
  })

  it('spawns the player at the staged fast-travel spawn (zoneId round-trip)', () => {
    stageSpawn({ position: { x: 4, y: 2, z: -2 }, rotationY: 0.8 })
    const game = boot()
    const pos = game.controller.mesh.position
    expect(pos.x).toBeCloseTo(4)
    expect(pos.z).toBeCloseTo(-2)
    game.dispose()
    // The scene consumed the staged spawn on boot.
    expect(takeSpawn()).toBeNull()
  })

  it('falls back to the palace approach with no staged spawn', () => {
    expect(takeSpawn()).toBeNull()
    const game = boot()
    expect(game.controller.mesh.position).toEqual(new Vector3(0, 2, 0))
    game.dispose()
  })

  it('populates the zone on enter: Palace-Guard patrols, a wall archer, tribute caravans', () => {
    const game = boot()
    // Non-empty spawn (E8.1 acceptance) — every kind seeds at least its minimum.
    expect(game.soldiers.length).toBeGreaterThanOrEqual(3)
    expect(game.archers.length).toBeGreaterThanOrEqual(1)
    expect(game.caravans.length).toBeGreaterThanOrEqual(1)
    expect(game.soldiers.every((s) => !s.isDead())).toBe(true)
    expect(game.archers.every((a) => !a.isDead())).toBe(true)
    expect(game.caravans.every((c) => !c.isDead())).toBe(true)
    game.dispose()
  })

  it('registers the live player so autosave-on-pause has a pose to read', async () => {
    const game = boot()
    const { readPlayerTransform } = await import('../game/save/playerRuntime')
    const pose = readPlayerTransform()
    expect(pose).not.toBeNull()
    expect(pose!.position).toEqual({ x: 0, y: 2, z: 0 })
    game.dispose()
    // Teardown unregisters the bridge so a later zone's scene owns the pose.
    expect(readPlayerTransform()).toBeNull()
  })

  it('freezes the sim while paused but keeps the scene alive', () => {
    let paused = true
    const game = boot({ isPaused: () => paused })
    expect(() => game.step(1 / 60)).not.toThrow()
    paused = false
    expect(() => game.step(1 / 60)).not.toThrow()
    game.dispose()
  })

  it('is reachable through the zone-scene dispatcher (streaming entry point)', () => {
    const canvas = document.createElement('canvas')
    // The dispatcher's public options type omits the test-only engine/hero hooks
    // each scene factory accepts; widen through `unknown` to inject the NullEngine.
    const handle = createZoneScene(EMPIRE_ZONE_ID, canvas, {
      heroUrl: null,
      createEngine: () => new NullEngine(),
    } as unknown as Parameters<typeof createZoneScene>[2])
    expect(handle).toBeDefined()
    expect(() => handle.dispose()).not.toThrow()
  })
})
