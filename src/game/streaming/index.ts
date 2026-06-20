export { AssetRegistry } from './registry'
export { AssetStreamLoader, type AssetLoadingStateListener, type LoadGlbFn } from './loader'
export { HERO_PLAYER_ASSET_ID, seedDefaultAssets } from './defaults'
export { defaultLoadGlb } from './loadGlb'
export { createPlaceholderBox } from './placeholder'
export { spawnStreamedInstance, type StreamedInstance } from './streamedInstance'
export type { AssetLoadPhase, AssetMetadata, AssetRecord } from './types'

import type { Scene } from '@babylonjs/core'
import { AssetRegistry } from './registry'
import { AssetStreamLoader, type AssetLoadingStateListener } from './loader'
import { seedDefaultAssets } from './defaults'
import { defaultLoadGlb } from './loadGlb'

export interface CreateAssetStreamingOptions {
  onLoadingState?: AssetLoadingStateListener
}

/** Boot a registry + loader pair for a scene (default assets pre-registered). */
export function createAssetStreaming(
  scene: Scene,
  options: CreateAssetStreamingOptions = {},
): { registry: AssetRegistry; loader: AssetStreamLoader } {
  const registry = new AssetRegistry()
  seedDefaultAssets(registry)
  const loader = new AssetStreamLoader(scene, registry, defaultLoadGlb, options.onLoadingState)
  return { registry, loader }
}
