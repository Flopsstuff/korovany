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
import {
  DEFAULT_MOVEMENT_PARAMS,
  type MovementParams,
  type MovementState,
  createMovementState,
  stepMovement,
} from './movement'

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
  /** Movement tuning. Defaults to {@link DEFAULT_MOVEMENT_PARAMS}. */
  readonly params?: MovementParams
  /** Spawn position of the capsule origin (centre). Default `(0, 1, 0)`. */
  readonly spawn?: Vector3
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
  private readonly scene: Scene
  private readonly getIntent: () => Intent
  private readonly params: MovementParams
  private readonly groundProbe: number
  private readonly isGround: (mesh: AbstractMesh) => boolean
  private state: MovementState

  constructor(options: CharacterControllerOptions) {
    this.scene = options.scene
    this.camera = options.camera ?? null
    this.getIntent = options.getIntent
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
    // The capsule is a collider, not a pick target: it must never register as
    // its own ground or occlude its own follow camera.
    this.mesh.isPickable = false

    this.isGround = options.isGround ?? ((mesh) => mesh.isPickable && mesh !== this.mesh)
    this.state = { ...createMovementState(spawn.x, spawn.y, spawn.z) }
  }

  /** Capsule origin in world space (live reference — clone before mutating). */
  get position(): Vector3 {
    return this.mesh.position
  }

  /** Whether the capsule was resting on ground at the end of the last step. */
  get grounded(): boolean {
    return this.state.grounded
  }

  update(dt: number): void {
    const intent = this.getIntent()
    const dir = this.worldMoveDir(intent)
    const ground = this.groundHeightUnderCapsule()

    this.state = stepMovement(
      this.state,
      { dirX: dir.x, dirZ: dir.z, sprint: intent.sprint, jump: intent.jump },
      ground,
      this.params,
      dt,
    )

    this.mesh.position.set(this.state.posX, this.state.posY, this.state.posZ)

    // Face the direction of travel so a parented visual turns with movement.
    if (dir.x !== 0 || dir.z !== 0) {
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
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
