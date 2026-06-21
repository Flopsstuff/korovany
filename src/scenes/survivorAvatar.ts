import {
  type AbstractMesh,
  Color3,
  type Mesh,
  PBRMaterial,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { AnimatableNode } from '../game/animation/proceduralAnimator'
import { type LoadedModel, loadModel } from './modelLoader'

/**
 * Player visual (FLO-443): the flat-albedo v1.2 survivor GLB
 * (`korovany_hero_player-default.glb`, re-authored in FLO-440 — 2,884 tris,
 * 1× 1024 flat base-color) mounted on the controller capsule and **faceted
 * in-engine**. Supersedes the procedural box fighter (FLO-422 / `playerAvatar`).
 *
 * Mount is **fire-and-forget**, mirroring the in-repo precedent
 * (`soldierEnemy.ts` / `archerEnemy.ts`): the scene factory stays synchronous and
 * gameplay always runs on the invisible capsule from frame 0, so the deferred
 * `animator.node` assignment is safe. The visual mesh pops in (~200 ms) once the
 * GLB resolves; the capsule is the fallback if the fetch fails (headless tests
 * pass `heroUrl: null` and never reach here). A cheap placeholder box could be
 * added later if the pop-in ever matters — it currently does not.
 *
 * The hard-edge faceting only exists once `convertToFlatShadedMesh()` runs at
 * runtime (ref `worldBounds.ts` `applyFacetTint`), so the visual-truth gate is
 * the in-scene screenshot, never code inspection.
 */

/** The slice of `CharacterController` this module needs to mount the avatar. */
export interface AvatarMount {
  /** The (invisible) capsule the visual root parents under. */
  readonly mesh: Mesh
  /** Procedural animator whose `node` drives bob/lean/lunge/topple. */
  readonly animator: { node: AnimatableNode | null }
}

/** Capsule-foot offset for the 1.8 m capsule, matching the old box-avatar wiring. */
const CAPSULE_FOOT_OFFSET = new Vector3(0, -0.9, 0)

/**
 * Facet + matte + parent the loaded survivor meshes onto the capsule and hand the
 * visual root to the animator. Split out from the async load so it is unit-testable
 * under a headless `NullEngine` without a real GLB fetch.
 */
export function wireSurvivorAvatar(mount: AvatarMount, model: LoadedModel): void {
  for (const mesh of model.meshes) {
    // Hard facets — the silhouette must read flat-shaded, not smooth, or the
    // FLO-440 low-poly re-author is defeated. Only geometry meshes have vertices;
    // the glTF `__root__` pivot has none and must be skipped.
    if (mesh.getTotalVertices() > 0) (mesh as Mesh).convertToFlatShadedMesh()
    mesh.isPickable = false
    flattenMaterial(mesh)
  }
  model.root.parent = mount.mesh
  model.root.position = CAPSULE_FOOT_OFFSET.clone()
  mount.mesh.isVisible = false // hide the capsule placeholder once the visual mounts
  mount.animator.node = model.root as unknown as AnimatableNode
}

/**
 * Tame the imported material to a matte, near-zero-specular read so it stays in
 * the v1.2 flat low-poly band even if the GLB ships a glossier material than the
 * baked flat albedo. Defensive across both material types the glTF loader may emit.
 */
function flattenMaterial(mesh: AbstractMesh): void {
  const mat = mesh.material
  if (mat instanceof StandardMaterial) {
    mat.specularColor = new Color3(0.03, 0.03, 0.03)
  } else if (mat instanceof PBRMaterial) {
    mat.metallic = 0
    mat.roughness = 1
    mat.environmentIntensity = 0
  }
}

/**
 * Fire-and-forget: load the survivor GLB and wire it onto the capsule. Safe to
 * call from a synchronous scene factory; a failed fetch keeps the capsule
 * placeholder visible (and tests pass `heroUrl: null` to skip the call entirely).
 */
export function mountSurvivorAvatar(scene: Scene, mount: AvatarMount, heroUrl: string): void {
  void loadModel(scene, heroUrl, { targetSize: 1.8, groundIt: true })
    .then((model) => wireSurvivorAvatar(mount, model))
    .catch(() => {
      /* keep the capsule placeholder visible */
    })
}
