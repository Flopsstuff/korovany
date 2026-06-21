import { describe, expect, it } from 'vitest'
import type { Damageable, Vec3 } from './meleeAttack'
import {
  createProjectile,
  createProjectileField,
  DEFAULT_PROJECTILE_SPEED,
  spawnProjectile,
  stepProjectile,
  stepProjectileField,
} from './projectile'

const origin: Vec3 = { x: 0, y: 1, z: 0 }

/** Minimal Damageable stub that records the damage it took. */
function makeTarget(position: Vec3): Damageable & { taken: number[] } {
  return {
    position,
    taken: [] as number[],
    takeDamage(amount: number) {
      this.taken.push(amount)
    },
  }
}

describe('createProjectile', () => {
  it('normalises the direction to the muzzle speed', () => {
    const p = createProjectile(origin, { x: 0, y: 0, z: 2 }, { speed: 10, damage: 5 })
    expect(p.vx).toBeCloseTo(0)
    expect(p.vz).toBeCloseTo(10) // 2/|2| * 10
    expect(p.damage).toBe(5)
    expect(p.alive).toBe(true)
  })

  it('defaults to the standard speed and a stationary arrow for a zero direction', () => {
    const moving = createProjectile(origin, { x: 1, y: 0, z: 0 })
    expect(Math.hypot(moving.vx, moving.vy, moving.vz)).toBeCloseTo(DEFAULT_PROJECTILE_SPEED)
    const still = createProjectile(origin, { x: 0, y: 0, z: 0 })
    expect(still.vx).toBe(0)
    expect(still.vz).toBe(0)
  })
})

describe('stepProjectile', () => {
  it('advances along its velocity and decays ttl', () => {
    const p = createProjectile(origin, { x: 0, y: 0, z: 1 }, { speed: 10, ttl: 1 })
    const next = stepProjectile(p, 0.5)
    expect(next.z).toBeCloseTo(5)
    expect(next.ttl).toBeCloseTo(0.5)
    expect(next.alive).toBe(true)
  })

  it('dies once its ttl runs out', () => {
    const p = createProjectile(origin, { x: 1, y: 0, z: 0 }, { ttl: 0.3 })
    expect(stepProjectile(p, 0.5).alive).toBe(false)
  })
})

describe('projectile field budget cap', () => {
  it('drops spawns once the cap is reached', () => {
    let field = createProjectileField(2)
    field = spawnProjectile(field, createProjectile(origin, { x: 1, y: 0, z: 0 }))
    field = spawnProjectile(field, createProjectile(origin, { x: 1, y: 0, z: 0 }))
    field = spawnProjectile(field, createProjectile(origin, { x: 1, y: 0, z: 0 }))
    expect(field.projectiles).toHaveLength(2)
  })
})

describe('stepProjectileField', () => {
  it('reports an impact when an arrow reaches a target and consumes the arrow', () => {
    const target = makeTarget({ x: 0, y: 1, z: 5 })
    let field = createProjectileField()
    field = spawnProjectile(
      field,
      createProjectile(origin, { x: 0, y: 0, z: 1 }, { speed: 10, damage: 12 }),
    )
    // 0.5s * 10m/s = 5m → lands on the target at z=5.
    const { field: next, impacts } = stepProjectileField(field, 0.5, [target])
    expect(impacts).toHaveLength(1)
    expect(impacts[0].damage).toBe(12)
    expect(impacts[0].target).toBe(target)
    expect(next.projectiles).toHaveLength(0) // arrow consumed by the hit
  })

  it('keeps flying arrows that miss', () => {
    const target = makeTarget({ x: 0, y: 1, z: 100 })
    let field = createProjectileField()
    field = spawnProjectile(field, createProjectile(origin, { x: 0, y: 0, z: 1 }, { speed: 10 }))
    const { field: next, impacts } = stepProjectileField(field, 0.1, [target])
    expect(impacts).toHaveLength(0)
    expect(next.projectiles).toHaveLength(1)
  })

  it('despawns an arrow that expires without dealing damage', () => {
    const target = makeTarget({ x: 0, y: 1, z: 100 })
    let field = createProjectileField()
    field = spawnProjectile(
      field,
      createProjectile(origin, { x: 0, y: 0, z: 1 }, { speed: 10, ttl: 0.05 }),
    )
    const { field: next, impacts } = stepProjectileField(field, 0.1, [target])
    expect(impacts).toHaveLength(0)
    expect(next.projectiles).toHaveLength(0)
  })
})
