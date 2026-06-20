/**
 * Pure, engine-agnostic health & damage model.
 *
 * No Babylon, React, or Redux here — just immutable `HealthState` values and
 * the functions that transform them. Combat, NPCs, and the save system all
 * build on this. See `docs/guide/architecture.md`.
 */

/** Default maximum HP for the player when no save dictates otherwise. */
export const DEFAULT_MAX_HP = 100

/** Immutable snapshot of an entity's health. */
export interface HealthState {
  /** Current hit points, clamped to `[0, maxHp]`. */
  readonly currentHp: number
  /** Maximum hit points (always `>= 1`). */
  readonly maxHp: number
  /** Convenience flag mirroring `currentHp > 0`. */
  readonly alive: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Build a valid `HealthState`. `maxHp` is forced to at least 1 and `currentHp`
 * is clamped into `[0, maxHp]`. `alive` is derived, never stored independently.
 */
export function createHealth(maxHp: number = DEFAULT_MAX_HP, currentHp: number = maxHp): HealthState {
  const clampedMax = Math.max(1, Math.floor(maxHp))
  const clampedCurrent = clamp(currentHp, 0, clampedMax)
  return { currentHp: clampedCurrent, maxHp: clampedMax, alive: clampedCurrent > 0 }
}

/** True while the entity has hit points remaining. */
export function isAlive(state: HealthState): boolean {
  return state.currentHp > 0
}

/**
 * Apply `amount` of damage. Negative amounts are ignored (use `healDamage` to
 * heal). Current HP is clamped to 0; `alive` follows.
 */
export function applyDamage(state: HealthState, amount: number): HealthState {
  const damage = Math.max(0, amount)
  const currentHp = Math.max(0, state.currentHp - damage)
  return { ...state, currentHp, alive: currentHp > 0 }
}

/**
 * Heal by `amount`. Negative amounts are ignored (use `applyDamage` to damage).
 * Current HP is clamped to `maxHp`; `alive` follows.
 */
export function healDamage(state: HealthState, amount: number): HealthState {
  const heal = Math.max(0, amount)
  const currentHp = Math.min(state.maxHp, state.currentHp + heal)
  return { ...state, currentHp, alive: currentHp > 0 }
}
