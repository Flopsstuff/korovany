/**
 * IndexedDB-backed save slot store.
 *
 * Browser-only, serverless: all persistence lives here (no backend). The API
 * is deliberately narrow — one slot per key, typed payload, async read/write.
 * Slot keys are strings so callers can use "slot-1", "autosave", etc.
 */

const DB_NAME = 'korovany'
const DB_VERSION = 1
const STORE_NAME = 'saves'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/** Reset the cached db handle — for tests that need a fresh DB per run. */
export function resetDbCache(): void {
  dbPromise = null
}

/** Player position in 3D space. */
export interface PlayerPos {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** The data persisted per save slot. */
export interface SavePayload {
  /** Zone the player was in when saved. */
  readonly zoneId: string
  /** Player position in scene units. */
  readonly playerPos: PlayerPos
  /** Player score at the time of save. */
  readonly score: number
  /** Player current hit points at the time of save. Absent in legacy saves. */
  readonly hp?: number
  /** Wall-clock timestamp of the save (ms since epoch). */
  readonly savedAt: number
}

interface SlotRecord {
  readonly slotKey: string
  readonly payload: SavePayload
}

/** Write (or overwrite) a save slot. */
export async function writeSave(slotKey: string, payload: SavePayload): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put({ slotKey, payload } satisfies SlotRecord)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Read a save slot; returns `null` if the slot does not exist. */
export async function readSave(slotKey: string): Promise<SavePayload | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(slotKey) as IDBRequest<SlotRecord | undefined>
    req.onsuccess = () => resolve(req.result?.payload ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Delete a save slot. No-op if the slot does not exist. */
export async function deleteSave(slotKey: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(slotKey)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Check whether a save slot exists. */
export async function hasSave(slotKey: string): Promise<boolean> {
  const save = await readSave(slotKey)
  return save !== null
}
