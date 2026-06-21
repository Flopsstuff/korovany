import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { MOUNTAINS_ZONE_ID, createMountainsScene } from './mountainsScene'
import { getZoneContent, isZoneAvailable } from '../game/world'
import { stageSpawn, takeSpawn } from '../game/save/playerRuntime'

// jsdom has no WebGL, so inject a headless NullEngine and skip the hero GLB fetch.
function boot(opts: Parameters<typeof createMountainsScene>[1] = {}) {
  const canvas = document.createElement('canvas')
  return createMountainsScene(canvas, {
    heroUrl: null,
    createEngine: () => new NullEngine(),
    ...opts,
  })
}

describe('createMountainsScene', () => {
  it('exposes the canonical zone id', () => {
    expect(MOUNTAINS_ZONE_ID).toBe('mountains')
  })

  it('boots a live scene with an active camera', () => {
    const game = boot()
    expect(game.scene).toBeInstanceOf(Scene)
    expect(game.scene.activeCamera).not.toBeNull()
    game.dispose()
  })

  it('steps without throwing (sim + render)', () => {
    const game = boot()
    expect(() => {
      for (let i = 0; i < 10; i++) game.step(1 / 60)
    }).not.toThrow()
    game.dispose()
  })

  it('spawns the player at the staged fast-travel spawn', () => {
    stageSpawn({ position: { x: 3, y: 2, z: 5 }, rotationY: 0.7 })
    const game = boot()
    const pos = game.controller.mesh.position
    expect(pos.x).toBeCloseTo(3)
    expect(pos.z).toBeCloseTo(5)
    game.dispose()
    // The scene consumed the staged spawn on boot.
    expect(takeSpawn()).toBeNull()
  })

  it('falls back to the lower switchback centre with no staged spawn', () => {
    expect(takeSpawn()).toBeNull()
    const game = boot()
    expect(game.controller.mesh.position).toEqual(new Vector3(0, 2, 0))
    game.dispose()
  })

  it('populates the villain garrison + a captured caravan on enter', () => {
    const game = boot()
    expect(game.soldiers.length).toBeGreaterThanOrEqual(1)
    // Commander placeholder: at least one ranged unit (E4.3 command slot).
    expect(game.archers.length).toBeGreaterThanOrEqual(1)
    expect(game.caravans.length).toBeGreaterThanOrEqual(1)
    expect(game.soldiers.every((s) => !s.isDead())).toBe(true)
    expect(game.archers.every((a) => !a.isDead())).toBe(true)
    expect(game.caravans.every((c) => !c.isDead())).toBe(true)
    game.dispose()
  })

  it('freezes the sim while paused but keeps the scene alive', () => {
    let paused = true
    const game = boot({ isPaused: () => paused })
    expect(() => game.step(1 / 60)).not.toThrow()
    paused = false
    expect(() => game.step(1 / 60)).not.toThrow()
    game.dispose()
  })
})

describe('mountains zone wiring', () => {
  it('has a fort landmark and a villain encounter in the content table', () => {
    const content = getZoneContent('mountains')
    expect(content.landmarks.length).toBeGreaterThanOrEqual(1)
    expect(content.encounterAnchors.length).toBeGreaterThanOrEqual(1)
  })

  it('is unlocked for fast-travel (E8.2)', () => {
    expect(isZoneAvailable('mountains')).toBe(true)
  })
})
