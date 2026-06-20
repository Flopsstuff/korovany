/** Phases of one melee swing. */
export type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery'

export interface MeleeAttackState {
  phase: AttackPhase
  /** Seconds remaining in the current phase. */
  phaseTimer: number
  /** True during the active frame window — callers use this to query hits. */
  hitWindowOpen: boolean
}

export interface MeleeAttackParams {
  windupDuration: number   // s — charge before hitbox goes live
  activeDuration: number   // s — hitbox is live
  recoveryDuration: number // s — cooldown before next attack
}

export const DEFAULT_MELEE_PARAMS: MeleeAttackParams = {
  windupDuration: 0.15,
  activeDuration: 0.10,
  recoveryDuration: 0.25,
}

export function createMeleeAttack(): MeleeAttackState {
  return { phase: 'idle', phaseTimer: 0, hitWindowOpen: false }
}

/**
 * Advance the melee state machine by `dt` seconds.
 * `attackPressed` is the rising-edge signal (true only on the first frame the
 * key is held, not while it stays held).
 */
export function stepMeleeAttack(
  state: MeleeAttackState,
  attackPressed: boolean,
  dt: number,
  params: MeleeAttackParams = DEFAULT_MELEE_PARAMS,
): MeleeAttackState {
  let { phase, phaseTimer } = state

  if (phase === 'idle') {
    if (attackPressed) {
      return { phase: 'windup', phaseTimer: params.windupDuration, hitWindowOpen: false }
    }
    return { phase: 'idle', phaseTimer: 0, hitWindowOpen: false }
  }

  phaseTimer = Math.max(0, phaseTimer - dt)

  if (phase === 'windup') {
    if (phaseTimer <= 0) {
      return { phase: 'active', phaseTimer: params.activeDuration, hitWindowOpen: true }
    }
    return { phase: 'windup', phaseTimer, hitWindowOpen: false }
  }

  if (phase === 'active') {
    if (phaseTimer <= 0) {
      return { phase: 'recovery', phaseTimer: params.recoveryDuration, hitWindowOpen: false }
    }
    return { phase: 'active', phaseTimer, hitWindowOpen: true }
  }

  // recovery
  if (phaseTimer <= 0) {
    return { phase: 'idle', phaseTimer: 0, hitWindowOpen: false }
  }
  return { phase: 'recovery', phaseTimer, hitWindowOpen: false }
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Damageable {
  position: Vec3
  takeDamage(amount: number): void
}

/**
 * Query which targets are in the melee hit zone.
 * Only meaningful when `state.hitWindowOpen` is true — call this once per
 * active-window tick and dispatch damage for each returned target.
 *
 * Hit zone: sphere of `radius` metres centred on `casterPos`, restricted to
 * targets within `halfArcDeg` degrees of `casterForward` (the look direction).
 */
export function getMeleeHits(
  state: MeleeAttackState,
  casterPos: Vec3,
  casterForward: Vec3,
  targets: Damageable[],
  radius = 2.0,
  halfArcDeg = 60,
): Damageable[] {
  if (!state.hitWindowOpen) return []

  const halfArcRad = (halfArcDeg * Math.PI) / 180
  const cosThreshold = Math.cos(halfArcRad)

  return targets.filter((t) => {
    const dx = t.position.x - casterPos.x
    const dy = t.position.y - casterPos.y
    const dz = t.position.z - casterPos.z
    const distSq = dx * dx + dy * dy + dz * dz
    if (distSq > radius * radius) return false

    // Dot product with normalised casterForward (forward is assumed unit-length)
    const fwdLen = Math.sqrt(
      casterForward.x * casterForward.x +
        casterForward.y * casterForward.y +
        casterForward.z * casterForward.z,
    )
    if (fwdLen === 0) return true // degenerate forward — hit everything in range

    const dist = Math.sqrt(distSq)
    if (dist === 0) return true

    const dot =
      (dx * casterForward.x + dy * casterForward.y + dz * casterForward.z) / (dist * fwdLen)
    return dot >= cosThreshold
  })
}
