import type { HealthState } from '../health'
import { createInventory, isInventoryState } from '../economy'
import { DEFAULT_PLAYER_FACTION_ID, isFactionId } from '../faction'
import { SAVE_VERSION, type PlayerTransform, type SaveData, type Vec3 } from './types'

/**
 * Validation and forward-migration for the save schema.
 *
 * `parseSaveData` is the only sanctioned way to turn an untrusted blob (read
 * back from IndexedDB) into a {@link SaveData}. It rejects anything malformed and
 * runs older versions through {@link migrate} so callers always receive a record
 * at the current {@link SAVE_VERSION}. Returning `null` (rather than throwing) on
 * bad input keeps the empty-store / corrupt-save paths simple for callers.
 */

function isVec3(value: unknown): value is Vec3 {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.z === 'number' &&
    Number.isFinite(v.x) &&
    Number.isFinite(v.y) &&
    Number.isFinite(v.z)
  )
}

function isTransform(value: unknown): value is PlayerTransform {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return isVec3(t.position) && typeof t.rotationY === 'number' && Number.isFinite(t.rotationY)
}

function isHealth(value: unknown): value is HealthState {
  if (typeof value !== 'object' || value === null) return false
  const h = value as Record<string, unknown>
  return (
    typeof h.current === 'number' &&
    typeof h.max === 'number' &&
    Number.isFinite(h.current) &&
    Number.isFinite(h.max)
  )
}

/**
 * Structural guard for a loadable save record. Validates the fields present in
 * every version since v1 (the migration baseline). Fields added in later
 * versions — `inventory` (v2), `playerFactionId` (v3) — are intentionally *not*
 * required here so older saves still pass the guard and get upgraded by
 * {@link migrate}; migrate is the single place that fills them in.
 */
export function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  return (
    typeof d.version === 'number' &&
    isTransform(d.transform) &&
    isHealth(d.health) &&
    typeof d.zoneId === 'string' &&
    typeof d.savedAt === 'number'
  )
}

/**
 * Map an older record onto the current schema. Each schema bump adds a step that
 * fills in / renames-forward the new fields; never mutate the input — return a
 * fresh record stamped with the current version.
 *
 * - v1 → v2: `inventory` was added (E3.4). Saves written before v2 carry none,
 *   so they are given a fresh empty inventory. Schema is forever — the field is
 *   never dropped again.
 * - v2 → v3: `playerFactionId` was added (E4.2). Saves written before v3 carry
 *   none, so they default to the neutral (unaffiliated) faction; an unrecognised
 *   id is also coerced to neutral rather than trusted.
 */
export function migrate(data: SaveData): SaveData {
  if (data.version === SAVE_VERSION) return data
  const inventory = isInventoryState((data as { inventory?: unknown }).inventory)
    ? data.inventory
    : createInventory()
  const persistedFaction = (data as { playerFactionId?: unknown }).playerFactionId
  const playerFactionId = isFactionId(persistedFaction)
    ? persistedFaction
    : DEFAULT_PLAYER_FACTION_ID
  return { ...data, inventory, playerFactionId, version: SAVE_VERSION }
}

/**
 * Validate and migrate an untrusted blob into a current-version {@link SaveData},
 * or `null` if it is not a recognisable save (missing fields, wrong types, etc.).
 */
export function parseSaveData(value: unknown): SaveData | null {
  if (!isSaveData(value)) return null
  return migrate(value)
}
