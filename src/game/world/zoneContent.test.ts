import { describe, expect, it } from 'vitest'
import { ZONE_CONTENT, getZoneContent } from './zoneContent'
import { ZONES, listZones, type ZoneId } from './index'

const ALL_IDS: ZoneId[] = ['human-lands', 'empire', 'forest', 'mountains']

describe('zone content table', () => {
  it('is total over the ZoneId union', () => {
    expect(Object.keys(ZONE_CONTENT).sort()).toEqual([...ALL_IDS].sort())
  })

  it('gives every available zone at least one landmark', () => {
    for (const zone of listZones()) {
      if (zone.status !== 'available') continue
      expect(getZoneContent(zone.id).landmarks.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps locked zones minimal', () => {
    // Empire is the only remaining locked zone (mountains shipped in E8.2 / FLO-428).
    expect(getZoneContent('empire').landmarks).toHaveLength(0)
    expect(getZoneContent('empire').encounterAnchors).toHaveLength(0)
  })

  it('gives the mountains zone fort landmarks and a villain garrison (E8.2)', () => {
    const mountains = getZoneContent('mountains')
    expect(mountains.landmarks.length).toBeGreaterThanOrEqual(1)
    expect(mountains.encounterAnchors.some((a) => a.kind === 'soldier')).toBe(true)
    // A commander-placeholder ranged unit wires the E4.3 command/order slot.
    expect(mountains.encounterAnchors.some((a) => a.kind === 'archer')).toBe(true)
  })

  it('validates the landmark shape for every entry (trust the boundary)', () => {
    for (const id of ALL_IDS) {
      for (const lm of getZoneContent(id).landmarks) {
        expect(lm.id).toBeTruthy()
        expect(lm.role).toBeTruthy()
        expect(typeof lm.position.x).toBe('number')
        expect(typeof lm.position.z).toBe('number')
        expect(lm.height).toBeGreaterThan(0)
        expect(lm.size).toBeGreaterThan(0)
        // A landmark renders either as a greybox (colour) or a streamed asset.
        expect(lm.color !== undefined || lm.assetKey !== undefined).toBe(true)
      }
    }
  })

  it('validates the encounter-anchor shape for every entry', () => {
    for (const id of ALL_IDS) {
      for (const a of getZoneContent(id).encounterAnchors) {
        expect(a.id).toBeTruthy()
        expect(['soldier', 'caravan', 'archer']).toContain(a.kind)
        expect(typeof a.position.x).toBe('number')
        expect(typeof a.position.y).toBe('number')
        expect(typeof a.position.z).toBe('number')
      }
    }
  })

  it('uses unique landmark ids within each zone', () => {
    for (const id of ALL_IDS) {
      const ids = getZoneContent(id).landmarks.map((l) => l.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('only keys content by zones that exist in the registry', () => {
    for (const id of Object.keys(ZONE_CONTENT)) {
      expect(ZONES[id as ZoneId]).toBeDefined()
    }
  })

  it('preserves the human-lands greybox numbers (pure extraction guard)', () => {
    // These are the exact values the inline LANDMARKS const carried before the
    // extraction; if they drift the human-lands greybox stops rendering identically.
    const watchtower = getZoneContent('human-lands').landmarks[0]
    expect(watchtower.position).toEqual({ x: 10, z: 8 })
    expect(watchtower.height).toBe(5)
    expect(watchtower.size).toBe(2)
    expect(watchtower.color).toEqual({ r: 0.55, g: 0.5, b: 0.45 })
  })
})
