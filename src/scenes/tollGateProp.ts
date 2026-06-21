import { TransformNode, Vector3, type Scene } from '@babylonjs/core'
import { flatShade } from '../game/util'
import { getZoneContent } from '../game/world'

/** FLO-373 Empire toll gate mesh — web-ready GLB shipped in /public/models. */
export const DEFAULT_TOLL_GATE_GLB = '/models/toll-gate.glb'

/** Normalized longest extent for the road-spanning prop (assets.md ≈ 2.0 units). */
export const TOLL_GATE_TARGET_SIZE = 2

export interface TollGateProp {
  readonly root: TransformNode
  dispose(): void
}

/**
 * Spawn the Empire toll gate landmark on the Salt Road at the `toll-gate` entry
 * in `zoneContent` (FLO-478). Best-effort GLB fetch; the placement root remains
 * even when the model cannot load (headless tests pass `glbUrl: null`).
 */
export function spawnTollGateProp(
  scene: Scene,
  glbUrl: string | null = DEFAULT_TOLL_GATE_GLB,
): TollGateProp {
  const landmark = getZoneContent('human-lands').landmarks.find((lm) => lm.id === 'toll-gate')
  if (!landmark) {
    throw new Error('human-lands zone content is missing the toll-gate landmark')
  }

  const root = new TransformNode('landmark:toll-gate', scene)
  root.position = new Vector3(landmark.position.x, 0, landmark.position.z)

  if (glbUrl) {
    void import('./modelLoader')
      .then(({ loadModel }) =>
        loadModel(scene, glbUrl, {
          targetSize: TOLL_GATE_TARGET_SIZE,
          groundIt: true,
        }).then((model) => {
          flatShade(model.meshes)
          model.root.parent = root
          for (const mesh of model.meshes) mesh.isPickable = false
        }),
      )
      .catch(() => {
        /* keep the empty placement root */
      })
  }

  return {
    root,
    dispose() {
      root.dispose(false, true)
    },
  }
}
