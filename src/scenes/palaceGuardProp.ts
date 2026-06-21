import { TransformNode, Vector3, type Scene } from '@babylonjs/core'
import { flatShade } from '../game/util'

/** FLO-426 ceremonial guard mesh — web-ready GLB shipped in /public/models. */
export const DEFAULT_PALACE_GUARD_GLB = '/models/empire-palace-guard.glb'

export interface PalaceGuardPropSpec {
  /** Stable identifier within the zone (kebab-case). */
  readonly id: string
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  /** Yaw in radians; defaults to 0. */
  readonly yaw?: number
}

/**
 * Two static ceremonial guards flanking the Empire toll gate on the Salt Road.
 * Seeded from the toll-gate landmark in `zoneContent` (FLO-471).
 */
export const HUMAN_LANDS_PALACE_GUARD_SPECS: readonly PalaceGuardPropSpec[] = [
  { id: 'palace-guard-toll-left', position: { x: -10, y: 0, z: -10 }, yaw: Math.PI / 4 },
  { id: 'palace-guard-toll-right', position: { x: -14, y: 0, z: -6 }, yaw: -Math.PI / 3 },
]

export interface PalaceGuardProp {
  readonly id: string
  readonly root: TransformNode
  dispose(): void
}

/**
 * Spawn static palace-guard decor props — no AI, no combat registration.
 * Best-effort GLB fetch; placement roots remain even when the model cannot load
 * (headless tests pass `glbUrl: null`).
 */
export function spawnPalaceGuardProps(
  scene: Scene,
  specs: readonly PalaceGuardPropSpec[] = HUMAN_LANDS_PALACE_GUARD_SPECS,
  glbUrl: string | null = DEFAULT_PALACE_GUARD_GLB,
): PalaceGuardProp[] {
  return specs.map((spec) => {
    const root = new TransformNode(`palace-guard:${spec.id}`, scene)
    root.position = new Vector3(spec.position.x, spec.position.y, spec.position.z)
    root.rotation.y = spec.yaw ?? 0

    if (glbUrl) {
      void import('./modelLoader')
        .then(({ loadModel }) =>
          loadModel(scene, glbUrl, { targetSize: 1.8, groundIt: true, yaw: 0 }).then((model) => {
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
      id: spec.id,
      root,
      dispose() {
        root.dispose(false, true)
      },
    }
  })
}
