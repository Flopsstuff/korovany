import type { Scene, TransformNode } from '@babylonjs/core'
import type { AssetStreamLoader } from './loader'
import { createPlaceholderBox } from './placeholder'

export interface StreamedInstance {
  /** Scene root — placeholder box until load resolves, then the model root. */
  root: TransformNode
  /** Drop ref-count; call when the instance is removed from the scene. */
  release: () => void
}

/**
 * Spawn a streamed asset: placeholder immediately, swap to the GLB on success.
 * On load error the placeholder stays (graceful fallback, no throw to caller).
 */
export async function spawnStreamedInstance(
  loader: AssetStreamLoader,
  scene: Scene,
  assetId: string,
): Promise<StreamedInstance> {
  const placeholder = createPlaceholderBox(scene, assetId)
  let released = false

  try {
    const model = await loader.acquire(assetId)
    if (released) {
      loader.release(assetId)
      placeholder.dispose()
      return { root: model.root, release: () => loader.release(assetId) }
    }
    placeholder.dispose()
    return {
      root: model.root,
      release: () => {
        if (released) return
        released = true
        loader.release(assetId)
      },
    }
  } catch {
    return {
      root: placeholder,
      release: () => {
        if (released) return
        released = true
        placeholder.dispose()
      },
    }
  }
}
