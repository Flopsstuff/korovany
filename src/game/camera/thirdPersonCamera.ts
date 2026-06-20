import {
  type AbstractMesh,
  ArcRotateCamera,
  Ray,
  type Scene,
  Vector3,
} from '@babylonjs/core'
import {
  type CameraOrbit,
  type CameraParams,
  DEFAULT_CAMERA_PARAMS,
  applyLook,
  clampBoomRadius,
} from './boom'

/**
 * Third-person follow rig built on Babylon's built-in `ArcRotateCamera`
 * (boring-tech lens: orbit/zoom/target are solved problems). We add two things
 * on top of the stock camera:
 *
 *  - **Mouse-look** driven by the input system's accumulated `lookDX/lookDY`
 *    rather than `attachControl`, so look obeys the same intent pipeline as
 *    movement and stays pointer-lock friendly.
 *  - A **collision-aware boom**: each frame a ray from the player toward the
 *    ideal camera spot pulls the radius in when geometry would otherwise clip
 *    between the camera and the player.
 *
 * The rig follows the player by locking the camera's target to the player mesh,
 * so it tracks automatically as the controller moves the capsule.
 */
export interface ThirdPersonCameraOptions {
  readonly scene: Scene
  /** Mesh the camera orbits and follows (the player capsule). */
  readonly target: AbstractMesh
  /** Rig tuning. Defaults to {@link DEFAULT_CAMERA_PARAMS}. */
  readonly params?: CameraParams
  /**
   * Which meshes block the boom. Defaults to "any pickable mesh that is not the
   * target" — i.e. walls and terrain occlude, the player itself never does.
   */
  readonly occludes?: (mesh: AbstractMesh) => boolean
}

export class ThirdPersonCamera {
  readonly camera: ArcRotateCamera
  private readonly scene: Scene
  private readonly target: AbstractMesh
  private readonly params: CameraParams
  private readonly occludes: (mesh: AbstractMesh) => boolean
  private orbit: CameraOrbit

  constructor(options: ThirdPersonCameraOptions) {
    this.scene = options.scene
    this.target = options.target
    this.params = options.params ?? DEFAULT_CAMERA_PARAMS
    this.occludes =
      options.occludes ?? ((mesh) => mesh.isPickable && mesh !== this.target)

    // Start behind and slightly above the player, looking down at the rig's
    // mid-pitch. Alpha = -π/2 places the camera on -Z (behind a +Z-facing hero).
    this.orbit = {
      alpha: -Math.PI / 2,
      beta: (this.params.minPitch + this.params.maxPitch) / 2,
    }

    const camera = new ArcRotateCamera(
      'thirdPersonCamera',
      this.orbit.alpha,
      this.orbit.beta,
      this.params.distance,
      this.target.getAbsolutePosition().clone(),
      this.scene,
    )
    // Follow the player automatically; we never call setTarget (which would
    // recompute and clobber our managed alpha/beta).
    camera.lockedTarget = this.target
    // Look is driven by the input system, not the pointer — no attachControl.
    this.camera = camera
  }

  /** Make this the scene's active camera. */
  activate(): void {
    this.scene.activeCamera = this.camera
  }

  /**
   * Advance the rig one frame: apply accumulated look deltas, then resolve the
   * collision boom against current geometry. Call after the controller has moved
   * the player so the camera tracks the new position the same frame.
   */
  update(lookDX: number, lookDY: number): void {
    this.orbit = applyLook(this.orbit, lookDX, lookDY, this.params)
    this.camera.alpha = this.orbit.alpha
    this.camera.beta = this.orbit.beta
    this.resolveBoom()
  }

  /** The angles the rig is currently holding (after clamping). Exposed for tests. */
  get orbitAngles(): CameraOrbit {
    return this.orbit
  }

  private resolveBoom(): void {
    const params = this.params
    const focus = this.target.getAbsolutePosition()

    // Extend to the ideal length and force a position recompute so we can read
    // the true target→camera direction (which depends only on alpha/beta).
    this.camera.radius = params.distance
    this.camera.getViewMatrix(true)

    const toCamera = this.camera.position.subtract(focus)
    const length = toCamera.length()
    if (length < 1e-4) return // degenerate; leave radius at full distance
    const dir = toCamera.scaleInPlace(1 / length)

    const ray = new Ray(focus, dir, params.distance)
    const pick = this.scene.pickWithRay(ray, this.occludes)
    const hitDistance = pick?.hit ? pick.distance : null

    this.camera.radius = clampBoomRadius(hitDistance, params)
  }
}

/** Convenience: world-space forward (on the XZ plane) the camera is looking along. */
export function cameraForwardXZ(camera: ArcRotateCamera): Vector3 {
  const dir = camera.getTarget().subtract(camera.position)
  dir.y = 0
  const len = dir.length()
  return len > 1e-6 ? dir.scaleInPlace(1 / len) : new Vector3(0, 0, 1)
}
