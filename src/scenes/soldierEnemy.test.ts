import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { SoldierEnemy } from './soldierEnemy'
import { DEFAULT_SOLDIER_PARAMS } from '../game/ai'

// Integration coverage for the Babylon wrapper that drives the pure FSM (the
// fight-loop path ForestScene exercises live). We use a headless NullEngine and
// `glbUrl: null` to skip the async GLB fetch, so the capsule proxy is the mesh
// under test and every assertion is deterministic.
function makeScene() {
  const engine = new NullEngine()
  return new Scene(engine)
}

const P = DEFAULT_SOLDIER_PARAMS

describe('SoldierEnemy (scene integration)', () => {
  let scene: Scene
  let player: Vector3
  let damageDealt: number[]

  function spawn(at = new Vector3(6, 0.9, 6)) {
    return new SoldierEnemy(scene, {
      spawn: at,
      glbUrl: null, // skip GLB fetch — capsule proxy is the mesh under test
      getPlayerPos: () => player,
      onAttackPlayer: (dmg) => damageDealt.push(dmg),
    })
  }

  beforeEach(() => {
    scene = makeScene()
    player = new Vector3(0, 0.9, 0)
    damageDealt = []
  })

  it('chases: moves toward the player when in detection range', () => {
    const soldier = spawn()
    const before = soldier.position
    for (let i = 0; i < 30; i++) soldier.update(1 / 60, undefined)
    const after = soldier.position
    // Player at origin, soldier spawned at +x/+z → both coords shrink.
    expect(after.x).toBeLessThan(before.x)
    expect(after.z).toBeLessThan(before.z)
  })

  it('attacks: funnels damage to the player once in melee range', () => {
    // Spawn the soldier essentially on top of the player so it reaches attack
    // range immediately, then tick past the first cooldown.
    const soldier = spawn(new Vector3(1, 0.9, 0))
    for (let i = 0; i < 10; i++) soldier.update(1 / 60, undefined)
    expect(damageDealt.length).toBeGreaterThan(0)
    expect(damageDealt[0]).toBe(P.attackDamage)
  })

  it('dies: takeDamage at max HP kills it and freezes behaviour', () => {
    const soldier = spawn(new Vector3(1, 0.9, 0))
    soldier.takeDamage(P.maxHp)
    expect(soldier.isDead()).toBe(true)

    const frozen = soldier.position
    for (let i = 0; i < 30; i++) soldier.update(1 / 60, undefined)
    expect(soldier.position).toEqual(frozen) // no movement once dead
    expect(damageDealt).toHaveLength(0) // and no more attacks on the player
  })

  it('survives non-lethal damage and keeps fighting', () => {
    const soldier = spawn(new Vector3(1, 0.9, 0))
    soldier.takeDamage(P.maxHp - 1)
    expect(soldier.isDead()).toBe(false)
    for (let i = 0; i < 10; i++) soldier.update(1 / 60, undefined)
    expect(damageDealt.length).toBeGreaterThan(0)
  })

  it('follows a trusted commander order instead of default patrol', () => {
    const soldier = new SoldierEnemy(scene, {
      spawn: new Vector3(0, 0.9, 0),
      glbUrl: null,
      getPlayerPos: () => new Vector3(100, 0.9, 0),
      onAttackPlayer: (dmg) => damageDealt.push(dmg),
      getOrderContext: () => ({
        order: { type: 'follow', commanderId: 'captain', recipientId: 'guard' },
        leaderPos: new Vector3(10, 0.9, 0),
      }),
    })

    soldier.update(1, undefined)

    expect(soldier.position.x).toBeGreaterThan(0)
    expect(damageDealt).toEqual([])
  })

  it('routes ordered target attacks away from player damage', () => {
    const targetDamage: number[] = []
    const soldier = new SoldierEnemy(scene, {
      spawn: new Vector3(0, 0.9, 0),
      glbUrl: null,
      getPlayerPos: () => new Vector3(100, 0.9, 0),
      onAttackPlayer: (dmg) => damageDealt.push(dmg),
      getOrderContext: () => ({
        order: {
          type: 'attack-target',
          commanderId: 'captain',
          recipientId: 'guard',
          targetId: 'raider',
        },
        targetPos: new Vector3(1, 0.9, 0),
        targetAlive: true,
      }),
      onAttackOrderTarget: (dmg) => targetDamage.push(dmg),
    })

    soldier.update(1 / 60, undefined)

    expect(damageDealt).toEqual([])
    expect(targetDamage).toEqual([P.attackDamage])
  })
})
