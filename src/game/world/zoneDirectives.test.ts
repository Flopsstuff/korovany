import { describe, expect, it } from 'vitest'
import { getZoneDirective, ownerFactionId } from './zoneDirectives'
import { FACTION_IDS } from '../faction/factions'

describe('ownerFactionId', () => {
  it('bridges the kebab-case zone-owner Faction to the camelCase FactionId', () => {
    expect(ownerFactionId('forest-elves')).toBe(FACTION_IDS.ForestElves)
    expect(ownerFactionId('empire')).toBe(FACTION_IDS.Empire)
    expect(ownerFactionId('villain')).toBe(FACTION_IDS.Villain)
    expect(ownerFactionId('neutral')).toBe(FACTION_IDS.Neutral)
  })
})

describe('getZoneDirective — empire (palace) faction tie-in (E8.1)', () => {
  it('orders the Palace Guard to DEFEND the palace', () => {
    const d = getZoneDirective('empire', FACTION_IDS.Empire)
    expect(d.kind).toBe('defend')
    expect(d.summary).toMatch(/defend/i)
  })

  it('orders the Forest Elves to RAID the palace', () => {
    const d = getZoneDirective('empire', FACTION_IDS.ForestElves)
    expect(d.kind).toBe('raid')
    expect(d.summary).toMatch(/raid/i)
  })

  it('orders the Villain to RAID (attack) the palace', () => {
    const d = getZoneDirective('empire', FACTION_IDS.Villain)
    expect(d.kind).toBe('raid')
  })

  it('gives the unaffiliated player a neutral patrol order', () => {
    const d = getZoneDirective('empire', FACTION_IDS.Neutral)
    expect(d.kind).toBe('patrol')
  })
})

describe('getZoneDirective — generalises across zones via the stance matrix', () => {
  it('an Elf defends their own forest but raids the empire', () => {
    expect(getZoneDirective('forest', FACTION_IDS.ForestElves).kind).toBe('defend')
    expect(getZoneDirective('empire', FACTION_IDS.ForestElves).kind).toBe('raid')
  })

  it('falls back to a neutral patrol for an unknown zone', () => {
    const d = getZoneDirective('atlantis', FACTION_IDS.Empire)
    expect(d.kind).toBe('patrol')
    expect(d.summary).toBeTruthy()
  })

  it('always returns a non-empty player-facing summary', () => {
    for (const zone of ['human-lands', 'empire', 'forest', 'mountains']) {
      for (const f of Object.values(FACTION_IDS)) {
        expect(getZoneDirective(zone, f).summary.length).toBeGreaterThan(0)
      }
    }
  })
})
