import { NullEngine, Scene } from '@babylonjs/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { CorpseManager } from './corpseManager'
import { CorpseStore } from '../game/corpses'

// Headless NullEngine + glbUrl: null → the bare toppled capsule is the mesh
// under test, so every assertion is deterministic with no async GLB fetch.
function makeScene() {
  return new Scene(new NullEngine())
}

describe('CorpseManager', () => {
  let scene: Scene
  let store: CorpseStore

  beforeEach(() => {
    scene = makeScene()
    store = new CorpseStore(3)
  })

  it('spawns a static, inert corpse mesh on death', () => {
    const mgr = new CorpseManager(scene, { zoneId: 'forest', store, glbUrl: null })
    expect(mgr.count).toBe(0)

    const rec = mgr.registerDeath({ x: 6, y: 0.9, z: 6 }, 1.5)
    expect(mgr.count).toBe(1)

    const mesh = scene.getMeshByName(`corpse:${rec.id}`)
    expect(mesh).not.toBeNull()
    // Inert: not pickable, no collisions, toppled, resting on the ground at x/z.
    expect(mesh!.isPickable).toBe(false)
    expect(mesh!.checkCollisions).toBe(false)
    expect(mesh!.rotation.z).toBeCloseTo(Math.PI / 2)
    expect(mesh!.rotation.y).toBeCloseTo(1.5)
    expect(mesh!.position.x).toBeCloseTo(6)
    expect(mesh!.position.z).toBeCloseTo(6)
  })

  it('evicts the oldest corpse mesh when the cap is exceeded', () => {
    const mgr = new CorpseManager(scene, { zoneId: 'forest', store, glbUrl: null })
    const r0 = mgr.registerDeath({ x: 0, y: 0, z: 0 }, 0)
    mgr.registerDeath({ x: 1, y: 0, z: 1 }, 0)
    mgr.registerDeath({ x: 2, y: 0, z: 2 }, 0)
    expect(mgr.count).toBe(3)

    mgr.registerDeath({ x: 3, y: 0, z: 3 }, 0) // cap is 3 → oldest evicted
    expect(mgr.count).toBe(3)
    expect(scene.getMeshByName(`corpse:${r0.id}`)).toBeNull()
  })

  it('re-spawns persisted corpses for its zone on construction (zone re-enter)', () => {
    // First "visit": kill something, then tear the scene down (meshes only).
    const first = new CorpseManager(scene, { zoneId: 'forest', store, glbUrl: null })
    first.registerDeath({ x: 6, y: 0.9, z: 6 }, 0)
    first.dispose()
    expect(store.size).toBe(1) // record survives the scene teardown

    // Second "visit": a fresh scene + manager sees the corpse again.
    const scene2 = makeScene()
    const second = new CorpseManager(scene2, { zoneId: 'forest', store, glbUrl: null })
    expect(second.count).toBe(1)
  })

  it('only re-spawns corpses from its own zone', () => {
    store.record('cave', { x: 0, y: 0, z: 0 }, 0)
    const mgr = new CorpseManager(scene, { zoneId: 'forest', store, glbUrl: null })
    expect(mgr.count).toBe(0)
  })
})
