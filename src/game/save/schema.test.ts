import { describe, expect, it } from 'vitest'
import { isSaveData, migrate, parseSaveData } from './schema'
import { SAVE_VERSION, type SaveData } from './types'
import { createInventory } from '../economy'
import { createInjuryState, severLimb } from '../health'
import { FACTION_IDS } from '../faction'
import { createProgression } from '../progression'

const valid: SaveData = {
  version: SAVE_VERSION,
  transform: { position: { x: 0, y: 1, z: 2 }, rotationY: 0.5 },
  health: { current: 80, max: 100 },
  zoneId: 'forest',
  inventory: { counts: { gold: 5 }, equippedItemId: null },
  playerFactionId: FACTION_IDS.ForestElves,
  progression: createProgression(),
  injury: createInjuryState(),
  savedAt: 42,
}

// A v1 save predates the `inventory` field (E3.4 / v2), the `playerFactionId`
// field (E4.2 / v3), and the `progression` field (E4.5 / v4). Used to prove
// forward migration fills all three rather than dropping the save.
const v1Save = {
  version: 1,
  transform: { position: { x: 3, y: 1, z: -4 }, rotationY: 0 },
  health: { current: 50, max: 100 },
  zoneId: 'forest',
  savedAt: 7,
} as unknown as SaveData

// A v2 save has an inventory but predates `playerFactionId` (v3) and
// `progression` (v4).
const v2Save = {
  version: 2,
  transform: { position: { x: 1, y: 1, z: 1 }, rotationY: 0 },
  health: { current: 60, max: 100 },
  zoneId: 'forest',
  inventory: { counts: { blade: 1 }, equippedItemId: 'blade' },
  savedAt: 9,
} as unknown as SaveData

// A v4 save has progression but predates `injury` (v5).
const v4Save = {
  version: 4,
  transform: { position: { x: 2, y: 1, z: 0 }, rotationY: 0.25 },
  health: { current: 70, max: 100 },
  zoneId: 'forest',
  inventory: { counts: {}, equippedItemId: null },
  playerFactionId: FACTION_IDS.Empire,
  progression: createProgression(),
  savedAt: 11,
} as unknown as SaveData

describe('isSaveData', () => {
  it('accepts a well-formed record', () => {
    expect(isSaveData(valid)).toBe(true)
  })

  // playerFactionId (v3), progression (v4), and injury (v5) are not required by
  // the guard so older saves still pass and get upgraded by migrate.
  it('accepts a record missing the later fields (pre-migration)', () => {
    expect(isSaveData(v2Save)).toBe(true)
    expect(isSaveData(v4Save)).toBe(true)
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

  it('repairs a malformed current-version record with baseline progression', () => {
    const malformed = { ...valid, progression: undefined } as unknown as SaveData
    expect(migrate(malformed).progression).toEqual(createProgression())
  })

  it('repairs a malformed current-version record with baseline injury', () => {
    const malformed = { ...valid, injury: undefined } as unknown as SaveData
    expect(migrate(malformed).injury).toEqual(createInjuryState())
  })

  it('stamps an unknown version up to the current one', () => {
    const old = { ...valid, version: 0 }
    expect(migrate(old).version).toBe(SAVE_VERSION)
  })

  it('migrates a v1 save forward with empty inventory, neutral faction, baseline progression and injury', () => {
    const migrated = migrate(v1Save)
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.inventory).toEqual(createInventory())
    expect(migrated.playerFactionId).toBe(FACTION_IDS.Neutral)
    expect(migrated.progression).toEqual(createProgression())
    expect(migrated.injury).toEqual(createInjuryState())
    // Pre-existing fields are carried through untouched.
    expect(migrated.transform).toEqual(v1Save.transform)
    expect(migrated.health).toEqual(v1Save.health)
    expect(migrated.zoneId).toBe('forest')
  })

  it('keeps an existing inventory when stamping an old version forward', () => {
    const old = { ...valid, version: 1, inventory: { counts: { blade: 1 }, equippedItemId: 'blade' } }
    expect(migrate(old).inventory).toEqual({ counts: { blade: 1 }, equippedItemId: 'blade' })
  })

  it('migrates a v2 save forward to a neutral faction and baseline progression', () => {
    const migrated = migrate(v2Save)
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.playerFactionId).toBe(FACTION_IDS.Neutral)
    expect(migrated.progression).toEqual(createProgression())
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

  it('keeps existing progression when stamping an old version forward', () => {
    const progressed = {
      ...createProgression(),
      xp: 100,
      level: 2,
      nextLevelXp: 200,
    }
    const old = { ...valid, version: 3, progression: progressed }
    expect(migrate(old).progression).toEqual(progressed)
  })

  it('migrates a v4 save forward with baseline injury', () => {
    const migrated = migrate(v4Save)
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.injury).toEqual(createInjuryState())
    expect(migrated.progression).toEqual(createProgression())
  })

  it('keeps existing injury when stamping an old version forward', () => {
    const wounded = severLimb(createInjuryState(), 'leftHand')
    const old = { ...valid, version: 4, injury: wounded }
    expect(migrate(old).injury).toEqual(wounded)
  })
})

describe('parseSaveData old-version round-trips', () => {
  it('loads a pre-inventory save and upgrades it to the current schema (v1)', () => {
    const parsed = parseSaveData(v1Save)
    expect(parsed).not.toBeNull()
    expect(parsed?.version).toBe(SAVE_VERSION)
    expect(parsed?.inventory).toEqual(createInventory())
    expect(parsed?.playerFactionId).toBe(FACTION_IDS.Neutral)
    expect(parsed?.progression).toEqual(createProgression())
    expect(parsed?.injury).toEqual(createInjuryState())
  })

  it('loads a pre-faction save and upgrades it to the current schema (v2)', () => {
    const parsed = parseSaveData(v2Save)
    expect(parsed).not.toBeNull()
    expect(parsed?.version).toBe(SAVE_VERSION)
    expect(parsed?.playerFactionId).toBe(FACTION_IDS.Neutral)
    expect(parsed?.progression).toEqual(createProgression())
    expect(parsed?.injury).toEqual(createInjuryState())
  })

  it('loads a pre-injury save and upgrades it to the current schema (v4)', () => {
    const parsed = parseSaveData(v4Save)
    expect(parsed).not.toBeNull()
    expect(parsed?.version).toBe(SAVE_VERSION)
    expect(parsed?.injury).toEqual(createInjuryState())
  })
})
