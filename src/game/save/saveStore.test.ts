import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AUTOSAVE_SLOT,
  deleteSave,
  hasSave,
  readSave,
  resetDbCache,
  writeSave,
  type SavePayload,
} from '.'

// fake-indexeddb/auto installs a global in-memory IndexedDB shim so these tests
// exercise the real async store API without a real browser. Reset the module-level
// DB handle between tests so each test opens its own fresh database handle.
beforeEach(() => resetDbCache())
afterEach(() => resetDbCache())

const SAMPLE: SavePayload = {
  zoneId: 'forest',
  playerPos: { x: 1, y: 2, z: 3 },
  score: 42,
  savedAt: 1_000_000,
}

describe('writeSave / readSave', () => {
  it('round-trips a save payload', async () => {
    await writeSave(AUTOSAVE_SLOT, SAMPLE)
    const loaded = await readSave(AUTOSAVE_SLOT)
    expect(loaded).toEqual(SAMPLE)
  })

  it('returns null for a slot that was never written', async () => {
    expect(await readSave('slot-99')).toBeNull()
  })

  it('overwrites the previous value when the same slot is written twice', async () => {
    await writeSave(AUTOSAVE_SLOT, SAMPLE)
    const updated: SavePayload = { ...SAMPLE, score: 999 }
    await writeSave(AUTOSAVE_SLOT, updated)
    expect((await readSave(AUTOSAVE_SLOT))?.score).toBe(999)
  })

  it('keeps different slots independent', async () => {
    await writeSave('slot-a', { ...SAMPLE, score: 1 })
    await writeSave('slot-b', { ...SAMPLE, score: 2 })
    expect((await readSave('slot-a'))?.score).toBe(1)
    expect((await readSave('slot-b'))?.score).toBe(2)
  })
})

describe('deleteSave', () => {
  it('removes a slot so hasSave returns false', async () => {
    await writeSave(AUTOSAVE_SLOT, SAMPLE)
    await deleteSave(AUTOSAVE_SLOT)
    expect(await hasSave(AUTOSAVE_SLOT)).toBe(false)
  })

  it('is a no-op for a slot that does not exist', async () => {
    await expect(deleteSave('ghost-slot')).resolves.toBeUndefined()
  })
})

describe('hasSave', () => {
  it('returns false before any write', async () => {
    expect(await hasSave(AUTOSAVE_SLOT)).toBe(false)
  })

  it('returns true after a write', async () => {
    await writeSave(AUTOSAVE_SLOT, SAMPLE)
    expect(await hasSave(AUTOSAVE_SLOT)).toBe(true)
  })
})
