import { describe, expect, it } from 'vitest'
import { isSaveData, migrate, parseSaveData } from './schema'
import { SAVE_VERSION, type SaveData } from './types'
import { createInventory } from '../economy'
import { FACTION_IDS } from '../faction'

const valid: SaveData = {
  version: SAVE_VERSION,
  transform: { position: { x: 0, y: 1, z: 2 }, rotationY: 0.5 },
  health: { current: 80, max: 100 },
  zoneId: 'forest',
  inventory: { counts: { gold: 5 }, equippedItemId: null },
  playerFactionId: FACTION_IDS.ForestElves,
  savedAt: 42,
}

// A v1 save predates the `inventory` field (E3.4 / v2) and the `playerFactionId`
// field (E4.2 / v3). Used to prove forward migration fills both rather than
// dropping the save.
const v1Save = {
  version: 1,
  transform: { position: { x: 3, y: 1, z: -4 }, rotationY: 0 },
  health: { current: 50, max: 100 },
  zoneId: 'forest',
  savedAt: 7,
} as unknown as SaveData

// A v2 save has an inventory but predates `playerFactionId` (E4.2 / v3).
const v2Save = {
  version: 2,
  transform: { position: { x: 1, y: 1, z: 1 }, rotationY: 0 },
  health: { current: 60, max: 100 },
  zoneId: 'forest',
  inventory: { counts: { blade: 1 }, equippedItemId: 'blade' },
  savedAt: 9,
} as unknown as SaveData

describe('isSaveData', () => {
  it('accepts a well-formed record', () => {
    expect(isSaveData(valid)).toBe(true)
  })

  // playerFactionId (v3) is not required by the guard so older saves still pass
  // and get upgraded by migrate.
  it('accepts a record missing the v3 faction field (pre-migration)', () => {
    expect(isSaveData(v2Save)).toBe(true)
  })

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['missing transform', { ...valid, transform: undefined }],
    ['missing health', { ...valid, health: undefined }],
    ['bare-number health (pre-structured)', { ...valid, health: 100 }],
    ['health missing max', { ...valid, health: { current: 80 } }],
    ['non-finite position', { ...valid, transform: { position: { x: NaN, y: 0, z: 0 }, rotationY: 0 } }],
    ['missing zoneId', { ...valid, zoneId: undefined }],
    ['missing savedAt', { ...valid, savedAt: undefined }],
  ])('rejects %s', (_label, input) => {
    expect(isSaveData(input)).toBe(false)
  })
})

describe('parseSaveData', () => {
  it('returns the record for valid input', () => {
    expect(parseSaveData(valid)).toEqual(valid)
  })

  it('returns null for invalid input', () => {
    expect(parseSaveData({ garbage: true })).toBeNull()
  })
})

describe('migrate', () => {
  it('passes through a current-version record unchanged', () => {
    expect(migrate(valid)).toBe(valid)
  })

  it('stamps an unknown version up to the current one', () => {
    const old = { ...valid, version: 0 }
    expect(migrate(old).version).toBe(SAVE_VERSION)
  })

  it('migrates a v1 save forward with an empty inventory and neutral faction', () => {
    const migrated = migrate(v1Save)
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.inventory).toEqual(createInventory())
    expect(migrated.playerFactionId).toBe(FACTION_IDS.Neutral)
    // Pre-existing fields are carried through untouched.
    expect(migrated.transform).toEqual(v1Save.transform)
    expect(migrated.health).toEqual(v1Save.health)
    expect(migrated.zoneId).toBe('forest')
  })

  it('keeps an existing inventory when stamping an old version forward', () => {
    const old = { ...valid, version: 1, inventory: { counts: { blade: 1 }, equippedItemId: 'blade' } }
    expect(migrate(old).inventory).toEqual({ counts: { blade: 1 }, equippedItemId: 'blade' })
  })

  it('migrates a v2 save forward to a neutral faction (v2 → v3)', () => {
    const migrated = migrate(v2Save)
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.playerFactionId).toBe(FACTION_IDS.Neutral)
    // The v2 inventory is preserved unchanged.
    expect(migrated.inventory).toEqual({ counts: { blade: 1 }, equippedItemId: 'blade' })
  })

  it('trusts a valid persisted faction when stamping an old version forward', () => {
    const old = { ...v2Save, playerFactionId: FACTION_IDS.Villain } as unknown as SaveData
    expect(migrate(old).playerFactionId).toBe(FACTION_IDS.Villain)
  })

  it('coerces an unrecognised persisted faction to neutral', () => {
    const old = { ...v2Save, playerFactionId: 'goblins' } as unknown as SaveData
    expect(migrate(old).playerFactionId).toBe(FACTION_IDS.Neutral)
  })
})

describe('parseSaveData old-version round-trips', () => {
  it('loads a pre-inventory save and upgrades it to the current schema (v1)', () => {
    const parsed = parseSaveData(v1Save)
    expect(parsed).not.toBeNull()
    expect(parsed?.version).toBe(SAVE_VERSION)
    expect(parsed?.inventory).toEqual(createInventory())
    expect(parsed?.playerFactionId).toBe(FACTION_IDS.Neutral)
  })

  it('loads a pre-faction save and upgrades it to the current schema (v2)', () => {
    const parsed = parseSaveData(v2Save)
    expect(parsed).not.toBeNull()
    expect(parsed?.version).toBe(SAVE_VERSION)
    expect(parsed?.playerFactionId).toBe(FACTION_IDS.Neutral)
  })
})
