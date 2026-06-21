import {
  type AbstractMesh,
  type ArcRotateCamera,
  Mesh,
  MeshBuilder,
  Ray,
  type Scene,
  Vector3,
} from '@babylonjs/core'
import type { System } from '../loop'
import type { Intent } from '../input'
import type { PlayerTransform } from '../save/types'
import type { LocomotionMode } from '../health/locomotion'
import {
  DEFAULT_MOVEMENT_PARAMS,
  type MovementParams,
  type MovementState,
  createMovementState,
  stepMovement,
} from './movement'
import {
  DEFAULT_STAMINA_PARAMS,
  type StaminaParams,
  type StaminaState,
  createStaminaState,
  stepStamina,
} from './stamina'
import type { AttackPhase } from '../combat/meleeAttack'
import { CharacterAnimator } from '../animation/proceduralAnimator'

/**
 * Babylon binding for the capsule character controller. It owns a capsule mesh,
 * reads the per-frame {@link Intent} from the input system, resolves it into a
 * camera-relative world move direction, queries the ground with a short downward
 * ray, and advances the pure {@link stepMovement} math — then writes the result
 * back onto the mesh.
 *
 * It is a {@link System}: register it with the fixed-step scheduler and it
 * advances once per fixed step, so movement stays framerate-independent. All the
 * gameplay-relevant math lives in `./movement` (pure, NullEngine-tested); this
 * class only bridges it to Babylon meshes, rays, and the camera basis.
 */
export interface CharacterControllerOptions {
  readonly scene: Scene
  /**
   * Camera whose XZ basis defines "forward"/"right" for WASD. Optional at
   * construction so the follow camera (which needs the capsule mesh) can be
   * attached afterwards via {@link CharacterController.camera}. With no camera
   * the basis falls back to world axes.
   */
  readonly camera?: ArcRotateCamera
  /** Pulls the resolved intent each step (e.g. `() => input.intent()`). */
  readonly getIntent: () => Intent
  /**
   * Per-step horizontal locomotion multiplier (1 = normal). The leg-loss crawl
   * outcome surfaces here: the caller feeds `selectLocomotionSpeedMultiplier`
   * (e.g. `0.35` while crawling) so a severed leg actually slows the capsule.
   * Defaults to a constant `1` — no injury, full speed.
   */
  readonly getSpeedMultiplier?: () => number
  /**
   * Active leg-loss locomotion pose for the procedural animator (E6.1.5).
   * Defaults to `'normal'`.
   */
  readonly getLocomotionMode?: () => LocomotionMode
  /**
   * Display-only stamina push (FLO-465). Called from the per-frame tick *only*
   * when the rounded percentage changes, so the HUD slice updates without a
   * 60 fps dispatch storm. Stamina stays authoritative in this controller.
   */
  readonly onStaminaChange?: (current: number, max: number) => void
  /** Movement tuning. Defaults to {@link DEFAULT_MOVEMENT_PARAMS}. */
  readonly params?: MovementParams
  /** Stamina tuning. Defaults to {@link DEFAULT_STAMINA_PARAMS}. */
  readonly staminaParams?: StaminaParams
  /** Spawn position of the capsule origin (centre). Default `(0, 1, 0)`. */
  readonly spawn?: Vector3
  /** Initial capsule yaw in radians (e.g. restored from a save). Default 0. */
  readonly spawnRotationY?: number
  /** Total capsule height; also sets the ground-clamp half-height. Default 1.8. */
  readonly capsuleHeight?: number
  /** Capsule radius. Default 0.4. */
  readonly capsuleRadius?: number
  /**
   * Extra reach below the feet for the ground ray, in units. Must exceed one
   * step of fall (`gravity·dt²`-ish) to avoid tunnelling. Default 0.4.
   */
  readonly groundProbe?: number
  /** Which meshes count as ground for the downward ray. Default: pickable, non-capsule. */
  readonly isGround?: (mesh: AbstractMesh) => boolean
}

export class CharacterController implements System {
  readonly name = 'characterController'
  /** The capsule collider/transform. Parent visual meshes (the hero GLB) under it. */
  readonly mesh: Mesh
  /** Movement basis. Assignable so a follow camera built from `mesh` can attach later. */
  camera: ArcRotateCamera | null
  /** Procedural animator — attach `.node` after GLB load to animate the visual. */
  readonly animator: CharacterAnimator
  private readonly scene: Scene
  private readonly getIntent: () => Intent
  private readonly getSpeedMultiplier: () => number
  private readonly getLocomotionMode: () => LocomotionMode
  private readonly onStaminaChange?: (current: number, max: number) => void
  private readonly params: MovementParams
  private readonly staminaParams: StaminaParams
  private readonly groundProbe: number
  private readonly isGround: (mesh: AbstractMesh) => boolean
  private state: MovementState
  /** Authoritative sprint-stamina pool — advanced every step, pushed to the HUD. */
  private stamina: StaminaState
  /** Last rounded stamina percentage dispatched, to guard the 60 fps push. */
  private lastStaminaPct = 100
  private attackPhase: AttackPhase = 'idle'
  private dead = false

  constructor(options: CharacterControllerOptions) {
    this.scene = options.scene
    this.camera = options.camera ?? null
    this.getIntent = options.getIntent
    this.getSpeedMultiplier = options.getSpeedMultiplier ?? (() => 1)
    this.getLocomotionMode = options.getLocomotionMode ?? (() => 'normal')
    this.onStaminaChange = options.onStaminaChange
    this.staminaParams = options.staminaParams ?? DEFAULT_STAMINA_PARAMS
    this.stamina = createStaminaState(this.staminaParams)
    this.groundProbe = options.groundProbe ?? 0.4

    const height = options.capsuleHeight ?? 1.8
    const radius = options.capsuleRadius ?? 0.4
    // Keep the clamp half-height in lock-step with the actual capsule so the
    // feet rest exactly on the ground.
    this.params = {
      ...(options.params ?? DEFAULT_MOVEMENT_PARAMS),
      capsuleHalfHeight: height / 2,
    }

    const spawn = options.spawn ?? new Vector3(0, height / 2, 0)
    this.mesh = MeshBuilder.CreateCapsule('playerCapsule', { height, radius }, this.scene)
    this.mesh.position.copyFrom(spawn)
    this.mesh.rotation.y = options.spawnRotationY ?? 0
    // The capsule is a collider, not a pick target: it must never register as
    // its own ground or occlude its own follow camera.
    this.mesh.isPickable = false

    // Exclude the capsule and anything parented under it (the hero visual) — a
    // pickable mesh riding on the capsule would otherwise be hit by the
    // downward ground ray and clamp the capsule onto itself every frame.
    this.isGround =
      options.isGround ??
      ((mesh) => mesh.isPickable && mesh !== this.mesh && !mesh.isDescendantOf(this.mesh))
    this.state = { ...createMovementState(spawn.x, spawn.y, spawn.z) }
    // Base offsets match the visual root's spawn position relative to the capsule.
    this.animator = new CharacterAnimator(-0.9, 0)
  }

  /** Capsule origin in world space (live reference — clone before mutating). */
  get position(): Vector3 {
    return this.mesh.position
  }

  /** Whether the capsule was resting on ground at the end of the last step. */
  get grounded(): boolean {
    return this.state.grounded
  }

  /**
   * Serialisable snapshot of the capsule pose for the save system: world
   * position plus yaw. Returns plain numbers (not the live `Vector3`) so callers
   * can persist it without aliasing the mesh.
   */
  snapshot(): PlayerTransform {
    const p = this.mesh.position
    return { position: { x: p.x, y: p.y, z: p.z }, rotationY: this.mesh.rotation.y }
  }

  /** Update the melee attack phase so the animator can drive the lunge. */
  setAttackPhase(phase: AttackPhase): void {
    this.attackPhase = phase
  }

  /** Mark the player dead so the animator drives the topple. */
  setDead(dead: boolean): void {
    this.dead = dead
  }

  /**
   * Teleport the capsule to a pose (e.g. restoring a save). Resets the authoritative
   * movement state — not just the mesh — so the next step does not snap back, and
   * clears vertical velocity so the player does not inherit a stale fall.
   */
  teleport(transform: PlayerTransform): void {
    const { x, y, z } = transform.position
    this.state = { ...this.state, posX: x, posY: y, posZ: z, velY: 0 }
    this.mesh.position.set(x, y, z)
    this.mesh.rotation.y = transform.rotationY
  }

  update(dt: number): void {
    const intent = this.getIntent()
    const dir = this.worldMoveDir(intent)
    const ground = this.groundHeightUnderCapsule()

    // Leg-loss locomotion: scale the (already unit-clamped) move direction by the
    // injury multiplier so a crawling player moves slower. `stepMovement` derives
    // displacement from the direction magnitude, so a 0.35 multiplier yields 35%
    // speed for both walk and sprint. Facing still uses the unscaled `dir` below,
    // so a slowed player keeps turning normally.
    const speedMultiplier = this.getSpeedMultiplier()

    // Advance the authoritative stamina pool first: it gates whether the held
    // sprint key is *effective* this step. When the pool empties, `sprintActive`
    // drops to false and the player auto-falls back to walk speed (still moving).
    const staminaStep = stepStamina(this.stamina, intent.sprint, dt, this.staminaParams)
    this.stamina = staminaStep
    const sprintActive = staminaStep.sprintActive

    this.state = stepMovement(
      this.state,
      {
        dirX: dir.x * speedMultiplier,
        dirZ: dir.z * speedMultiplier,
        sprint: sprintActive,
        jump: intent.jump,
      },
      ground,
      this.params,
      dt,
    )

    this.mesh.position.set(this.state.posX, this.state.posY, this.state.posZ)

    // Push stamina to the HUD only when the rounded percentage changes — the
    // value moves every frame, but React only needs whole-percent updates.
    const pct = Math.round((this.stamina.stamina / this.staminaParams.max) * 100)
    if (pct !== this.lastStaminaPct) {
      this.lastStaminaPct = pct
      this.onStaminaChange?.(Math.round(this.stamina.stamina), this.staminaParams.max)
    }

    // Face the direction of travel so a parented visual turns with movement.
    if (dir.x !== 0 || dir.z !== 0) {
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }

    // Feed the *actual* horizontal speed so the animator can pick its bob tier
    // (idle/move/sprint). Sprint engages the deeper sprint-bob (FLO-465); a
    // slowed crawl-sprint stays below the threshold and bobs like a walk.
    const moving = dir.x !== 0 || dir.z !== 0
    const groundSpeed =
      (sprintActive ? this.params.sprintSpeed : this.params.walkSpeed) * speedMultiplier

    this.animator.update({
      dt,
      speed: moving ? groundSpeed : 0,
      attackPhase: this.attackPhase,
      isDead: this.dead,
      locomotionMode: this.getLocomotionMode(),
    })
  }

  /**
   * Resolve the strafe/forward intent into a world-space XZ direction using the
   * camera's flattened basis, so "forward" always means "away from the camera".
   * Returns a vector of magnitude ≤ 1 (diagonals are not faster).
   */
  private worldMoveDir(intent: Intent): { x: number; z: number } {
    if (intent.moveX === 0 && intent.moveY === 0) return { x: 0, z: 0 }

    // Camera-relative when a camera is attached; otherwise world-aligned.
    const forward = this.camera ? this.camera.getDirection(Vector3.Forward()) : Vector3.Forward()
    const right = this.camera ? this.camera.getDirection(Vector3.Right()) : Vector3.Right()
    let x = right.x * intent.moveX + forward.x * intent.moveY
    let z = right.z * intent.moveX + forward.z * intent.moveY

    const len = Math.hypot(x, z)
    if (len > 1e-6) {
      const inv = 1 / Math.max(len, 1) // clamp magnitude to 1, keep direction
      x *= inv
      z *= inv
    }
    return { x, z }
  }

  /** World Y of the ground directly below the capsule, or `null` if out of reach. */
  private groundHeightUnderCapsule(): number | null {
    const o = this.mesh.position
    const ray = new Ray(
      new Vector3(o.x, o.y, o.z),
      Vector3.Down(),
      this.params.capsuleHalfHeight + this.groundProbe,
    )
    const pick = this.scene.pickWithRay(ray, this.isGround)
    return pick?.hit && pick.pickedPoint ? pick.pickedPoint.y : null
  }

  dispose(): void {
    this.mesh.dispose()
  }
}
