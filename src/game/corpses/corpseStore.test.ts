import { describe, expect, it } from 'vitest'
import { CorpseStore, sessionCorpseStore } from './corpseStore'

describe('CorpseStore', () => {
  it('records a corpse with a stable, unique id and copied position', () => {
    const store = new CorpseStore(10)
    const pos = { x: 6, y: 0.9, z: 6 }
    const { corpse } = store.record('forest', pos, 1.2)
    expect(corpse.id).toBe('corpse-0')
    expect(corpse.zoneId).toBe('forest')
    expect(corpse.position).toEqual({ x: 6, y: 0.9, z: 6 })
    expect(corpse.rotationY).toBe(1.2)

    // Position is copied, not aliased — later mutation of the source is ignored.
    pos.x = 999
    expect(corpse.position.x).toBe(6)

    const second = store.record('forest', { x: 0, y: 0, z: 0 }, 0)
    expect(second.corpse.id).toBe('corpse-1')
  })

  it('persists corpses across reads (zone re-enter within a session)', () => {
    const store = new CorpseStore(10)
    store.record('forest', { x: 1, y: 0, z: 1 }, 0)
    store.record('forest', { x: 2, y: 0, z: 2 }, 0)
    expect(store.forZone('forest')).toHaveLength(2)
    // A second read (simulating a rebuilt scene) still sees them.
    expect(store.forZone('forest')).toHaveLength(2)
  })

  it('enforces the cap and reports evictions', () => {
    const store = new CorpseStore(2)
    store.record('forest', { x: 0, y: 0, z: 0 }, 0)
    store.record('forest', { x: 0, y: 0, z: 0 }, 0)
    const third = store.record('forest', { x: 0, y: 0, z: 0 }, 0)
    expect(third.evicted.map((r) => r.id)).toEqual(['corpse-0'])
    expect(store.size).toBe(2)
    expect(store.forZone('forest').map((r) => r.id)).toEqual(['corpse-1', 'corpse-2'])
  })

  it('reset clears all corpses and the id sequence', () => {
    const store = new CorpseStore(10)
    store.record('forest', { x: 0, y: 0, z: 0 }, 0)
    store.reset()
    expect(store.size).toBe(0)
    expect(store.record('forest', { x: 0, y: 0, z: 0 }, 0).corpse.id).toBe('corpse-0')
  })
})

describe('sessionCorpseStore', () => {
  it('is a ready-to-use shared store', () => {
    expect(sessionCorpseStore).toBeInstanceOf(CorpseStore)
    expect(sessionCorpseStore.cap).toBeGreaterThan(0)
  })
})
