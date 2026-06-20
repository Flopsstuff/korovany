import { describe, expect, it } from 'vitest'
import { applyDamage, createHealth, healDamage, isAlive } from './healthModel'

describe('createHealth', () => {
  it('creates full health', () => {
    const h = createHealth(100)
    expect(h).toEqual({ current: 100, max: 100 })
  })
})

describe('isAlive', () => {
  it('returns true when current > 0', () => {
    expect(isAlive({ current: 1, max: 100 })).toBe(true)
  })

  it('returns false when current is 0', () => {
    expect(isAlive({ current: 0, max: 100 })).toBe(false)
  })
})

describe('applyDamage', () => {
  it('reduces current by amount', () => {
    const result = applyDamage({ current: 100, max: 100 }, 30)
    expect(result.current).toBe(70)
  })

  it('clamps to 0, never goes negative', () => {
    const result = applyDamage({ current: 10, max: 100 }, 999)
    expect(result.current).toBe(0)
  })

  it('does not mutate input', () => {
    const original = { current: 50, max: 100 }
    applyDamage(original, 10)
    expect(original.current).toBe(50)
  })
})

describe('healDamage', () => {
  it('increases current by amount', () => {
    const result = healDamage({ current: 40, max: 100 }, 30)
    expect(result.current).toBe(70)
  })

  it('clamps to max, never exceeds it', () => {
    const result = healDamage({ current: 90, max: 100 }, 50)
    expect(result.current).toBe(100)
  })
})
