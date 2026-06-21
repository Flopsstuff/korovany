import { NullEngine, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { CaravanEnemy } from './caravanEnemy'
import { DEFAULT_CARAVAN_PARAMS } from '../game/ai'
import type { LootDrop } from '../game/loot'

// Integration coverage for the Babylon wrapper that drives the pure caravan FSM
// (the ambush loop CaravanPlayground/ForestScene exercise live). Headless
// NullEngine so the box proxy is the mesh under test and assertions stay
// deterministic.
function makeScene() {
  const engine = new NullEngine()
  return new Scene(engine)
}

const P = DEFAULT_CARAVAN_PARAMS

describe('CaravanEnemy (scene integration)', () => {
  let scene: Scene
  let player: Vector3
  let drops: LootDrop[]
  let defeats: number

  function spawn(at = new Vector3(20, 1, 0)) {
    return new CaravanEnemy(scene, {
      spawn: at,
      getPlayerPos: () => player,
      onLooted: (d) => drops.push(d),
      onDefeated: () => {
        defeats += 1
      },
      visualUrl: null,
    })
  }

  beforeEach(() => {
    scene = makeScene()
    player = new Vector3(100, 0.9, 0) // far away → caravan wanders undisturbed
    drops = []
    defeats = 0
  })

  it('wanders: moves along its default path when the player is far', () => {
    const caravan = spawn()
    const before = caravan.position
    for (let i = 0; i < 60; i++) caravan.update(1 / 60, undefined)
    const after = caravan.position
    const moved = Math.hypot(after.x - before.x, after.z - before.z)
    expect(moved).toBeGreaterThan(0)
    expect(caravan.phase).toBe('wander')
  })

  it('flees: switches to flee when the player closes in', () => {
    const caravan = spawn(new Vector3(20, 1, 0))
    player = new Vector3(20 - 2, 0.9, 0) // within ambushRadius (6)
    caravan.update(1 / 60, undefined)
    expect(caravan.phase).toBe('flee')
  })

  it('defeat: melee damage kills it and emits the loot drop exactly once', () => {
    const caravan = spawn()
    // Three sub-lethal strikes then the killing blow.
    caravan.takeDamage(25)
    caravan.takeDamage(25)
    expect(caravan.isDead()).toBe(false)
    expect(drops).toHaveLength(0)

    caravan.takeDamage(P.maxHp) // overkill → dead
    expect(caravan.isDead()).toBe(true)
    expect(defeats).toBe(1)
    expect(drops).toHaveLength(1)
    expect(caravan.loot).toBe(drops[0])
    expect(drops[0].items.length).toBeGreaterThan(0)

    // Further hits do not re-roll / re-emit.
    caravan.takeDamage(25)
    expect(defeats).toBe(1)
    expect(drops).toHaveLength(1)
  })

  it('defeat is deterministic: same spawn → same haul', () => {
    const a = spawn(new Vector3(7, 1, 3))
    a.takeDamage(P.maxHp)
    const b = new CaravanEnemy(scene, {
      spawn: new Vector3(7, 1, 3),
      getPlayerPos: () => player,
      onLooted: () => {},
    })
    b.takeDamage(P.maxHp)
    expect(b.loot).toEqual(a.loot)
  })

  it('dead caravan stops moving', () => {
    const caravan = spawn()
    caravan.takeDamage(P.maxHp)
    const frozen = caravan.position
    for (let i = 0; i < 30; i++) caravan.update(1 / 60, undefined)
    expect(caravan.position).toEqual(frozen)
  })

  it('mounts the wagon GLB as the visible caravan body when loaded', async () => {
    const root = new TransformNode('wagon-root', scene)
    const loadVisual = vi.fn().mockResolvedValue({ root, meshes: [] })
    const caravan = new CaravanEnemy(scene, {
      spawn: new Vector3(1, 1, 2),
      getPlayerPos: () => player,
      loadVisual,
    })

    await vi.waitFor(() => {
      expect(loadVisual).toHaveBeenCalledWith(
        scene,
        '/models/caravan-wagon.glb',
        expect.objectContaining({ targetSize: 2.8, groundIt: true }),
      )
      expect(root.parent).toBe(caravan.mesh)
    })
    expect(caravan.mesh.visibility).toBe(0)
  })
})
