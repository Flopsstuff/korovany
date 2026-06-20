import type { Scene } from '@babylonjs/core'
import type { LoadedModel } from '../../scenes/modelLoader'
import type { AssetRegistry } from './registry'
import type { AssetLoadPhase, AssetMetadata } from './types'

/** Injectable GLB fetch — defaults to `loadModel` in production, stubbed in tests. */
export type LoadGlbFn = (
  scene: Scene,
  url: string,
  metadata: AssetMetadata,
) => Promise<LoadedModel>

export type AssetLoadingStateListener = (id: string, phase: AssetLoadPhase) => void

interface CacheEntry {
  model: LoadedModel
  refCount: number
}

/**
 * Lazy GLB loader with in-memory cache and reference counting.
 *
 * - First `acquire(id)` triggers a single load; concurrent callers share the promise.
 * - Repeat `acquire` on a cached id bumps ref-count without re-fetching.
 * - `release` decrements; at zero the meshes/materials are disposed.
 */
export class AssetStreamLoader {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly inflight = new Map<string, Promise<LoadedModel>>()
  private readonly phases = new Map<string, AssetLoadPhase>()

  constructor(
    private readonly scene: Scene,
    private readonly registry: AssetRegistry,
    private readonly loadGlb: LoadGlbFn,
    private readonly onLoadingState?: AssetLoadingStateListener,
  ) {}

  getPhase(id: string): AssetLoadPhase {
    return this.phases.get(id) ?? 'idle'
  }

  async acquire(id: string): Promise<LoadedModel> {
    const cached = this.cache.get(id)
    if (cached) {
      cached.refCount += 1
      return cached.model
    }

    const pending = this.inflight.get(id)
    if (pending) {
      const model = await pending
      const entry = this.cache.get(id)
      if (entry) entry.refCount += 1
      return model
    }

    const record = this.registry.resolve(id)
    this.setPhase(id, 'loading')

    const promise = this.loadGlb(this.scene, record.url, record.metadata)
      .then((model) => {
        this.inflight.delete(id)
        this.cache.set(id, { model, refCount: 1 })
        this.setPhase(id, 'loaded')
        return model
      })
      .catch((err: unknown) => {
        this.inflight.delete(id)
        this.setPhase(id, 'error')
        throw err
      })

    this.inflight.set(id, promise)
    return promise
  }

  release(id: string): void {
    const entry = this.cache.get(id)
    if (!entry) return

    entry.refCount -= 1
    if (entry.refCount > 0) return

    for (const mesh of entry.model.meshes) {
      mesh.dispose(false, true)
    }
    entry.model.root.dispose()
    this.cache.delete(id)
    this.setPhase(id, 'idle')
  }

  private setPhase(id: string, phase: AssetLoadPhase): void {
    this.phases.set(id, phase)
    this.onLoadingState?.(id, phase)
  }
}
