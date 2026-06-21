/**
 * Thin Babylon wrapper for the Empire Soldier NPC (E2.3).
 *
 * The pure behaviour is in `src/game/ai/soldierFSM.ts`. This class wires it to
 * a scene mesh + the fixed-step loop's Updatable interface. It also implements
 * Damageable so the player's melee hit sweep can reduce enemy HP.
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
import {
  applyDamageToSoldier,
  createSoldierFSM,
  DEFAULT_SOLDIER_PARAMS,
  stepSoldierFSM,
  type SoldierFSMParams,
  type SoldierFSMState,
  type SoldierOrderContext,
} from '../game/ai'
import type { System } from '../game/loop'

/** FLO-311 Empire soldier mesh — web-ready GLB shipped in /public/models. */
export const DEFAULT_SOLDIER_GLB = '/models/empire-soldier.glb'

type SoldierMaterialRole = 'coat' | 'leather' | 'metal'

const SOLDIER_PALETTE: Record<SoldierMaterialRole, Color3> = {
  coat: new Color3(0.22, 0.34, 0.24),
  leather: new Color3(0.34, 0.18, 0.09),
  metal: new Color3(0.43, 0.39, 0.32),
}

function soldierMaterial(scene: Scene, role: SoldierMaterialRole): StandardMaterial {
  const mat = new StandardMaterial(`empireSoldier:${role}`, scene)
  mat.diffuseColor = SOLDIER_PALETTE[role]
  mat.specularColor = new Color3(0.08, 0.08, 0.08)
  return mat
}

function roleForMesh(mesh: AbstractMesh, index: number): SoldierMaterialRole {
  const name = mesh.name.toLowerCase()
  if (name.includes('rifle') || name.includes('musket') || name.includes('gun')) return 'metal'
  if (name.includes('boot') || name.includes('belt') || name.includes('strap')) return 'leather'
  return index % 3 === 2 ? 'leather' : 'coat'
}

/**
 * The FLO-311 soldier asset is a preview GLB with no baked texture pass. This
 * in-engine palette gives every loaded submesh a readable Empire uniform until
 * a future binary retexture asset replaces it.
 */
export function applyEmpireSoldierTexture(scene: Scene, meshes: readonly AbstractMesh[]): void {
  const materials = {
    coat: soldierMaterial(scene, 'coat'),
    leather: soldierMaterial(scene, 'leather'),
    metal: soldierMaterial(scene, 'metal'),
  }

  meshes
    .filter((mesh) => mesh.getTotalVertices() > 0)
    .forEach((mesh, index) => {
      mesh.material = materials[roleForMesh(mesh, index)]
    })
}

export interface SoldierEnemyOptions {
  spawn: Vector3
  params?: SoldierFSMParams
  /** Supplier for the player's current world position — read each tick. */
  getPlayerPos: () => Vector3
  /** Callback when soldier attacks the player — caller dispatches damagePlayer. */
  onAttackPlayer: (damage: number) => void
  /** Optional trusted order context, already validated by the command system. */
  getOrderContext?: () => SoldierOrderContext
  /** Callback when an explicit attack-target order lands a hit. */
  onAttackOrderTarget?: (damage: number) => void
  /** Callback when the soldier is defeated — caller may award XP. */
  onDefeated?: () => void
  /**
   * Soldier GLB to mount on the capsule (FLO-311); `null` keeps the bare
   * capsule placeholder. Defaults to the shipped Empire soldier model.
   */
  glbUrl?: string | null
}

export class SoldierEnemy implements System, Damageable {
  readonly mesh: AbstractMesh
  readonly animator: CharacterAnimator
  private fsm: SoldierFSMState
  private readonly params: SoldierFSMParams
  private readonly getPlayerPos: () => Vector3
  private readonly onAttackPlayer: (dmg: number) => void
  private readonly getOrderContext?: () => SoldierOrderContext
  private readonly onAttackOrderTarget?: (dmg: number) => void
  private readonly onDefeated?: () => void

  get position(): Vec3 {
    return { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z }
  }

  constructor(scene: Scene, options: SoldierEnemyOptions) {
    this.params = options.params ?? DEFAULT_SOLDIER_PARAMS
    this.getPlayerPos = options.getPlayerPos
    this.onAttackPlayer = options.onAttackPlayer
    this.getOrderContext = options.getOrderContext
    this.onAttackOrderTarget = options.onAttackOrderTarget
    this.onDefeated = options.onDefeated
    this.fsm = createSoldierFSM(this.params)

    this.mesh = MeshBuilder.CreateCapsule(
      'soldier',
      { radius: 0.35, height: 1.8 },
      scene,
    )
    this.mesh.position = options.spawn.clone()
    this.mesh.isPickable = false

    const mat = new StandardMaterial('soldierMat', scene)
    mat.diffuseColor = SOLDIER_PALETTE.coat
    mat.specularColor = new Color3(0.08, 0.08, 0.08)
    this.mesh.material = mat

    this.animator = new CharacterAnimator(-0.9, 0)

    // Mount the FLO-311 GLB onto the capsule (best-effort: the bare capsule
    // stays as a fallback if the model can't be fetched, e.g. in headless tests).
    const glbUrl = options.glbUrl === undefined ? DEFAULT_SOLDIER_GLB : options.glbUrl
    if (glbUrl) {
      void import('./modelLoader')
        .then(({ loadModel }) =>
          loadModel(scene, glbUrl, { targetSize: 1.8, groundIt: true }).then((model) => {
            applyEmpireSoldierTexture(scene, model.meshes)
            model.root.parent = this.mesh
            model.root.position = new Vector3(0, -0.9, 0)
            for (const m of model.meshes) m.isPickable = false
            this.mesh.isVisible = false // hide the placeholder capsule
            // Wire animator to the visual root after async load.
            this.animator.node = model.root as unknown as import('../game/animation/proceduralAnimator').AnimatableNode
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
    this.fsm = applyDamageToSoldier(this.fsm, amount)
    if (this.fsm.phase === 'dead') {
      this.onDefeated?.()
      const mat = this.mesh.material as StandardMaterial | null
      if (mat) mat.diffuseColor = new Color3(0.3, 0.3, 0.3)
      // Procedural topple via animator (replaces the old static mesh.rotation.z flip).
    }
  }

  /** System — driven by FixedStepLoop. */
  update(dt: number, _world: unknown): void {
    if (this.fsm.phase === 'dead') {
      this.animator.update({ dt, speed: 0, attackPhase: 'idle', isDead: true })
      return
    }

    const playerPos = this.getPlayerPos()
    const soldierVec3: Vec3 = this.position

    const result = stepSoldierFSM(
      this.fsm,
      soldierVec3,
      playerPos as unknown as Vec3,
      dt,
      this.params,
      undefined,
      this.getOrderContext?.() ?? { order: null },
    )
    this.fsm = result.state

    this.mesh.position.x += result.moveDX
    this.mesh.position.z += result.moveDZ

    if (result.attacked) {
      if (result.attackedTarget === 'order-target') {
        this.onAttackOrderTarget?.(this.params.attackDamage)
      } else {
        this.onAttackPlayer(this.params.attackDamage)
      }
    }

    // Face the active target while fighting or following an explicit command.
    const orderContext = this.getOrderContext?.()
    const faceTarget =
      this.fsm.phase === 'attack-target' && orderContext?.targetPos
        ? orderContext.targetPos
        : this.fsm.phase === 'follow' && orderContext?.leaderPos
          ? orderContext.leaderPos
          : this.fsm.phase === 'chase' || this.fsm.phase === 'attack'
            ? playerPos
            : null
    if (faceTarget) {
      const dx = faceTarget.x - this.mesh.position.x
      const dz = faceTarget.z - this.mesh.position.z
      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        this.mesh.rotation.y = Math.atan2(dx, dz)
      }
    }

    // Derive animator inputs from FSM state: moving = chasing/following/commanded-move,
    // attacking = attack phase.
    const isMoving =
      this.fsm.phase === 'chase' ||
      this.fsm.phase === 'follow' ||
      this.fsm.phase === 'move-to'
    const isAttacking = this.fsm.phase === 'attack' || this.fsm.phase === 'attack-target'
    this.animator.update({
      dt,
      speed: isMoving ? 4 : 0,
      attackPhase: isAttacking ? 'active' : 'idle',
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
