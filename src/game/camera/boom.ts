// Pure, engine-agnostic third-person camera math.
//
// No Babylon/DOM here: just the orbit (look) integration and the collision-aware
// boom clamp. The Babylon binding (./thirdPersonCamera) wraps an
// `ArcRotateCamera`, feeds it these results, and supplies the real ray-cast hit
// distance for the boom. Extracting the math keeps the pitch clamp and pull-in
// logic unit-testable without a GPU.

/** Tunable third-person rig constants. */
export interface CameraParams {
  /** Radians of camera yaw per pixel of horizontal mouse movement. */
  readonly yawSensitivity: number
  /** Radians of camera pitch per pixel of vertical mouse movement. */
  readonly pitchSensitivity: number
  /** Lower pitch bound (radians from +Y). Babylon beta; keep > 0 to avoid gimbal flip. */
  readonly minPitch: number
  /** Upper pitch bound (radians from +Y). Keep < π to stay above the floor. */
  readonly maxPitch: number
  /** Desired boom length when nothing is occluding, in scene units. */
  readonly distance: number
  /** Gap kept between the camera and an occluder it pulls in to, in scene units. */
  readonly collisionMargin: number
}

/** A comfortable over-the-shoulder default rig. */
export const DEFAULT_CAMERA_PARAMS: CameraParams = {
  yawSensitivity: 0.0035,
  pitchSensitivity: 0.0035,
  minPitch: 0.35,
  maxPitch: 1.45,
  distance: 6,
  collisionMargin: 0.3,
}

/** Camera orbit angles, in Babylon `ArcRotateCamera` convention (alpha=yaw, beta=pitch). */
export interface CameraOrbit {
  readonly alpha: number
  readonly beta: number
}

/**
 * Apply one frame of accumulated mouse-look delta to the orbit angles.
 *
 * Horizontal delta (`lookDX`) rotates yaw; we subtract so dragging right orbits
 * the camera clockwise (the world appears to swing left), matching the usual
 * third-person feel. Vertical delta (`lookDY`) changes pitch and is clamped to
 * `[minPitch, maxPitch]` so the camera never flips over the top or sinks
 * through the floor.
 */
export function applyLook(
  orbit: CameraOrbit,
  lookDX: number,
  lookDY: number,
  params: CameraParams,
): CameraOrbit {
  const alpha = orbit.alpha - lookDX * params.yawSensitivity
  const beta = clamp(
    orbit.beta + lookDY * params.pitchSensitivity,
    params.minPitch,
    params.maxPitch,
  )
  return { alpha, beta }
}

/**
 * Resolve the boom length given the desired distance and the nearest occluder
 * hit distance along the boom (or `null` when the ray reached full distance).
 *
 * When something is between the player and the ideal camera spot, we pull the
 * camera in to `hitDistance - collisionMargin` so it sits just in front of the
 * geometry instead of clipping through it. The result is clamped to
 * `[0, distance]` — never longer than desired, never negative.
 */
export function clampBoomRadius(hitDistance: number | null, params: CameraParams): number {
  if (hitDistance === null) return params.distance
  return clamp(hitDistance - params.collisionMargin, 0, params.distance)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
