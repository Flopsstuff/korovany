import { describe, expect, it } from 'vitest'
import { MeshBuilder, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { ArcherEnemy, applyArcherTexture } from './archerEnemy'
import type { Vec3 } from '../game/combat'

function makeScene(): Scene {
  return new Scene(new NullEngine())
}

interface FireRecord {
  muzzle: Vec3
  dir: Vec3
  damage: number
  speed: number
}

describe('ArcherEnemy', () => {
  it('looses an arrow at the player once engaged + in range', () => {
    const scene = makeScene()
    const fires: FireRecord[] = []
    const archer = new ArcherEnemy(scene, {
      spawn: new Vector3(0, 0.9, 0),
      getPlayerPos: () => new Vector3(0, 0.9, 7), // within engage range
      onFire: (muzzle, dir, damage, speed) => fires.push({ muzzle, dir, damage, speed }),
      glbUrl: null, // skip async GLB fetch in headless tests
    })

    // A few ticks: detect → engage → fire on the first ready cooldown.
    for (let i = 0; i < 5; i++) archer.update(0.1, undefined)

    expect(fires.length).toBeGreaterThanOrEqual(1)
    const shot = fires[0]
    expect(shot.dir.z).toBeCloseTo(1) // aims down +z toward the player
    expect(shot.damage).toBeGreaterThan(0)
    expect(shot.speed).toBeGreaterThan(0)
    expect(shot.muzzle.y).toBeGreaterThan(archer.position.y) // fires from chest height
  })

  it('holds fire when its line of sight is blocked', () => {
    const scene = makeScene()
    const fires: FireRecord[] = []
    const archer = new ArcherEnemy(scene, {
      spawn: new Vector3(0, 0.9, 0),
      getPlayerPos: () => new Vector3(0, 0.9, 7),
      onFire: (muzzle, dir, damage, speed) => fires.push({ muzzle, dir, damage, speed }),
      hasLineOfSight: () => false, // something always blocks the shot
      glbUrl: null,
    })

    for (let i = 0; i < 10; i++) archer.update(0.1, undefined)
    expect(fires).toHaveLength(0)
  })

  it('does not chase into melee — it keeps its distance', () => {
    const scene = makeScene()
    const archer = new ArcherEnemy(scene, {
      spawn: new Vector3(0, 0.9, 0),
      getPlayerPos: () => new Vector3(0, 0.9, 2), // player crowds inside minRange
      onFire: () => {},
      glbUrl: null,
    })
    const startZ = archer.position.z
    archer.update(0.1, undefined)
    expect(archer.position.z).toBeLessThan(startZ) // back-pedals away from the player
  })

  it('dies to melee damage, firing onDefeated and freezing behaviour', () => {
    const scene = makeScene()
    let defeated = 0
    const fires: FireRecord[] = []
    const archer = new ArcherEnemy(scene, {
      spawn: new Vector3(0, 0.9, 0),
      getPlayerPos: () => new Vector3(0, 0.9, 7),
      onFire: (muzzle, dir, damage, speed) => fires.push({ muzzle, dir, damage, speed }),
      onDefeated: () => (defeated += 1),
      glbUrl: null,
    })

    archer.takeDamage(1000)
    expect(archer.isDead()).toBe(true)
    expect(defeated).toBe(1)

    fires.length = 0
    archer.update(0.1, undefined)
    expect(fires).toHaveLength(0) // a dead archer never fires
  })

  it('applies a readable ranger palette to loaded meshes', () => {
    const scene = makeScene()
    // A bare mesh stands in for a loaded GLB submesh named like a bow.
    const box = MeshBuilder.CreateBox('bow', {}, scene)
    applyArcherTexture(scene, [box])
    expect(box.material).not.toBeNull()
  })
})
