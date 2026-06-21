import { openSaveStore } from './db'
import { DEFAULT_SLOT, SAVE_VERSION, type PlayerSnapshot, type SaveData, type SlotId } from './types'

/**
 * Public save/load API.
 *
 * High-level helpers that open a {@link openSaveStore} connection, do one
 * operation, and close it — convenient for the React/UI layer which saves and
 * loads infrequently (autosave-on-pause, Continue). All of them accept an
 * injectable {@link IDBFactory} and clock so they run headless in tests.
 *
 * For chatty access (multiple ops against one open connection), use
 * `openSaveStore` directly.
 */

export {
  SAVE_VERSION,
  DEFAULT_SLOT,
  type SaveData,
  type SlotId,
  type PlayerSnapshot,
  type PlayerTransform,
  type Vec3,
} from './types'
export { openSaveStore, type SaveStore, type SlotRecord } from './db'
export { parseSaveData, isSaveData, migrate } from './schema'

/** Common options for the convenience helpers. */
export interface SaveOptions {
  /** IndexedDB factory; defaults to `globalThis.indexedDB`. Inject in tests. */
  factory?: IDBFactory
  /** Slot to operate on. Defaults to {@link DEFAULT_SLOT} (autosave). */
  slot?: SlotId
}

/** Stamp a live player snapshot into a current-version {@link SaveData}. */
export function createSaveData(snapshot: PlayerSnapshot, savedAt: number): SaveData {
  return {
    version: SAVE_VERSION,
    transform: snapshot.transform,
    health: { current: snapshot.health.current, max: snapshot.health.max },
    zoneId: snapshot.zoneId,
    inventory: {
      counts: { ...snapshot.inventory.counts },
      equippedItemId: snapshot.inventory.equippedItemId,
    },
    playerFactionId: snapshot.playerFactionId,
    progression: {
      level: snapshot.progression.level,
      xp: snapshot.progression.xp,
      nextLevelXp: snapshot.progression.nextLevelXp,
      stats: {
        strength: { ...snapshot.progression.stats.strength },
        agility: { ...snapshot.progression.stats.agility },
        endurance: { ...snapshot.progression.stats.endurance },
      },
      skills: {
        melee: { ...snapshot.progression.skills.melee },
        trade: { ...snapshot.progression.skills.trade },
        survival: { ...snapshot.progression.skills.survival },
      },
    },
    injury: {
      leftHand: snapshot.injury.leftHand,
      rightHand: snapshot.injury.rightHand,
      leftEye: snapshot.injury.leftEye,
      rightEye: snapshot.injury.rightEye,
      leftLeg: snapshot.injury.leftLeg,
      rightLeg: snapshot.injury.rightLeg,
      bleeding: snapshot.injury.bleeding,
      bleedElapsed: snapshot.injury.bleedElapsed,
    },
    savedAt,
  }
}

/** Serialise and persist a snapshot to a slot (default: autosave slot). */
export async function saveGame(
  snapshot: PlayerSnapshot,
  savedAt: number,
  options: SaveOptions = {},
): Promise<void> {
  const store = await openSaveStore(options.factory)
  try {
    await store.put(options.slot ?? DEFAULT_SLOT, createSaveData(snapshot, savedAt))
  } finally {
    store.close()
  }
}

/** Load the most recently saved slot, or `null` if no save exists. */
export async function loadLatest(options: Pick<SaveOptions, 'factory'> = {}): Promise<SaveData | null> {
  const store = await openSaveStore(options.factory)
  try {
    const record = await store.latest()
    return record?.data ?? null
  } finally {
    store.close()
  }
}

/** Whether any save slot exists — drives the Continue button's enabled state. */
export async function hasSave(options: Pick<SaveOptions, 'factory'> = {}): Promise<boolean> {
  const store = await openSaveStore(options.factory)
  try {
    return (await store.latest()) !== null
  } finally {
    store.close()
  }
}

/** Clear a slot (default: autosave slot). */
export async function clearSave(options: SaveOptions = {}): Promise<void> {
  const store = await openSaveStore(options.factory)
  try {
    await store.delete(options.slot ?? DEFAULT_SLOT)
  } finally {
    store.close()
  }
}
