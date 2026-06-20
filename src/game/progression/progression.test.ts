import { describe, expect, it } from 'vitest'
import {
  applyProgressionEvent,
  combatKillProgressionEvent,
  createProgression,
  damageMultiplier,
  isProgressionState,
  maxHealthBonus,
  movementSpeedMultiplier,
  purchaseProgressionEvent,
} from './progression'

describe('progression model', () => {
  it('starts with level 1, baseline stats, and baseline skills', () => {
    expect(createProgression()).toEqual({
      level: 1,
      xp: 0,
      nextLevelXp: 100,
      stats: {
        strength: { level: 10, xp: 0 },
        agility: { level: 10, xp: 0 },
        endurance: { level: 10, xp: 0 },
      },
      skills: {
        melee: { level: 1, xp: 0 },
        trade: { level: 1, xp: 0 },
        survival: { level: 1, xp: 0 },
      },
    })
  })

  it('levels character XP independently from stat and skill tracks', () => {
    const state = applyProgressionEvent(createProgression(), {
      source: 'test',
      xp: 225,
      statXp: { strength: 125 },
      skillXp: { melee: 105 },
    })

    expect(state.level).toBe(3)
    expect(state.nextLevelXp).toBe(300)
    expect(state.stats.strength).toEqual({ level: 12, xp: 125 })
    expect(state.skills.melee).toEqual({ level: 3, xp: 105 })
  })

  it('maps combat kills to XP, stat, and skill progression', () => {
    const state = applyProgressionEvent(createProgression(), combatKillProgressionEvent('soldier'))

    expect(state.xp).toBe(35)
    expect(state.stats.strength.xp).toBe(12)
    expect(state.stats.endurance.xp).toBe(8)
    expect(state.skills.melee.xp).toBe(20)
  })

  it('maps purchases to trade progression with non-zero minimum XP', () => {
    const state = applyProgressionEvent(createProgression(), purchaseProgressionEvent({ value: 3 }))

    expect(state.xp).toBe(1)
    expect(state.stats.agility.xp).toBe(1)
    expect(state.skills.trade.xp).toBe(1)
  })

  it('exposes derived bonuses without applying them to combat or health', () => {
    const state = applyProgressionEvent(createProgression(), {
      source: 'test',
      xp: 0,
      statXp: { strength: 60, endurance: 120, agility: 60 },
      skillXp: { melee: 50 },
    })

    expect(damageMultiplier(state)).toBeCloseTo(1.05)
    expect(maxHealthBonus(state)).toBe(10)
    expect(movementSpeedMultiplier(state)).toBeCloseTo(1.015)
  })

  it('validates the serialisable save shape', () => {
    expect(isProgressionState(createProgression())).toBe(true)
    expect(isProgressionState({ ...createProgression(), stats: {} })).toBe(false)
  })
})
