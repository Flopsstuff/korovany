import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_HP,
  applyDamage,
  createHealth,
  healDamage,
  isAlive,
  type HealthState,
} from './index'

describe('createHealth', () => {
  it('defaults to a full-health entity', () => {
    expect(createHealth()).toEqual<HealthState>({
      currentHp: DEFAULT_MAX_HP,
      maxHp: DEFAULT_MAX_HP,
      alive: true,
    })
  })

  it('forces maxHp to at least 1 and clamps currentHp into range', () => {
    expect(createHealth(0, 50)).toEqual<HealthState>({ currentHp: 1, maxHp: 1, alive: true })
    expect(createHealth(40, 999)).toEqual<HealthState>({ currentHp: 40, maxHp: 40, alive: true })
    expect(createHealth(40, -5)).toEqual<HealthState>({ currentHp: 0, maxHp: 40, alive: false })
  })
})

describe('applyDamage', () => {
  it('subtracts damage and keeps the entity alive while HP remains', () => {
    expect(applyDamage(createHealth(100), 30)).toMatchObject({ currentHp: 70, alive: true })
  })

  it('clamps over-damage to 0 and marks the entity dead', () => {
    expect(applyDamage(createHealth(100, 25), 999)).toMatchObject({ currentHp: 0, alive: false })
  })

  it('ignores negative damage (no accidental healing)', () => {
    expect(applyDamage(createHealth(100, 40), -50)).toMatchObject({ currentHp: 40, alive: true })
  })

  it('returns a new object without mutating the input', () => {
    const state = createHealth(100)
    applyDamage(state, 10)
    expect(state.currentHp).toBe(100)
  })
})

describe('healDamage', () => {
  it('heals up to maxHp (heal-over-max clamps to maxHp)', () => {
    expect(healDamage(createHealth(100, 80), 50)).toMatchObject({ currentHp: 100, alive: true })
  })

  it('full-heals a damaged entity', () => {
    expect(healDamage(createHealth(100, 1), 99)).toMatchObject({ currentHp: 100, alive: true })
  })

  it('ignores negative heals (no accidental damage)', () => {
    expect(healDamage(createHealth(100, 40), -50)).toMatchObject({ currentHp: 40, alive: true })
  })
})

describe('isAlive', () => {
  it('mirrors currentHp > 0', () => {
    expect(isAlive(createHealth(100, 1))).toBe(true)
    expect(isAlive(createHealth(100, 0))).toBe(false)
  })
})
