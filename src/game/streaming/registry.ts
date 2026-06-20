import type { AssetRecord } from './types'

/**
 * Id → URL (+ metadata) registry. Populated at boot; the stream loader resolves
 * ids here before fetching a GLB.
 */
export class AssetRegistry {
  private readonly entries = new Map<string, AssetRecord>()

  register(id: string, record: AssetRecord): void {
    if (this.entries.has(id)) {
      throw new Error(`Asset id already registered: ${id}`)
    }
    this.entries.set(id, record)
  }

  get(id: string): AssetRecord | undefined {
    return this.entries.get(id)
  }

  /** Throws when `id` was never registered — catches typos early. */
  resolve(id: string): AssetRecord {
    const record = this.entries.get(id)
    if (!record) throw new Error(`Unknown asset id: ${id}`)
    return record
  }
}
