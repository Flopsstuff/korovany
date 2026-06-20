/**
 * Versioned save schema for player progress.
 *
 * The schema is **forever**: once a field ships it is never renamed or silently
 * repurposed. Evolving the format means bumping {@link SAVE_VERSION} and adding a
 * migration step in `./schema.ts` that maps the old shape onto the new one. This
 * is the "schema is forever" lens — a save written today must still load after
 * the game ships years of updates.
 *
 * Payloads stay deliberately small (a transform + a couple of scalars): the save
 * store is the "one small volume", while assets always stream from elsewhere.
 */

/**
 * Current on-disk schema version. Bump whenever {@link SaveData} changes shape.
 *
 * History:
 * - v1 — transform, health, zoneId, savedAt.
 * - v2 — added `inventory` (E3.4); v1 saves migrate forward with an empty one.
 * - v3 — added `playerFactionId` (E4.2); pre-v3 saves migrate forward as
 *   `neutral` (the unaffiliated default).
 * - v4 — added `progression` (E4.5); older saves migrate with a fresh baseline.
 */
export const SAVE_VERSION = 4

import type { HealthState } from '../health'
import type { InventoryState } from '../economy'
import type { FactionId } from '../faction'
import type { ProgressionState } from '../progression'

/** Plain serialisable 3-vector (Babylon `Vector3` is not JSON-safe). */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Player spawn pose: world position plus the capsule yaw (radians). */
export interface PlayerTransform {
  readonly position: Vec3
  /** Capsule yaw in radians (`mesh.rotation.y`); pitch/roll come from the camera. */
  readonly rotationY: number
}

/**
 * One persisted save record. Every field is required so a loaded save is always
 * complete; defaults are applied when capturing a snapshot, never on read.
 */
export interface SaveData {
  /** Schema version this record was written with. Drives migration on load. */
  readonly version: number
  /** Player capsule transform at save time. */
  readonly transform: PlayerTransform
  /** Player health at save time (current + max), sourced from `healthSlice`. */
  readonly health: HealthState
  /** Identifier of the zone the player was in. */
  readonly zoneId: string
  /** Carried inventory at save time (E3.4), sourced from `inventorySlice`. */
  readonly inventory: InventoryState
  /** Chosen player faction (E4.2), sourced from `factionSlice`. */
  readonly playerFactionId: FactionId
  /** Character progression at save time (E4.5), sourced from `progressionSlice`. */
  readonly progression: ProgressionState
  /** Epoch milliseconds when the snapshot was taken; used to pick the latest slot. */
  readonly savedAt: number
}

/** Save slot identifier. Slot 0 is the autosave slot. */
export type SlotId = number

/** The single autosave slot used by autosave-on-pause and Continue. */
export const DEFAULT_SLOT: SlotId = 0

/** A snapshot of live player state, ready to be serialised into a {@link SaveData}. */
export interface PlayerSnapshot {
  readonly transform: PlayerTransform
  readonly health: HealthState
  readonly zoneId: string
  /** Carried inventory at snapshot time, sourced from `inventorySlice`. */
  readonly inventory: InventoryState
  /** Chosen player faction at snapshot time, sourced from `factionSlice`. */
  readonly playerFactionId: FactionId
  /** Character progression at snapshot time, sourced from `progressionSlice`. */
  readonly progression: ProgressionState
}
