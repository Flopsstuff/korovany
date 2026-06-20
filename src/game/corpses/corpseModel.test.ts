import { describe, expect, it } from 'vitest'
import {
  addCorpse,
  type CorpseRecord,
  corpsesForZone,
  createCorpseField,
  DEFAULT_CORPSE_CAP,
} from './corpseModel'

function rec(id: string, zoneId = 'forest'): CorpseRecord {
  return { id, zoneId, position: { x: 0, y: 0, z: 0 }, rotationY: 0 }
}

describe('createCorpseField', () => {
  it('defaults to the documented cap and starts empty', () => {
    const f = createCorpseField()
    expect(f.cap).toBe(DEFAULT_CORPSE_CAP)
    expect(f.corpses).toHaveLength(0)
  })

  it('floors and clamps a custom cap to a non-negative integer', () => {
    expect(createCorpseField(3.9).cap).toBe(3)
    expect(createCorpseField(-5).cap).toBe(0)
  })
})

describe('addCorpse — retention cap (FIFO)', () => {
  it('appends without eviction while under the cap', () => {
    let f = createCorpseField(3)
    const a = addCorpse(f, rec('a'))
    expect(a.evicted).toHaveLength(0)
    expect(a.field.corpses.map((c) => c.id)).toEqual(['a'])
    f = a.field
    const b = addCorpse(f, rec('b'))
    expect(b.evicted).toHaveLength(0)
    expect(b.field.corpses.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('evicts the oldest corpse when the cap is exceeded', () => {
    let f = createCorpseField(2)
    f = addCorpse(f, rec('a')).field
    f = addCorpse(f, rec('b')).field
    const c = addCorpse(f, rec('c'))
    expect(c.evicted.map((r) => r.id)).toEqual(['a'])
    expect(c.field.corpses.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('immediately evicts when cap is 0', () => {
    const f = createCorpseField(0)
    const r = addCorpse(f, rec('a'))
    expect(r.field.corpses).toHaveLength(0)
    expect(r.evicted.map((c) => c.id)).toEqual(['a'])
  })

  it('does not mutate the input field', () => {
    const f = createCorpseField(2)
    addCorpse(f, rec('a'))
    expect(f.corpses).toHaveLength(0)
  })
})

describe('corpsesForZone', () => {
  it('returns only the matching zone, oldest first', () => {
    let f = createCorpseField(10)
    f = addCorpse(f, rec('a', 'forest')).field
    f = addCorpse(f, rec('b', 'cave')).field
    f = addCorpse(f, rec('c', 'forest')).field
    expect(corpsesForZone(f, 'forest').map((r) => r.id)).toEqual(['a', 'c'])
    expect(corpsesForZone(f, 'cave').map((r) => r.id)).toEqual(['b'])
  })
})
