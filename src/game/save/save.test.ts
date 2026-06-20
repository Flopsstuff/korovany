import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SAVE_VERSION,
  clearSave,
  createSaveData,
  hasSave,
  loadLatest,
  openSaveStore,
  saveGame,
  type PlayerSnapshot,
} from './index'
import { FACTION_IDS } from '../faction'

// A fresh in-memory IndexedDB per test so slots never leak across cases.
let factory: IDBFactory

beforeEach(() => {
  factory = new IDBFactory()
})

const snapshot: PlayerSnapshot = {
  transform: { position: { x: 1.5, y: 2, z: -3.25 }, rotationY: Math.PI / 2 },
  health: { current: 73, max: 120 },
  zoneId: 'forest',
  inventory: { counts: { gold: 8, blade: 1 }, equippedItemId: 'blade' },
  playerFactionId: FACTION_IDS.ForestElves,
}

describe('createSaveData', () => {
  it('stamps the current schema version', () => {
    const data = createSaveData(snapshot, 1000)
    expect(data.version).toBe(SAVE_VERSION)
    expect(data.savedAt).toBe(1000)
    expect(data.transform).toEqual(snapshot.transform)
    expect(data.health).toEqual({ current: 73, max: 120 })
    expect(data.zoneId).toBe('forest')
    expect(data.inventory).toEqual({ counts: { gold: 8, blade: 1 }, equippedItemId: 'blade' })
    expect(data.playerFactionId).toBe(FACTION_IDS.ForestElves)
  })

  it('decouples the persisted inventory from the live slice reference', () => {
    const data = createSaveData(snapshot, 1000)
    expect(data.inventory.counts).not.toBe(snapshot.inventory.counts)
  })
})

describe('save round-trip (fake-indexeddb)', () => {
  it('serialises a snapshot and restores it byte-for-byte', async () => {
    await saveGame(snapshot, 1234, { factory })

    const loaded = await loadLatest({ factory })
    expect(loaded).not.toBeNull()
    expect(loaded).toEqual({
      version: SAVE_VERSION,
      transform: snapshot.transform,
      health: { current: 73, max: 120 },
      zoneId: 'forest',
      inventory: { counts: { gold: 8, blade: 1 }, equippedItemId: 'blade' },
      playerFactionId: FACTION_IDS.ForestElves,
      savedAt: 1234,
    })
  })

  it('persists a version field on every record', async () => {
    await saveGame(snapshot, 1, { factory })
    const loaded = await loadLatest({ factory })
    expect(loaded?.version).toBe(SAVE_VERSION)
  })

  it('overwrites the same slot in place', async () => {
    await saveGame(snapshot, 1, { factory })
    await saveGame({ ...snapshot, health: { current: 10, max: 120 } }, 2, { factory })

    const store = await openSaveStore(factory)
    try {
      const all = await store.list()
      expect(all).toHaveLength(1)
      expect(all[0].data.health).toEqual({ current: 10, max: 120 })
      expect(all[0].data.savedAt).toBe(2)
    } finally {
      store.close()
    }
  })

  it('picks the most recently saved slot as latest', async () => {
    await saveGame({ ...snapshot, zoneId: 'older' }, 100, { factory, slot: 0 })
    await saveGame({ ...snapshot, zoneId: 'newer' }, 200, { factory, slot: 1 })

    const loaded = await loadLatest({ factory })
    expect(loaded?.zoneId).toBe('newer')
  })
})

describe('empty-store path', () => {
  it('reports no save and loads null when nothing was written', async () => {
    expect(await hasSave({ factory })).toBe(false)
    expect(await loadLatest({ factory })).toBeNull()
  })

  it('reports a save once one exists', async () => {
    await saveGame(snapshot, 1, { factory })
    expect(await hasSave({ factory })).toBe(true)
  })

  it('clears a slot back to empty', async () => {
    await saveGame(snapshot, 1, { factory })
    await clearSave({ factory })
    expect(await hasSave({ factory })).toBe(false)
    expect(await loadLatest({ factory })).toBeNull()
  })
})

describe('corrupt records', () => {
  it('skips malformed slot data on read', async () => {
    // Write a junk record directly under the store's keyPath, bypassing saveGame.
    const store = await openSaveStore(factory)
    try {
      // @ts-expect-error — deliberately invalid payload to exercise the guard.
      await store.put(0, { version: 1, nonsense: true })
    } finally {
      store.close()
    }
    expect(await loadLatest({ factory })).toBeNull()
    expect(await hasSave({ factory })).toBe(false)
  })
})
