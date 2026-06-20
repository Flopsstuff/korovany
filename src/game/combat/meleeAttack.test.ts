import { describe, expect, it } from 'vitest'
import {
  createMeleeAttack,
  DEFAULT_MELEE_PARAMS,
  getMeleeHits,
  stepMeleeAttack,
  type Damageable,
  type MeleeAttackState,
} from './meleeAttack'

function makeTarget(x: number, y: number, z: number): Damageable & { damaged: number } {
  const t = {
    position: { x, y, z },
    damaged: 0,
    takeDamage(amount: number) {
      t.damaged += amount
    },
  }
  return t
}

function advanceThrough(
  state: MeleeAttackState,
  seconds: number,
  attackPressed = false,
): MeleeAttackState {
  // step in 10 ms ticks; add extra half-tick so float accumulation doesn't
  // leave a residual timer that blocks the transition check.
  const dt = 0.01
  let s = state
  const steps = Math.ceil(seconds / dt) + 1
  for (let i = 0; i < steps; i++) {
    s = stepMeleeAttack(s, attackPressed && i === 0, dt)
    attackPressed = false
  }
  return s
}

describe('createMeleeAttack', () => {
  it('starts idle', () => {
    expect(createMeleeAttack()).toEqual({ phase: 'idle', phaseTimer: 0, hitWindowOpen: false })
  })
})

describe('stepMeleeAttack — state transitions', () => {
  it('transitions idle → windup on attack press', () => {
    const s = stepMeleeAttack(createMeleeAttack(), true, 0.01)
    expect(s.phase).toBe('windup')
    expect(s.hitWindowOpen).toBe(false)
  })

  it('stays idle without attack press', () => {
    const s = stepMeleeAttack(createMeleeAttack(), false, 0.01)
    expect(s.phase).toBe('idle')
  })

  it('transitions windup → active after windupDuration', () => {
    let s = stepMeleeAttack(createMeleeAttack(), true, 0.01)
    s = advanceThrough(s, DEFAULT_MELEE_PARAMS.windupDuration)
    expect(s.phase).toBe('active')
    expect(s.hitWindowOpen).toBe(true)
  })

  it('transitions active → recovery after activeDuration', () => {
    let s = stepMeleeAttack(createMeleeAttack(), true, 0.01)
    s = advanceThrough(s, DEFAULT_MELEE_PARAMS.windupDuration + DEFAULT_MELEE_PARAMS.activeDuration)
    expect(s.phase).toBe('recovery')
    expect(s.hitWindowOpen).toBe(false)
  })

  it('transitions recovery → idle after recoveryDuration', () => {
    let s = stepMeleeAttack(createMeleeAttack(), true, 0.01)
    const total =
      DEFAULT_MELEE_PARAMS.windupDuration +
      DEFAULT_MELEE_PARAMS.activeDuration +
      DEFAULT_MELEE_PARAMS.recoveryDuration
    s = advanceThrough(s, total)
    expect(s.phase).toBe('idle')
  })

  it('cannot attack while in windup (edge-trigger guard)', () => {
    let s = stepMeleeAttack(createMeleeAttack(), true, 0.01)
    // try pressing again during windup
    s = stepMeleeAttack(s, true, 0.01)
    expect(s.phase).toBe('windup')
  })

  it('cannot attack while in recovery', () => {
    let s = stepMeleeAttack(createMeleeAttack(), true, 0.01)
    s = advanceThrough(
      s,
      DEFAULT_MELEE_PARAMS.windupDuration + DEFAULT_MELEE_PARAMS.activeDuration,
    )
    expect(s.phase).toBe('recovery')
    s = stepMeleeAttack(s, true, 0.01)
    expect(s.phase).toBe('recovery')
  })
})

describe('getMeleeHits', () => {
  const forward = { x: 0, y: 0, z: 1 }
  const caster = { x: 0, y: 0, z: 0 }
  const activeState: MeleeAttackState = { phase: 'active', phaseTimer: 0.05, hitWindowOpen: true }
  const inactiveState: MeleeAttackState = { phase: 'idle', phaseTimer: 0, hitWindowOpen: false }

  it('returns empty list when window is not open', () => {
    const t = makeTarget(0, 0, 1)
    expect(getMeleeHits(inactiveState, caster, forward, [t])).toHaveLength(0)
  })

  it('hits a target within range and arc', () => {
    const t = makeTarget(0, 0, 1.5)
    const hits = getMeleeHits(activeState, caster, forward, [t])
    expect(hits).toContain(t)
  })

  it('misses a target outside range', () => {
    const t = makeTarget(0, 0, 3) // 3m > 2m radius
    expect(getMeleeHits(activeState, caster, forward, [t])).toHaveLength(0)
  })

  it('misses a target outside the frontal arc', () => {
    // directly behind the caster
    const t = makeTarget(0, 0, -1)
    expect(getMeleeHits(activeState, caster, forward, [t])).toHaveLength(0)
  })

  it('misses a target at the edge — just outside the arc', () => {
    // 61° to the side, just beyond the 60° half-arc
    const angle = (61 * Math.PI) / 180
    const t = makeTarget(Math.sin(angle) * 1.5, 0, Math.cos(angle) * 1.5)
    expect(getMeleeHits(activeState, caster, forward, [t])).toHaveLength(0)
  })

  it('can hit multiple targets simultaneously', () => {
    const t1 = makeTarget(0.3, 0, 1)
    const t2 = makeTarget(-0.3, 0, 1)
    const t3 = makeTarget(0, 0, -1) // behind — miss
    const hits = getMeleeHits(activeState, caster, forward, [t1, t2, t3])
    expect(hits).toContain(t1)
    expect(hits).toContain(t2)
    expect(hits).not.toContain(t3)
  })
})

describe('Damageable integration', () => {
  it('callers can dispatch damage to each hit target', () => {
    const forward = { x: 0, y: 0, z: 1 }
    const caster = { x: 0, y: 0, z: 0 }
    const state: MeleeAttackState = { phase: 'active', phaseTimer: 0.05, hitWindowOpen: true }
    const target = makeTarget(0, 0, 1)

    const hits = getMeleeHits(state, caster, forward, [target])
    hits.forEach((h) => h.takeDamage(25))

    expect(target.damaged).toBe(25)
  })
})
