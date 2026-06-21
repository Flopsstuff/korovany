// Pure, engine-agnostic character movement math.
//
// This module holds NO Babylon or DOM references. It integrates one fixed step
// of capsule movement — horizontal locomotion, gravity, ground clamping, jump
// with coyote-time, and the no-double-jump rule — given the ground height under
// the capsule. The Babylon binding (./characterController) supplies that ground
// height (via a downward ray) and applies the result to a mesh; keeping the math
// pure makes gravity/clamp/coyote fully unit-testable under a headless engine.
//
// Frame of reference: `pos` is the capsule's *origin* (its centre, matching
// Babylon's `MeshBuilder.CreateCapsule`). The feet sit `capsuleHalfHeight` below
// the origin, so the capsule rests on ground `g` when `posY === g +
// capsuleHalfHeight`.

/** Tunable movement constants. All speeds are scene-units/second. */
export interface MovementParams {
  /** Ground speed when not sprinting. */
  readonly walkSpeed: number
  /** Ground speed while sprint is held. */
  readonly sprintSpeed: number
  /** Downward acceleration magnitude (positive), units/s². */
  readonly gravity: number
  /** Initial upward velocity imparted by a jump, units/s. */
  readonly jumpSpeed: number
  /**
   * Grace window (seconds) after walking off a ledge during which a jump is
   * still allowed. 0 disables coyote-time.
   */
  readonly coyoteTime: number
  /** Distance from the capsule origin to its feet (half the capsule height). */
  readonly capsuleHalfHeight: number
}

/** Sensible defaults for a human-scale elf on solid ground. */
export const DEFAULT_MOVEMENT_PARAMS: MovementParams = {
  walkSpeed: 4,
  sprintSpeed: 9,
  gravity: 24,
  jumpSpeed: 8,
  coyoteTime: 0.12,
  capsuleHalfHeight: 0.9,
}

/** The controller's mutable-per-step state. Treated as immutable by `stepMovement`. */
export interface MovementState {
  readonly posX: number
  readonly posY: number
  readonly posZ: number
  /** Vertical velocity, units/s (positive = up). */
  readonly velY: number
  /** Whether the capsule rested on ground at the end of the last step. */
  readonly grounded: boolean
  /** Remaining coyote-time grace, seconds. Refilled to `coyoteTime` while grounded. */
  readonly coyoteRemaining: number
  /**
   * No-double-jump guard: true only after landing, consumed (set false) by a
   * jump. A second jump is impossible until the capsule grounds again, even
   * within the coyote window.
   */
  readonly canJump: boolean
  /** Previous step's raw jump-held flag, for rising-edge detection. */
  readonly jumpHeld: boolean
}

/** Per-step movement intent, already resolved into world space by the caller. */
export interface MovementInput {
  /** World-space horizontal move direction, X. Magnitude of (dirX,dirZ) is 0..1. */
  readonly dirX: number
  /** World-space horizontal move direction, Z. */
  readonly dirZ: number
  /** Whether sprint is held this step. */
  readonly sprint: boolean
  /** Whether the jump action is held this step (rising edge triggers a jump). */
  readonly jump: boolean
}

/** A fresh state at `(x, y, z)`, standing still and airborne until the first ground query. */
export function createMovementState(x = 0, y = 0, z = 0): MovementState {
  return {
    posX: x,
    posY: y,
    posZ: z,
    velY: 0,
    grounded: false,
    coyoteRemaining: 0,
    canJump: false,
    jumpHeld: false,
  }
}

/**
 * Advance the capsule by one fixed step.
 *
 * `groundHeight` is the world Y of the ground directly beneath the capsule, or
 * `null` when there is no ground below (the capsule falls freely). The order
 * within a step is: horizontal move → jump (uses *last* step's grounded/coyote
 * status) → gravity integrate → ground resolve → coyote bookkeeping. Jumping off
 * the prior frame's status is what makes coyote-time feel responsive.
 */
export function stepMovement(
  state: MovementState,
  input: MovementInput,
  groundHeight: number | null,
  params: MovementParams,
  dt: number,
): MovementState {
  // 1. Horizontal locomotion. `dir` is already a unit-or-shorter world vector,
  //    so multiplying by the scalar speed gives the per-step displacement.
  const speed = input.sprint ? params.sprintSpeed : params.walkSpeed
  const posX = state.posX + input.dirX * speed * dt
  const posZ = state.posZ + input.dirZ * speed * dt

  // 2. Jump on the rising edge of the held flag, gated by the no-double-jump
  //    guard and either being grounded or inside the coyote window.
  const jumpEdge = input.jump && !state.jumpHeld
  const mayJump = state.canJump && (state.grounded || state.coyoteRemaining > 0)
  const jumped = jumpEdge && mayJump

  let velY = jumped ? params.jumpSpeed : state.velY
  let canJump = jumped ? false : state.canJump

  // 3. Gravity integration.
  velY -= params.gravity * dt
  let posY = state.posY + velY * dt

  // 4. Ground resolution. The feet target is the capsule origin Y at which the
  //    feet rest exactly on the ground. We clamp only when descending so an
  //    upward jump arc is never cut short by the ground we just left.
  let grounded = false
  if (groundHeight !== null && velY <= 0) {
    const feetTarget = groundHeight + params.capsuleHalfHeight
    if (posY <= feetTarget) {
      posY = feetTarget
      velY = 0
      grounded = true
      canJump = true
    }
  }

  // 5. Coyote bookkeeping. Refill while grounded; otherwise count down so the
  //    grace window starts full on the first airborne step after a ledge.
  const coyoteRemaining = grounded
    ? params.coyoteTime
    : Math.max(0, state.coyoteRemaining - dt)

  return {
    posX,
    posY,
    posZ,
    velY,
    grounded,
    coyoteRemaining,
    canJump,
    jumpHeld: input.jump,
  }
}
