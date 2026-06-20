import { describe, expect, it } from 'vitest'
import {
  FACTION_ID_LIST,
  FACTION_IDS,
  FACTIONS,
  MAX_REPUTATION,
  MIN_REPUTATION,
  adjustReputation,
  clampReputation,
  createDefaultReputation,
  resolveStance,
  setReputation,
} from './factions'

describe('faction model', () => {
  it('defines the stable faction ids', () => {
    expect(Object.keys(FACTIONS).sort()).toEqual([
      'empire',
      'forestElves',
      'neutral',
      'villain',
    ])
    expect(FACTIONS[FACTION_IDS.Neutral].home).toBe('Human lands')
    expect(FACTIONS[FACTION_IDS.Empire].name).toBe('Empire / Palace Guard')
  })

  it('keeps the relationship matrix symmetric', () => {
    for (const a of FACTION_ID_LIST) {
      for (const b of FACTION_ID_LIST) {
        expect(resolveStance(a, b), `${a} -> ${b}`).toBe(resolveStance(b, a))
      }
    }
  })

  it('uses sane default stances', () => {
    expect(resolveStance(FACTION_IDS.Neutral, FACTION_IDS.Neutral)).toBe('allied')
    expect(resolveStance(FACTION_IDS.Neutral, FACTION_IDS.Empire)).toBe('neutral')
    expect(resolveStance(FACTION_IDS.Neutral, FACTION_IDS.ForestElves)).toBe('neutral')
    expect(resolveStance(FACTION_IDS.Empire, FACTION_IDS.ForestElves)).toBe('hostile')
    expect(resolveStance(FACTION_IDS.Villain, FACTION_IDS.Neutral)).toBe('hostile')
  })

  it('clamps reputation to the supported bounds', () => {
    expect(clampReputation(MAX_REPUTATION + 20)).toBe(MAX_REPUTATION)
    expect(clampReputation(MIN_REPUTATION - 20)).toBe(MIN_REPUTATION)
    expect(clampReputation(12.8)).toBe(12)
    expect(clampReputation(Number.NaN)).toBe(0)
  })

  it('updates reputation without mutating the source map', () => {
    const start = createDefaultReputation()
    const raised = setReputation(start, FACTION_IDS.Empire, 150)
    const lowered = adjustReputation(raised, FACTION_IDS.Empire, -250)

    expect(start[FACTION_IDS.Empire]).toBe(0)
    expect(raised[FACTION_IDS.Empire]).toBe(MAX_REPUTATION)
    expect(lowered[FACTION_IDS.Empire]).toBe(MIN_REPUTATION)
  })
})
