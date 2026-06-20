import { describe, expect, it } from 'vitest'
import { createProgression, type ProgressionState } from '../game/progression'
import {
  progressionReducer,
  recordCombatKill,
  recordPurchase,
  resetProgression,
  restoreProgression,
  selectDamageMultiplier,
  selectMaxHealthBonus,
  selectMovementSpeedMultiplier,
  selectProgression,
} from './progressionSlice'

describe('progressionSlice', () => {
  it('starts from the pure default progression model', () => {
    expect(progressionReducer(undefined, { type: '@@INIT' })).toEqual(createProgression())
  })

  it('records combat kill progression', () => {
    const state = progressionReducer(undefined, recordCombatKill('soldier'))
    expect(state.xp).toBe(35)
    expect(state.stats.strength.xp).toBe(12)
    expect(state.skills.melee.xp).toBe(20)
  })

  it('records purchase progression for the future buying hook', () => {
    const state = progressionReducer(undefined, recordPurchase({ value: 25 }))
    expect(state.xp).toBe(5)
    expect(state.stats.agility.xp).toBe(3)
    expect(state.skills.trade.xp).toBe(5)
  })

  it('resets and restores progression state for New Game and Continue', () => {
    const progressed = progressionReducer(undefined, recordCombatKill('soldier'))
    expect(progressionReducer(progressed, resetProgression())).toEqual(createProgression())

    const restored = progressionReducer(undefined, restoreProgression(progressed))
    expect(restored).toEqual(progressed)
    expect(restored.stats).not.toBe(progressed.stats)
  })

  it('exposes derived selectors', () => {
    const progressed: ProgressionState = {
      ...createProgression(),
      stats: {
        strength: { level: 11, xp: 60 },
        agility: { level: 11, xp: 60 },
        endurance: { level: 12, xp: 120 },
      },
      skills: {
        melee: { level: 2, xp: 50 },
        trade: { level: 1, xp: 0 },
        survival: { level: 1, xp: 0 },
      },
    }
    const root = { progression: progressed }

    expect(selectProgression(root)).toBe(progressed)
    expect(selectDamageMultiplier(root)).toBeCloseTo(1.05)
    expect(selectMaxHealthBonus(root)).toBe(10)
    expect(selectMovementSpeedMultiplier(root)).toBeCloseTo(1.015)
  })
})
