import { describe, expect, it } from 'vitest'
import { createInjuryState, severLimb, type InjuryState, type Limb } from './injuryModel'
import {
  DISMEMBER_BASE_CHANCE,
  DISMEMBER_DAMAGE_THRESHOLD,
  DISMEMBER_MAX_CHANCE,
  dismemberChance,
  intactLimbs,
  pickLimb,
  resolveDismemberment,
  shouldSever,
} from './dismemberment'
import type { Rng } from '../util/rng'

/** Deterministic generator that replays the supplied values in order. */
function seq(...values: number[]): Rng {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('dismemberChance', () => {
  it('is zero below the damage threshold', () => {
    expect(dismemberChance(0)).toBe(0)
    expect(dismemberChance(DISMEMBER_DAMAGE_THRESHOLD - 1)).toBe(0)
  })

  it('starts at the base chance at the threshold', () => {
    expect(dismemberChance(DISMEMBER_DAMAGE_THRESHOLD)).toBeCloseTo(DISMEMBER_BASE_CHANCE)
  })

  it('grows with damage above the threshold', () => {
    expect(dismemberChance(DISMEMBER_DAMAGE_THRESHOLD + 10)).toBeGreaterThan(
      dismemberChance(DISMEMBER_DAMAGE_THRESHOLD),
    )
  })

  it('is capped at the max chance for overkill hits', () => {
    expect(dismemberChance(10_000)).toBe(DISMEMBER_MAX_CHANCE)
  })
})

describe('intactLimbs', () => {
  it('lists all six limbs when uninjured', () => {
    expect(intactLimbs(createInjuryState())).toHaveLength(6)
  })

  it('excludes severed limbs', () => {
    const state = severLimb(createInjuryState(), 'leftLeg')
    const intact = intactLimbs(state)
    expect(intact).not.toContain('leftLeg')
    expect(intact).toHaveLength(5)
  })
})

describe('shouldSever', () => {
  it('never severs a hit below the threshold', () => {
    // rng draws 0 (the most "severing" roll possible) yet sub-threshold = no sever.
    expect(shouldSever(DISMEMBER_DAMAGE_THRESHOLD - 1, createInjuryState(), seq(0))).toBe(false)
  })

  it('severs when the roll lands under the chance', () => {
    expect(shouldSever(DISMEMBER_DAMAGE_THRESHOLD, createInjuryState(), seq(0))).toBe(true)
  })

  it('does not sever when the roll lands above the chance', () => {
    expect(shouldSever(DISMEMBER_DAMAGE_THRESHOLD, createInjuryState(), seq(0.99))).toBe(false)
  })

  it('never severs once every limb is gone, even on a massive hit', () => {
    let state: InjuryState = createInjuryState()
    const all: Limb[] = ['leftHand', 'rightHand', 'leftEye', 'rightEye', 'leftLeg', 'rightLeg']
    for (const limb of all) state = severLimb(state, limb)
    expect(shouldSever(10_000, state, seq(0))).toBe(false)
  })
})

describe('pickLimb', () => {
  it('returns one of the intact limbs', () => {
    const limb = pickLimb(createInjuryState(), seq(0))
    expect(limb).not.toBeNull()
    expect(intactLimbs(createInjuryState())).toContain(limb!)
  })

  it('only ever returns an intact limb', () => {
    // Sever everything but rightLeg; the pick must land on rightLeg regardless of roll.
    let state: InjuryState = createInjuryState()
    for (const limb of ['leftHand', 'rightHand', 'leftEye', 'rightEye', 'leftLeg'] as Limb[]) {
      state = severLimb(state, limb)
    }
    expect(pickLimb(state, seq(0.999))).toBe('rightLeg')
  })

  it('returns null when no limbs remain', () => {
    let state: InjuryState = createInjuryState()
    const all: Limb[] = ['leftHand', 'rightHand', 'leftEye', 'rightEye', 'leftLeg', 'rightLeg']
    for (const limb of all) state = severLimb(state, limb)
    expect(pickLimb(state, seq(0))).toBeNull()
  })
})

describe('P7.2 softened balance', () => {
  it('keeps even an overkill hit a rare, non-routine sever (cap ≤ 0.15)', () => {
    // Counterplay only matters if losing a limb is the exception, not the rule.
    expect(DISMEMBER_MAX_CHANCE).toBeLessThanOrEqual(0.15)
    expect(dismemberChance(10_000)).toBeLessThanOrEqual(0.15)
  })

  it('never dismembers an ordinary light blow', () => {
    // A 19 HP hit is below the raised threshold, so it can never take a limb.
    expect(dismemberChance(DISMEMBER_DAMAGE_THRESHOLD - 1)).toBe(0)
    expect(shouldSever(DISMEMBER_DAMAGE_THRESHOLD - 1, createInjuryState(), seq(0))).toBe(false)
  })
})

describe('resolveDismemberment', () => {
  it('returns a limb when the hit severs (roll under chance, then a pick)', () => {
    // First draw decides the sever (0 < chance), second draw indexes the limb.
    const limb = resolveDismemberment(40, createInjuryState(), seq(0, 0))
    expect(limb).toBe('leftHand') // index 0 of LIMBS
  })

  it('returns null when the hit does not sever', () => {
    expect(resolveDismemberment(40, createInjuryState(), seq(0.99))).toBeNull()
  })

  it('returns null for a sub-threshold hit regardless of roll', () => {
    expect(resolveDismemberment(5, createInjuryState(), seq(0, 0))).toBeNull()
  })
})
