/**
 * Pure data model for persistent enemy corpses (E2.4 / FLO-315).
 *
 * A `CorpseField` is an immutable, ordered collection of `CorpseRecord`s with a
 * fixed retention cap. When the cap is exceeded the OLDEST corpses are evicted
 * first (FIFO) — this is the "retention-as-a-first-class-feature" policy: the
 * battlefield keeps the most recent kills and quietly reclaims stale ones so the
 * mesh count (and therefore the frame budget) can never grow unbounded.
 *
 * Everything here is engine-agnostic and side-effect-free, so the cap/cleanup
 * policy is unit-testable without a GL context. The Babylon side
 * (`src/scenes/corpseManager.ts`) consumes `evicted` to dispose the matching
 * meshes.
 */
import type { Vec3 } from '../combat'

export interface CorpseRecord {
  /** Stable id used to key the corpse's mesh on the Babylon side. */
  readonly id: string
  /** Zone the corpse belongs to; corpses only re-spawn in their own zone. */
  readonly zoneId: string
  /** World position where the enemy fell. */
  readonly position: Vec3
  /** Yaw (radians) the enemy faced when it died — keeps the body oriented. */
  readonly rotationY: number
}

/**
 * Max corpses retained across the session (all zones share one budget). Sized
 * for the low-poly soldier GLB (~2.8k tris): 32 downed bodies is well within the
 * frame budget while still reading as a real battlefield. Oldest evicted first.
 */
export const DEFAULT_CORPSE_CAP = 32

export interface CorpseField {
  readonly cap: number
  readonly corpses: readonly CorpseRecord[]
}

export interface AddCorpseResult {
  readonly field: CorpseField
  /** Records dropped to honour the cap (oldest first). Caller disposes meshes. */
  readonly evicted: readonly CorpseRecord[]
}

export function createCorpseField(cap: number = DEFAULT_CORPSE_CAP): CorpseField {
  return { cap: Math.max(0, Math.floor(cap)), corpses: [] }
}

/**
 * Append a corpse, evicting the oldest records when over the cap. Returns the
 * new field plus the evicted records (in oldest-first order). With `cap === 0`
 * the corpse is immediately evicted — a valid "no corpses" configuration.
 */
export function addCorpse(field: CorpseField, corpse: CorpseRecord): AddCorpseResult {
  const next = [...field.corpses, corpse]
  const overflow = next.length - field.cap
  if (overflow <= 0) {
    return { field: { ...field, corpses: next }, evicted: [] }
  }
  return {
    field: { ...field, corpses: next.slice(overflow) },
    evicted: next.slice(0, overflow),
  }
}

/** All retained corpses for a given zone, oldest first. */
export function corpsesForZone(field: CorpseField, zoneId: string): CorpseRecord[] {
  return field.corpses.filter((c) => c.zoneId === zoneId)
}
