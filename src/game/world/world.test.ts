import { describe, expect, it } from 'vitest'
import {
  getZone,
  isZoneAvailable,
  isZoneId,
  listZones,
  planTravel,
  ZONE_ORDER,
  ZONES,
  type ZoneId,
} from './index'

const ALL_IDS: ZoneId[] = ['human-lands', 'empire', 'forest', 'mountains']

describe('zone registry', () => {
  it('declares all four canonical zones (game-plan §0)', () => {
    expect(Object.keys(ZONES).sort()).toEqual([...ALL_IDS].sort())
    expect(listZones()).toHaveLength(4)
  })

  it('lists zones in the game-plan §0 order', () => {
    expect(listZones().map((z) => z.id)).toEqual(ZONE_ORDER)
  })

  it('gives every zone a display name, owner, spawn and streaming entry point', () => {
    for (const zone of listZones()) {
      expect(zone.displayName).toBeTruthy()
      expect(zone.loreName).toBeTruthy()
      expect(zone.ownerLabel).toBeTruthy()
      expect(zone.spawn.position).toBeDefined()
      expect(typeof zone.spawn.rotationY).toBe('number')
      expect(zone.streaming.manifestId).toBeTruthy()
      expect(zone.streaming.sceneKey).toBeTruthy()
    }
  })

  it('ships Forest, Human lands and Mountains as available, Empire locked', () => {
    expect(isZoneAvailable('forest')).toBe(true)
    expect(isZoneAvailable('human-lands')).toBe(true)
    // Mountains (Black Crown Pass) shipped its scene in E8.2 (FLO-428).
    expect(isZoneAvailable('mountains')).toBe(true)
    expect(isZoneAvailable('empire')).toBe(false)
  })

  it('resolves known ids and rejects unknown ones', () => {
    expect(getZone('forest')?.id).toBe('forest')
    expect(getZone('atlantis')).toBeUndefined()
    expect(isZoneId('forest')).toBe(true)
    expect(isZoneId('atlantis')).toBe(false)
  })
})

describe('planTravel (fast-travel resolver)', () => {
  it('plans travel to an available zone and returns its spawn', () => {
    const result = planTravel('forest', 'human-lands')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.zone.id).toBe('human-lands')
      expect(result.plan.spawn).toEqual(ZONES['human-lands'].spawn)
    }
  })

  it('rejects travel to a locked zone', () => {
    expect(planTravel('forest', 'empire')).toEqual({ ok: false, reason: 'zone-locked' })
  })

  it('plans travel to the now-unlocked mountains zone (E8.2)', () => {
    const result = planTravel('forest', 'mountains')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.zone.id).toBe('mountains')
  })

  it('rejects travel to an unknown zone', () => {
    expect(planTravel('forest', 'atlantis')).toEqual({ ok: false, reason: 'unknown-zone' })
  })

  it('rejects travel to the zone the player is already in', () => {
    expect(planTravel('forest', 'forest')).toEqual({ ok: false, reason: 'already-here' })
  })
})
