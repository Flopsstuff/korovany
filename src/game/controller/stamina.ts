// Pure, engine-agnostic sprint-stamina state machine.
//
// Stamina is authoritative in the engine (the character controller advances it
// every fixed step) and only *pushed* to Redux for HUD display — dispatching
// 60×/s into Redux as the source of truth would churn React for no reason
// (lens: budgets are real + trust the boundary). This module holds the math:
// drain while sprinting, regen after an idle delay, and a hysteresis lock-out
// at empty so a tapped sprint key cannot stutter on/off at zero.
//
// It mirrors the `stepMovement` pure-fn pattern so it is unit-testable headless
// (no Babylon, no DOM).

/** Tunable stamina constants. All rates are stamina-units/second. */
export interface StaminaParams {
  /** Full stamina pool. */
  readonly max: number
  /** Drain per second while sprint is active. */
  readonly drainRate: number
  /** Regen per second once the idle delay has elapsed. */
  readonly regenRate: number
  /** Idle seconds after sprinting before regen begins. */
  readonly regenDelay: number
  /**
   * Hysteresis floor: once stamina hits 0 sprint is locked out until it regens
   * strictly above this threshold. Prevents stutter-sprint at empty.
   */
  readonly reEnableThreshold: number
}

/**
 * Defaults: 100 pool, 25/s drain (≈4 s of sprint from full), 15/s regen after a
 * 0.5 s idle delay, sprint re-enabled once regen passes 15.
 */
export const DEFAULT_STAMINA_PARAMS: StaminaParams = {
  max: 100,
  drainRate: 25,
  regenRate: 15,
  regenDelay: 0.5,
  reEnableThreshold: 15,
}

/** The state machine's per-step state. Treated as immutable by `stepStamina`. */
export interface StaminaState {
  /** Current stamina, 0..max. */
  readonly stamina: number
  /** Seconds remaining before regen resumes (refilled to `regenDelay` while sprinting). */
  readonly regenCountdown: number
  /**
   * Hysteresis lock-out: true once stamina reached 0, cleared only when stamina
   * regens above `reEnableThreshold`. While true, sprint is unavailable.
   */
  readonly exhausted: boolean
}

/**
 * The result of one step: the next {@link StaminaState} plus the derived
 * `sprintActive` flag the controller feeds to `stepMovement`. The whole object
 * is a valid `StaminaState`, so callers can store it directly as the next state.
 */
export interface StaminaResult extends StaminaState {
  /** Effective sprint this step: intent held AND stamina available. */
  readonly sprintActive: boolean
}

/** A fresh, full stamina pool — not exhausted, regen idle. */
export function createStaminaState(params: StaminaParams = DEFAULT_STAMINA_PARAMS): StaminaState {
  return { stamina: params.max, regenCountdown: 0, exhausted: false }
}

/**
 * Advance the stamina pool by one fixed step.
 *
 * `sprintingIntent` is the raw sprint key/button this step; the returned
 * `sprintActive` is the *effective* sprint after the pool and the exhaustion
 * lock-out are applied. When sprint is active the pool drains and the regen
 * delay is held full; otherwise the delay counts down and, once elapsed, the
 * pool regens. Reaching 0 sets the exhaustion lock-out, which clears only after
 * regen carries the pool above `reEnableThreshold` (hysteresis).
 */
export function stepStamina(
  state: StaminaState,
  sprintingIntent: boolean,
  dt: number,
  params: StaminaParams = DEFAULT_STAMINA_PARAMS,
): StaminaResult {
  let { stamina, regenCountdown, exhausted } = state

  // Effective sprint requires intent, a non-empty pool, and no active lock-out.
  const sprintActive = sprintingIntent && !exhausted && stamina > 0

  if (sprintActive) {
    stamina = Math.max(0, stamina - params.drainRate * dt)
    regenCountdown = params.regenDelay
    if (stamina <= 0) {
      stamina = 0
      exhausted = true
    }
  } else {
    if (regenCountdown > 0) {
      regenCountdown = Math.max(0, regenCountdown - dt)
    } else {
      stamina = Math.min(params.max, stamina + params.regenRate * dt)
    }
    // Hysteresis: lift the lock-out only once we have a usable buffer again.
    if (exhausted && stamina > params.reEnableThreshold) {
      exhausted = false
    }
  }

  return { stamina, regenCountdown, exhausted, sprintActive }
}
