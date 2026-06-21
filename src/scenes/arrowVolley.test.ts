import { describe, expect, it } from 'vitest'
import { NullEngine, Scene } from '@babylonjs/core'
import { ArrowVolley, arrowMuzzle } from './arrowVolley'
import type { Damageable, Vec3 } from '../game/combat'

function makeScene(): Scene {
  return new Scene(new NullEngine())
}

function makeTarget(position: Vec3): Damageable & { taken: number[] } {
  return {
    position,
    taken: [] as number[],
    takeDamage(amount: number) {
      this.taken.push(amount)
    },
  }
}

describe('ArrowVolley', () => {
  it('routes an arrow hit through the target Damageable funnel', () => {
    const scene = makeScene()
    const target = makeTarget({ x: 0, y: 1, z: 5 })
    const volley = new ArrowVolley(scene, { getTargets: () => [target] })

    volley.fire({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 12, 10)
    expect(volley.liveCount).toBe(1)

    // 0.5s * 10m/s = 5m → the arrow reaches the target and is consumed.
    volley.update(0.5, undefined)
    expect(target.taken).toEqual([12])
    expect(volley.liveCount).toBe(0)
  })

  it('keeps a missing arrow alive until it expires', () => {
    const scene = makeScene()
    const target = makeTarget({ x: 100, y: 1, z: 0 })
    const volley = new ArrowVolley(scene, { getTargets: () => [target] })
    volley.fire({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 12, 10)
    volley.update(0.1, undefined)
    expect(target.taken).toHaveLength(0)
    expect(volley.liveCount).toBe(1)
  })

  it('puts the muzzle above the archer feet', () => {
    expect(arrowMuzzle({ x: 1, y: 0.9, z: 2 }).y).toBeGreaterThan(0.9)
  })
})
