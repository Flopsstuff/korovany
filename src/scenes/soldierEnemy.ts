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
  /**
   * Soldier GLB to mount on the capsule (FLO-311); `null` keeps the bare
   * capsule placeholder. Defaults to the shipped Empire soldier model.
   */
  glbUrl?: string | null
}

export class SoldierEnemy implements System, Damageable {
  readonly mesh: AbstractMesh
  private fsm: SoldierFSMState
  private readonly params: SoldierFSMParams
  private readonly getPlayerPos: () => Vector3
  private readonly onAttackPlayer: (dmg: number) => void
  private readonly getOrderContext?: () => SoldierOrderContext
  private readonly onAttackOrderTarget?: (dmg: number) => void

  get position(): Vec3 {
    return { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z }
  }

  constructor(scene: Scene, options: SoldierEnemyOptions) {
    this.params = options.params ?? DEFAULT_SOLDIER_PARAMS
    this.getPlayerPos = options.getPlayerPos
    this.onAttackPlayer = options.onAttackPlayer
    this.getOrderContext = options.getOrderContext
    this.onAttackOrderTarget = options.onAttackOrderTarget
    this.fsm = createSoldierFSM(this.params)

    this.mesh = MeshBuilder.CreateCapsule(
      'soldier',
      { radius: 0.35, height: 1.8 },
      scene,
    )
    this.mesh.position = options.spawn.clone()
    this.mesh.isPickable = false

    const mat = new StandardMaterial('soldierMat', scene)
    mat.diffuseColor = new Color3(0.6, 0.25, 0.1)
    this.mesh.material = mat

    // Mount the FLO-311 GLB onto the capsule (best-effort: the bare capsule
    // stays as a fallback if the model can't be fetched, e.g. in headless tests).
    const glbUrl = options.glbUrl === undefined ? DEFAULT_SOLDIER_GLB : options.glbUrl
    if (glbUrl) {
      void import('./modelLoader')
        .then(({ loadModel }) =>
          loadModel(scene, glbUrl, { targetSize: 1.8, groundIt: true }).then((model) => {
            model.root.parent = this.mesh
            model.root.position = new Vector3(0, -0.9, 0)
            for (const m of model.meshes) m.isPickable = false
            this.mesh.isVisible = false // hide the placeholder capsule
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
      // Topple in place so the kill reads clearly; E2.4 (FLO-313) takes over
      // the death sequence — we deliberately do not despawn the mesh.
      this.mesh.rotation.z = Math.PI / 2
      const mat = this.mesh.material as StandardMaterial | null
      if (mat) mat.diffuseColor = new Color3(0.3, 0.3, 0.3)
    }
  }

  /** System — driven by FixedStepLoop. */
  update(dt: number, _world: unknown): void {
    if (this.fsm.phase === 'dead') return

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
  }

  isDead(): boolean {
    return this.fsm.phase === 'dead'
  }

  dispose(): void {
    this.mesh.dispose()
  }
}
