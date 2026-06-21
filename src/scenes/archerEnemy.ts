/**
 * Thin Babylon wrapper for the ranged Empire Archer NPC (FLO-432).
 *
 * The pure behaviour is in `src/game/ai/rangedArcherFSM.ts` — the same
 * patrol→engage→dead scaffolding as the soldier, but kiting + ranged fire. This
 * class wires it to a scene mesh + the fixed-step loop, implements `Damageable`
 * so the player's melee can cut it down, and on each loosed arrow calls back to
 * the scene's `ArrowVolley` to spawn the projectile. The arrow's damage then
 * routes through the *same* damage funnel + `damageEvents` bridge as everything
 * else, so no combat feedback is special-cased here.
 */
import {
  type AbstractMesh,
  Color3,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { Damageable, Vec3 } from '../game/combat'
import { CharacterAnimator } from '../game/animation/proceduralAnimator'
import type { AnimatableNode } from '../game/animation/proceduralAnimator'
import {
  applyDamageToArcher,
  createArcherFSM,
  DEFAULT_ARCHER_PARAMS,
  stepArcherFSM,
  type ArcherFSMParams,
  type ArcherFSMState,
} from '../game/ai'
import type { System } from '../game/loop'
import { arrowMuzzle } from './arrowVolley'

/** FLO-426 ranged archer mesh — web-ready GLB shipped in /public/models. */
export const DEFAULT_ARCHER_GLB = '/models/ranged-archer.glb'

type ArcherMaterialRole = 'cloak' | 'leather' | 'wood'

/** Hooded-ranger palette — mossy cloak, tan leather, bow-wood — to read apart
 *  from the green-coated musket soldier at a glance. */
const ARCHER_PALETTE: Record<ArcherMaterialRole, Color3> = {
  cloak: new Color3(0.2, 0.26, 0.18),
  leather: new Color3(0.36, 0.24, 0.13),
  wood: new Color3(0.45, 0.33, 0.2),
}

function archerMaterial(scene: Scene, role: ArcherMaterialRole): StandardMaterial {
  const mat = new StandardMaterial(`rangedArcher:${role}`, scene)
  mat.diffuseColor = ARCHER_PALETTE[role]
  mat.specularColor = new Color3(0.06, 0.06, 0.06)
  return mat
}

function roleForMesh(mesh: AbstractMesh, index: number): ArcherMaterialRole {
  const name = mesh.name.toLowerCase()
  if (name.includes('bow') || name.includes('arrow') || name.includes('quiver')) return 'wood'
  if (name.includes('boot') || name.includes('belt') || name.includes('strap')) return 'leather'
  return index % 3 === 2 ? 'leather' : 'cloak'
}

/**
 * The FLO-426 archer asset ships with a flat retexture; this in-engine palette
 * is the headless/fallback pass that keeps every submesh readable as a ranger.
 */
export function applyArcherTexture(scene: Scene, meshes: readonly AbstractMesh[]): void {
  const materials = {
    cloak: archerMaterial(scene, 'cloak'),
    leather: archerMaterial(scene, 'leather'),
    wood: archerMaterial(scene, 'wood'),
  }
  meshes
    .filter((mesh) => mesh.getTotalVertices() > 0)
    .forEach((mesh, index) => {
      mesh.material = materials[roleForMesh(mesh, index)]
    })
}

export interface ArcherEnemyOptions {
  spawn: Vector3
  params?: ArcherFSMParams
  /** Supplier for the player's current world position — read each tick. */
  getPlayerPos: () => Vector3
  /**
   * Called when the archer looses an arrow. The scene spawns the projectile via
   * its `ArrowVolley` so the damage routes through the shared funnel.
   */
  onFire: (muzzle: Vec3, dir: Vec3, damage: number, speed: number) => void
  /**
   * Optional line-of-sight gate. Return false when something blocks the shot;
   * the archer holds fire and repositions. Defaults to always-clear (open ground).
   */
  hasLineOfSight?: (from: Vec3, to: Vec3) => boolean
  /** Callback when the archer is defeated — caller may award XP. */
  onDefeated?: () => void
  /**
   * Archer GLB to mount on the capsule (FLO-426); `null` keeps the bare capsule
   * placeholder (used by headless tests). Defaults to the shipped archer model.
   */
  glbUrl?: string | null
}

export class ArcherEnemy implements System, Damageable {
  readonly mesh: AbstractMesh
  readonly animator: CharacterAnimator
  private fsm: ArcherFSMState
  private readonly params: ArcherFSMParams
  private readonly getPlayerPos: () => Vector3
  private readonly onFire: ArcherEnemyOptions['onFire']
  private readonly hasLineOfSight?: (from: Vec3, to: Vec3) => boolean
  private readonly onDefeated?: () => void
  /** Spawn anchor (XZ) — patrol movement is leashed around this point (FLO-412). */
  private readonly anchor: Vec3

  get position(): Vec3 {
    return { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z }
  }

  constructor(scene: Scene, options: ArcherEnemyOptions) {
    this.params = options.params ?? DEFAULT_ARCHER_PARAMS
    this.getPlayerPos = options.getPlayerPos
    this.onFire = options.onFire
    this.hasLineOfSight = options.hasLineOfSight
    this.onDefeated = options.onDefeated
    this.anchor = { x: options.spawn.x, y: options.spawn.y, z: options.spawn.z }
    this.fsm = createArcherFSM(this.params)

    this.mesh = MeshBuilder.CreateCapsule('archer', { radius: 0.35, height: 1.8 }, scene)
    this.mesh.position = options.spawn.clone()
    this.mesh.isPickable = false

    const mat = new StandardMaterial('archerMat', scene)
    mat.diffuseColor = ARCHER_PALETTE.cloak
    mat.specularColor = new Color3(0.06, 0.06, 0.06)
    this.mesh.material = mat

    this.animator = new CharacterAnimator(-0.9, 0)

    const glbUrl = options.glbUrl === undefined ? DEFAULT_ARCHER_GLB : options.glbUrl
    if (glbUrl) {
      void import('./modelLoader')
        .then(({ loadModel }) =>
          loadModel(scene, glbUrl, { targetSize: 1.8, groundIt: true }).then((model) => {
            applyArcherTexture(scene, model.meshes)
            model.root.parent = this.mesh
            model.root.position = new Vector3(0, -0.9, 0)
            for (const m of model.meshes) m.isPickable = false
            this.mesh.isVisible = false // hide the placeholder capsule
            this.animator.node = model.root as unknown as AnimatableNode
          }),
        )
        .catch(() => {
          /* keep the capsule placeholder visible */
        })
    }
  }

  /** Damageable — called by getMeleeHits callers when the player strikes. */
  takeDamage(amount: number): void {
    if (this.fsm.phase === 'dead') return
    this.fsm = applyDamageToArcher(this.fsm, amount)
    if (this.fsm.phase === 'dead') {
      this.onDefeated?.()
      const mat = this.mesh.material as StandardMaterial | null
      if (mat) mat.diffuseColor = new Color3(0.3, 0.3, 0.3)
    }
  }

  /** System — driven by FixedStepLoop. */
  update(dt: number, _world: unknown): void {
    if (this.fsm.phase === 'dead') {
      this.animator.update({ dt, speed: 0, attackPhase: 'idle', isDead: true })
      return
    }

    const playerPos = this.getPlayerPos()
    const archerVec3: Vec3 = this.position
    const playerVec3: Vec3 = { x: playerPos.x, y: playerPos.y, z: playerPos.z }

    const result = stepArcherFSM(this.fsm, archerVec3, playerVec3, dt, this.params, {
      hasLineOfSight: this.hasLineOfSight
        ? this.hasLineOfSight(archerVec3, playerVec3)
        : true,
      anchorPos: this.anchor,
    })
    this.fsm = result.state

    this.mesh.position.x += result.moveDX
    this.mesh.position.z += result.moveDZ

    if (result.fired) {
      const muzzle = arrowMuzzle(this.position)
      this.onFire(
        muzzle,
        { x: result.aimDirX, y: 0, z: result.aimDirZ },
        this.params.attackDamage,
        this.params.projectileSpeed,
      )
    }

    // Face the player whenever engaged.
    if (this.fsm.phase === 'engage' && (Math.abs(result.aimDirX) + Math.abs(result.aimDirZ) > 0.01)) {
      this.mesh.rotation.y = Math.atan2(result.aimDirX, result.aimDirZ)
    }

    const isMoving = (Math.abs(result.moveDX) + Math.abs(result.moveDZ)) > 1e-4
    this.animator.update({
      dt,
      speed: isMoving ? 4 : 0,
      attackPhase: result.fired ? 'active' : 'idle',
      isDead: false,
    })
  }

  isDead(): boolean {
    return this.fsm.phase === 'dead'
  }

  dispose(): void {
    this.mesh.dispose()
  }
}
