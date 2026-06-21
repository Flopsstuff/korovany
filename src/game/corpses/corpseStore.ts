/**
 * Session-scoped corpse store (E2.4 / FLO-315).
 *
 * Wraps a `CorpseField` in a small mutable holder so corpses survive a zone
 * re-enter WITHIN a session: the forest scene is torn down and rebuilt on every
 * zone transition, but this store lives at module scope, so the rebuilt scene
 * re-spawns the corpses recorded before it left.
 *
 * Persistence boundary (documented decision): corpses are deliberately NOT
 * written to the IndexedDB save (FLO-296). Full persistence across a page
 * reload is out of scope for this slice — it would mean a schema migration on
 * the save format for a cosmetic, capped, in-session feature. The store resets
 * to empty on reload; this is intentional, not a bug.
 */
import {
  addCorpse,
  type CorpseRecord,
  corpsesForZone,
  createCorpseField,
  DEFAULT_CORPSE_CAP,
  type CorpseField,
} from './corpseModel'
import type { Vec3 } from '../combat'

export interface RecordCorpseResult {
  readonly corpse: CorpseRecord
  /** Records evicted to honour the cap; caller disposes their meshes. */
  readonly evicted: readonly CorpseRecord[]
}

export class CorpseStore {
  private field: CorpseField
  private seq = 0

  constructor(cap: number = DEFAULT_CORPSE_CAP) {
    this.field = createCorpseField(cap)
  }

  /**
   * Record a fresh corpse; returns it plus any evicted by the cap. `glbUrl`
   * overrides the corpse's mounted model (FLO-432) — omit it to fall back to the
   * CorpseManager's default GLB.
   */
  record(
    zoneId: string,
    position: Vec3,
    rotationY: number,
    glbUrl?: string,
  ): RecordCorpseResult {
    const corpse: CorpseRecord = {
      id: `corpse-${this.seq++}`,
      zoneId,
      position: { x: position.x, y: position.y, z: position.z },
      rotationY,
      ...(glbUrl !== undefined ? { glbUrl } : {}),
    }
    const { field, evicted } = addCorpse(this.field, corpse)
    this.field = field
    return { corpse, evicted }
  }

  /** Corpses retained for a zone (oldest first) — used to re-spawn on re-enter. */
  forZone(zoneId: string): CorpseRecord[] {
    return corpsesForZone(this.field, zoneId)
  }

  get cap(): number {
    return this.field.cap
  }

  get size(): number {
    return this.field.corpses.length
  }

  /** Drop all corpses — for tests and a future "new game" reset. */
  reset(): void {
    this.field = createCorpseField(this.field.cap)
    this.seq = 0
  }
}

/**
 * The session-wide corpse store. Shared by every forest-scene instance so
 * corpses persist across zone transitions. Tests inject their own `CorpseStore`
 * instead of touching this singleton.
 */
export const sessionCorpseStore = new CorpseStore()
