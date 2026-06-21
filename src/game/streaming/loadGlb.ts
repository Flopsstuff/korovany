import type { Scene } from '@babylonjs/core'
import { loadModel, type LoadedModel } from '../../scenes/modelLoader'
import { flatShade } from '../util'
import type { LoadGlbFn } from './loader'
import type { AssetMetadata } from './types'

/** Default `LoadGlbFn` — delegates to the shared `loadModel` normalizer. */
export const defaultLoadGlb: LoadGlbFn = (
  scene: Scene,
  url: string,
  metadata: AssetMetadata,
): Promise<LoadedModel> =>
  loadModel(scene, url, {
    targetSize: metadata.targetSize,
    groundIt: metadata.groundIt,
    yaw: metadata.yaw,
  }).then((model) => {
    flatShade(model.meshes)
    return model
  })
