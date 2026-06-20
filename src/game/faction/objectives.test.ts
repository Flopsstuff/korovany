import { describe, expect, it } from 'vitest'
import {
  FACTION_IDS,
  PLAYABLE_FACTION_IDS,
  isFactionId,
  isPlayableFactionId,
} from './factions'
import { FACTION_PLAYBOOKS, PLAYABLE_FACTIONS, getPlaybook } from './objectives'

describe('faction id guards', () => {
  it('accepts known faction ids', () => {
    expect(isFactionId(FACTION_IDS.Neutral)).toBe(true)
    expect(isFactionId(FACTION_IDS.Empire)).toBe(true)
    expect(isFactionId(FACTION_IDS.ForestElves)).toBe(true)
    expect(isFactionId(FACTION_IDS.Villain)).toBe(true)
  })

  it('rejects unknown or non-string values', () => {
    expect(isFactionId('goblins')).toBe(false)
    expect(isFactionId('')).toBe(false)
    expect(isFactionId(null)).toBe(false)
    expect(isFactionId(42)).toBe(false)
  })

  it('treats neutral as not player-selectable', () => {
    expect(isPlayableFactionId(FACTION_IDS.Neutral)).toBe(false)
    expect(isPlayableFactionId(FACTION_IDS.Empire)).toBe(true)
    expect(isPlayableFactionId(FACTION_IDS.ForestElves)).toBe(true)
    expect(isPlayableFactionId(FACTION_IDS.Villain)).toBe(true)
  })
})

describe('faction playbooks (asymmetric objectives)', () => {
  it('defines exactly the three playable factions, in display order', () => {
    expect(PLAYABLE_FACTION_IDS).toEqual([
      FACTION_IDS.ForestElves,
      FACTION_IDS.Empire,
      FACTION_IDS.Villain,
    ])
    expect(PLAYABLE_FACTIONS.map((f) => f.id)).toEqual([...PLAYABLE_FACTION_IDS])
  })

  it('gives the Forest Elves raid + defend objectives', () => {
    const elf = getPlaybook(FACTION_IDS.ForestElves)
    expect(elf.objectives.map((o) => o.kind)).toEqual(['raid', 'raid', 'defend'])
    expect(elf.objectives.find((o) => o.id === 'elf-raid-empire')?.targetFactionId).toBe(
      FACTION_IDS.Empire,
    )
    expect(elf.objectives.find((o) => o.id === 'elf-raid-villain')?.targetFactionId).toBe(
      FACTION_IDS.Villain,
    )
    expect(elf.objectives.find((o) => o.kind === 'defend')?.targetRegion).toBe('Emerald Thicket')
  })

  it('gives the Palace Guard obey + defend objectives', () => {
    const empire = getPlaybook(FACTION_IDS.Empire)
    expect(empire.role).toBe('Palace Guard')
    expect(empire.objectives.map((o) => o.kind)).toEqual(['obey', 'defend'])
    expect(empire.objectives.find((o) => o.kind === 'defend')?.targetRegion).toBe('Imperial palace')
  })

  it('gives the Villain command + attack objectives aimed at the Empire', () => {
    const villain = getPlaybook(FACTION_IDS.Villain)
    expect(villain.objectives.map((o) => o.kind)).toEqual(['command', 'attack'])
    expect(villain.objectives.find((o) => o.kind === 'attack')?.targetFactionId).toBe(
      FACTION_IDS.Empire,
    )
  })

  it('keeps objective ids unique across all playbooks (quest-tracking safe)', () => {
    const ids = Object.values(FACTION_PLAYBOOKS).flatMap((p) => p.objectives.map((o) => o.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
