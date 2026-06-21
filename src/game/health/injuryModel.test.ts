import { describe, expect, it } from 'vitest'
import {
  BLEED_DAMAGE_PER_INTERVAL,
  CRAWL_SPEED_MULTIPLIER,
  blindedEyeCount,
  coerceInjuryState,
  createInjuryState,
  fitProsthetic,
  hasHalfScreenBlackout,
  isBleeding,
  isCrawling,
  isInjuryState,
  locomotionSpeedMultiplier,
  severLimb,
  severedLimbs,
  tickBleed,
  treatBleeding,
} from './injuryModel'

describe('createInjuryState', () => {
  it('starts with every limb intact and no bleeding', () => {
    const state = createInjuryState()
    expect(state).toEqual({
      leftHand: 'intact',
      rightHand: 'intact',
      leftEye: 'intact',
      rightEye: 'intact',
      leftLeg: 'intact',
      rightLeg: 'intact',
      bleeding: false,
      bleedElapsed: 0,
    })
  })
})

describe('severLimb', () => {
  it('marks the limb severed', () => {
    const state = severLimb(createInjuryState(), 'leftLeg')
    expect(state.leftLeg).toBe('severed')
  })

  it('opens a bleeding wound when a hand is lost', () => {
    const state = severLimb(createInjuryState(), 'rightHand')
    expect(state.rightHand).toBe('severed')
    expect(state.bleeding).toBe(true)
  })

  it('does not start bleeding for an eye or leg', () => {
    expect(severLimb(createInjuryState(), 'leftEye').bleeding).toBe(false)
    expect(severLimb(createInjuryState(), 'rightLeg').bleeding).toBe(false)
  })

  it('is idempotent and does not mutate the input', () => {
    const original = createInjuryState()
    const once = severLimb(original, 'leftHand')
    const twice = severLimb(once, 'leftHand')
    expect(twice).toBe(once)
    expect(original.leftHand).toBe('intact')
  })
})

describe('fitProsthetic', () => {
  it('marks a severed slot as prosthetic', () => {
    const lost = severLimb(createInjuryState(), 'leftEye')
    expect(fitProsthetic(lost, 'leftEye').leftEye).toBe('prosthetic')
  })

  it('clears the half-screen blackout when an eye is patched', () => {
    const lost = severLimb(createInjuryState(), 'rightEye')
    expect(hasHalfScreenBlackout(lost)).toBe(true)
    expect(hasHalfScreenBlackout(fitProsthetic(lost, 'rightEye'))).toBe(false)
  })

  it('does not stop an active bleed (that needs treatBleeding)', () => {
    const lost = severLimb(createInjuryState(), 'leftHand')
    expect(fitProsthetic(lost, 'leftHand').bleeding).toBe(true)
  })
})

describe('treatBleeding', () => {
  it('stops bleeding and resets the timer', () => {
    const bleeding = severLimb(createInjuryState(), 'leftHand')
    const treated = treatBleeding({ ...bleeding, bleedElapsed: 0.5 })
    expect(treated.bleeding).toBe(false)
    expect(treated.bleedElapsed).toBe(0)
  })

  it('is a no-op when not bleeding', () => {
    const state = createInjuryState()
    expect(treatBleeding(state)).toBe(state)
  })
})

describe('tickBleed', () => {
  it('deals no damage when not bleeding', () => {
    expect(tickBleed(createInjuryState(), 5).damage).toBe(0)
  })

  it('accumulates sub-interval time without damage', () => {
    const bleeding = severLimb(createInjuryState(), 'leftHand')
    const result = tickBleed(bleeding, 0.4)
    expect(result.damage).toBe(0)
    expect(result.state.bleedElapsed).toBeCloseTo(0.4)
  })

  it('deals one interval of damage and carries the remainder', () => {
    const bleeding = severLimb(createInjuryState(), 'leftHand')
    const result = tickBleed(bleeding, 1.3)
    expect(result.damage).toBe(BLEED_DAMAGE_PER_INTERVAL)
    expect(result.state.bleedElapsed).toBeCloseTo(0.3)
  })

  it('deals multiple intervals for a large delta', () => {
    const bleeding = severLimb(createInjuryState(), 'leftHand')
    expect(tickBleed(bleeding, 3).damage).toBe(BLEED_DAMAGE_PER_INTERVAL * 3)
  })
})

describe('half-screen blackout outcome', () => {
  it('triggers when at least one eye is lost', () => {
    expect(hasHalfScreenBlackout(createInjuryState())).toBe(false)
    expect(hasHalfScreenBlackout(severLimb(createInjuryState(), 'leftEye'))).toBe(true)
  })

  it('counts blinded eyes', () => {
    let state = createInjuryState()
    expect(blindedEyeCount(state)).toBe(0)
    state = severLimb(state, 'leftEye')
    state = severLimb(state, 'rightEye')
    expect(blindedEyeCount(state)).toBe(2)
  })
})

describe('crawl outcome', () => {
  it('triggers when a leg is lost and slows locomotion', () => {
    const state = severLimb(createInjuryState(), 'leftLeg')
    expect(isCrawling(state)).toBe(true)
    expect(locomotionSpeedMultiplier(state)).toBe(CRAWL_SPEED_MULTIPLIER)
  })

  it('keeps full speed while both legs are intact', () => {
    expect(isCrawling(createInjuryState())).toBe(false)
    expect(locomotionSpeedMultiplier(createInjuryState())).toBe(1)
  })
})

describe('bleed outcome helpers', () => {
  it('reports an active bleed', () => {
    expect(isBleeding(severLimb(createInjuryState(), 'leftHand'))).toBe(true)
  })
})

describe('severedLimbs', () => {
  it('lists every lost limb', () => {
    let state = createInjuryState()
    state = severLimb(state, 'leftHand')
    state = severLimb(state, 'rightEye')
    expect(severedLimbs(state)).toEqual(['leftHand', 'rightEye'])
  })

  it('ignores prosthetic slots', () => {
    const patched = fitProsthetic(severLimb(createInjuryState(), 'leftLeg'), 'leftLeg')
    expect(severedLimbs(patched)).toEqual([])
  })
})

describe('isInjuryState', () => {
  it('accepts a well-formed record', () => {
    expect(isInjuryState(createInjuryState())).toBe(true)
  })

  it('rejects malformed records', () => {
    expect(isInjuryState(null)).toBe(false)
    expect(isInjuryState({ ...createInjuryState(), leftHand: 'missing' })).toBe(false)
  })
})

describe('coerceInjuryState', () => {
  it('returns a baseline for garbage input', () => {
    expect(coerceInjuryState(null)).toEqual(createInjuryState())
  })

  it('coerces an invalid limb slot to intact', () => {
    const coerced = coerceInjuryState({ ...createInjuryState(), leftHand: 'cyborg' })
    expect(coerced.leftHand).toBe('intact')
  })
})
