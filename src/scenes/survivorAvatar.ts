import { type Mesh, type Scene, Vector3 } from '@babylonjs/core'
import type { AnimatableNode } from '../game/animation/proceduralAnimator'
import { facetMeshes, mattenMaterial } from '../game/util'
import { type LoadedModel, loadModel } from './modelLoader'

/**
 * Player visual (FLO-443): the flat-albedo v1.2 survivor GLB
 * (`korovany_hero_player-default.glb`, re-authored in FLO-440 — 2,884 tris,
 * 1× 1024 flat base-color) mounted on the controller capsule and **faceted
 * in-engine**. Supersedes the procedural box fighter (FLO-422 / `playerAvatar`).
 *
 * Combat-state swap (FLO-481 / plan step 2 FLO-474): an optional second GLB
 * (`korovany_hero_player-attack.glb`, a drop-in strike-pose twin with the same
 * bbox/scale/identity — FLO-480) is mounted alongside the default. Both roots are
 * parented under the capsule at the same foot offset; the controller funnels its
 * melee state through {@link AvatarMount.registerCombatVisual}, and we toggle which
 * root renders — **default in the idle/neutral state, attack while a melee swing
 * is in flight**. No animation playback: the static loader swaps the whole mesh
 * (FLO-440 swap-by-URL pattern), and because the two GLBs share a bbox the swap
 * needs no scale/position correction. The default root stays the animator's node
 * so bob/lean/lunge keep playing on the neutral pose between swings.
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
  /**
   * Optional hook to register the combat-state visual swap (FLO-481). The mount
   * calls `swap(true)` when a melee swing starts and `swap(false)` when it ends,
   * so the avatar can show the attack-pose GLB only while attacking. Absent on
   * mounts that never attack (the swap is then simply not wired).
   */
  registerCombatVisual?(swap: (inCombat: boolean) => void): void
}

/** Capsule-foot offset for the 1.8 m capsule, matching the old box-avatar wiring. */
const CAPSULE_FOOT_OFFSET = new Vector3(0, -0.9, 0)

/**
 * Facet + matte + non-pickable every mesh of a loaded model. Hard facets + matte
 * keep the silhouette flat-shaded, not smooth, or the FLO-440 low-poly re-author
 * is defeated; shared with the enemy soldier, corpses and the menu/defeat backdrop
 * hero so every character reads in one band (FLO-452).
 */
function prepModel(model: LoadedModel): void {
  facetMeshes(model.meshes)
  for (const mesh of model.meshes) {
    mesh.isPickable = false
    mattenMaterial(mesh)
  }
}

/**
 * Facet + matte + parent the loaded survivor meshes onto the capsule and hand the
 * visual root to the animator. Split out from the async load so it is unit-testable
 * under a headless `NullEngine` without a real GLB fetch.
 *
 * When `attackModel` is supplied, it is mounted alongside the default as a hidden
 * drop-in twin and the combat-state swap (FLO-481) is registered on the mount: the
 * default shows while idle, the attack pose while a melee swing is in flight.
 */
export function wireSurvivorAvatar(
  mount: AvatarMount,
  model: LoadedModel,
  attackModel?: LoadedModel | null,
): void {
  prepModel(model)
  model.root.parent = mount.mesh
  model.root.position = CAPSULE_FOOT_OFFSET.clone()
  mount.mesh.isVisible = false // hide the capsule placeholder once the visual mounts
  mount.animator.node = model.root as unknown as AnimatableNode

  if (!attackModel) return

  // The attack pose is a static strike twin (same bbox/scale/foot offset as the
  // default — FLO-480), so it drops in at the identical transform; we only toggle
  // which subtree renders. It starts disabled — the player spawns in the neutral
  // pose — and the controller's melee state drives the swap from here on.
  prepModel(attackModel)
  attackModel.root.parent = mount.mesh
  attackModel.root.position = CAPSULE_FOOT_OFFSET.clone()
  attackModel.root.setEnabled(false)

  mount.registerCombatVisual?.((inCombat) => {
    model.root.setEnabled(!inCombat)
    attackModel.root.setEnabled(inCombat)
  })
}

/**
 * Fire-and-forget: load the survivor GLB(s) and wire them onto the capsule. Safe
 * to call from a synchronous scene factory; a failed fetch keeps the capsule
 * placeholder visible (and tests pass `heroUrl: null` to skip the call entirely).
 *
 * Pass `attackUrl` to enable the FLO-481 combat-state swap: the attack GLB loads
 * in parallel and, if it resolves, is wired as the strike-pose twin. A failed
 * attack fetch degrades gracefully to the default-only avatar (the swap is just
 * never wired) rather than dropping the whole player visual.
 */
export function mountSurvivorAvatar(
  scene: Scene,
  mount: AvatarMount,
  heroUrl: string,
  attackUrl?: string | null,
): void {
  const opts = { targetSize: 1.8, groundIt: true }
  const loadAttack = attackUrl
    ? loadModel(scene, attackUrl, opts).catch(() => null)
    : Promise.resolve(null)
  void Promise.all([loadModel(scene, heroUrl, opts), loadAttack])
    .then(([model, attackModel]) => wireSurvivorAvatar(mount, model, attackModel))
    .catch(() => {
      /* keep the capsule placeholder visible */
    })
}
