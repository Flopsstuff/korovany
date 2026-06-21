import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { HUMAN_LANDS_ZONE_ID, createHumanLandsScene } from './humanLandsScene'
import { stageSpawn, takeSpawn } from '../game/save/playerRuntime'

// jsdom has no WebGL, so inject a headless NullEngine and skip the hero GLB fetch.
function boot(opts: Parameters<typeof createHumanLandsScene>[1] = {}) {
  const canvas = document.createElement('canvas')
  return createHumanLandsScene(canvas, {
    heroUrl: null,
    palaceGuardGlbUrl: null,
    createEngine: () => new NullEngine(),
    ...opts,
  })
}

describe('createHumanLandsScene', () => {
  it('exposes the canonical zone id', () => {
    expect(HUMAN_LANDS_ZONE_ID).toBe('human-lands')
  })

  it('boots a live scene with an active camera', () => {
    const game = boot()
    expect(game.scene).toBeInstanceOf(Scene)
    expect(game.scene.activeCamera).not.toBeNull()
    game.dispose()
  })

  it('spawns the player at the staged fast-travel spawn', () => {
    stageSpawn({ position: { x: 7, y: 2, z: -3 }, rotationY: 1.2 })
    const game = boot()
    const pos = game.controller.mesh.position
    expect(pos.x).toBeCloseTo(7)
    expect(pos.z).toBeCloseTo(-3)
    game.dispose()
    // The scene consumed the staged spawn on boot.
    expect(takeSpawn()).toBeNull()
  })

  it('falls back to the road centre with no staged spawn', () => {
    expect(takeSpawn()).toBeNull()
    const game = boot()
    expect(game.controller.mesh.position).toEqual(new Vector3(0, 2, 0))
    game.dispose()
  })

  it('meets the MPG.5 minimum population on zone enter', () => {
    const game = boot()
    expect(game.caravans.length).toBeGreaterThanOrEqual(2)
    expect(game.soldiers.length).toBeGreaterThanOrEqual(3)
    expect(game.caravans.every((caravan) => !caravan.isDead())).toBe(true)
    expect(game.soldiers.every((soldier) => !soldier.isDead())).toBe(true)
    game.dispose()
  })

  it('spawns two static palace-guard decor props at the toll gate (FLO-471)', () => {
    const game = boot()
    expect(game.palaceGuards).toHaveLength(2)
    expect(game.palaceGuards.map((g) => g.id)).toEqual([
      'palace-guard-toll-left',
      'palace-guard-toll-right',
    ])
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
