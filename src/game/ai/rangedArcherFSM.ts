/**
 * Pure FSM for the ranged Empire archer (FLO-432).
 *
 * This reuses the soldier FSM *scaffolding* — the same patrol→engage→dead phase
 * machine, the same `HealthState` damage funnel (`createHealth`/`applyDamage`/
 * `isAlive`), the same seed-free golden-angle patrol wander and spawn-anchor
 * leash (FLO-412) — rather than introducing a new AI engine. What differs is the
 * engage behaviour: instead of closing to melee range, the archer *keeps its
 * distance* (kites away when the player crowds it, edges closer when out of
 * range) and looses an arrow on a cooldown, but only when it has a clear line of
 * sight. The projectile itself lives in `src/game/combat/projectile.ts`; this
 * module only decides *when* and *which way* to fire.
 */
import { applyDamage, createHealth, isAlive, type HealthState } from '../health'
import type { Vec3 } from '../combat'

export type ArcherPhase = 'patrol' | 'engage' | 'dead'

export interface ArcherFSMState {
  phase: ArcherPhase
  health: HealthState
  /** Seconds until the next shot is allowed. */
  attackCooldown: number
  /** Patrol: seconds until wander direction changes. */
  patrolTimer: number
  /** Patrol wander direction (x, z), normalised. */
  patrolDirX: number
  patrolDirZ: number
}

export interface ArcherFSMParams {
  maxHp: number
  /** Metres — player inside this triggers engage (archers see further than melee). */
  detectionRadius: number
  /** Metres — player must be within this to be shot at. */
  engageRange: number
  /** Metres — the standoff distance the archer tries to hold. */
  preferredRange: number
  /** Metres — player closer than this and the archer back-pedals (kite). */
  minRange: number
  /** HP dealt to the player per arrow. */
  attackDamage: number
  /** Seconds between shots (draw + nock time). */
  attackCooldown: number
  /** m/s patrol speed. */
  patrolSpeed: number
  /** m/s repositioning speed (kiting / closing the gap). */
  repositionSpeed: number
  /** Seconds between patrol direction changes. */
  patrolChangeDirInterval: number
  /** Metres — a patrolling archer stays within this radius of its spawn anchor (FLO-412). */
  patrolLeashRadius: number
  /** m/s arrow muzzle speed handed to the spawned projectile. */
  projectileSpeed: number
}

export const DEFAULT_ARCHER_PARAMS: ArcherFSMParams = {
  maxHp: 40, // squishier than the 60-HP soldier — a glass-cannon skirmisher
  detectionRadius: 15,
  engageRange: 12,
  preferredRange: 8,
  minRange: 5,
  attackDamage: 12,
  attackCooldown: 2.0,
  patrolSpeed: 1.2,
  repositionSpeed: 2.4,
  patrolChangeDirInterval: 3.0,
  patrolLeashRadius: 6,
  projectileSpeed: 20,
}

export function createArcherFSM(params: ArcherFSMParams = DEFAULT_ARCHER_PARAMS): ArcherFSMState {
  return {
    phase: 'patrol',
    health: createHealth(params.maxHp),
    attackCooldown: 0,
    patrolTimer: 0,
    patrolDirX: 1,
    patrolDirZ: 0,
  }
}

function dist2d(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  return Math.sqrt(dx * dx + dz * dz)
}

export interface ArcherStepResult {
  state: ArcherFSMState
  /** Movement delta this tick (m). */
  moveDX: number
  moveDZ: number
  /** True if the archer loosed an arrow this tick — caller spawns the projectile. */
  fired: boolean
  /** Normalised XZ aim direction toward the player (the arrow's heading). */
  aimDirX: number
  aimDirZ: number
}

export interface ArcherStepOptions {
  /**
   * Whether the archer can currently see the player. When false the archer holds
   * fire and repositions to regain the shot. Defaults to `true` (open ground).
   */
  hasLineOfSight?: boolean
  /** Deterministic patrol dir override (x, z). Random in prod, injected in tests. */
  nextPatrolDir?: [number, number]
  /** Optional spawn anchor (XZ) — patrol is leashed around it (FLO-412). */
  anchorPos?: Vec3
}

/**
 * Advance the archer state machine by `dt` seconds. `archerPos` and `playerPos`
 * are XZ positions (Y ignored for transitions). Returns the new state plus the
 * movement, aim, and fire signals the caller applies.
 */
export function stepArcherFSM(
  state: ArcherFSMState,
  archerPos: Vec3,
  playerPos: Vec3,
  dt: number,
  params: ArcherFSMParams = DEFAULT_ARCHER_PARAMS,
  options: ArcherStepOptions = {},
): ArcherStepResult {
  const hasLineOfSight = options.hasLineOfSight ?? true

  // Aim always points from the archer to the player (used for firing + facing).
  const toX = playerPos.x - archerPos.x
  const toZ = playerPos.z - archerPos.z
  const toLen = Math.sqrt(toX * toX + toZ * toZ)
  const aimDirX = toLen === 0 ? 0 : toX / toLen
  const aimDirZ = toLen === 0 ? 0 : toZ / toLen

  if (state.phase === 'dead') {
    return { state, moveDX: 0, moveDZ: 0, fired: false, aimDirX, aimDirZ }
  }

  let { phase, health, attackCooldown, patrolTimer, patrolDirX, patrolDirZ } = state
  let moveDX = 0
  let moveDZ = 0
  let fired = false

  attackCooldown = Math.max(0, attackCooldown - dt)

  const d = toLen

  // ── Phase transitions ──────────────────────────────────────────────────
  if (phase === 'patrol') {
    if (d <= params.detectionRadius) phase = 'engage'
  } else if (phase === 'engage') {
    // Hysteresis on de-aggro so the archer doesn't flicker at the edge.
    if (d > params.detectionRadius * 1.3) phase = 'patrol'
  }

  // ── Phase behaviours ───────────────────────────────────────────────────
  if (phase === 'patrol') {
    patrolTimer -= dt
    const anchorPos = options.anchorPos
    const anchorDist = anchorPos
      ? dist2d(archerPos.x, archerPos.z, anchorPos.x, anchorPos.z)
      : 0
    if (anchorPos && anchorDist > params.patrolLeashRadius) {
      // Leash home so a patrol never drifts into the player's safe-spawn buffer.
      const len = anchorDist || 1
      patrolDirX = (anchorPos.x - archerPos.x) / len
      patrolDirZ = (anchorPos.z - archerPos.z) / len
      patrolTimer = params.patrolChangeDirInterval
    } else if (patrolTimer <= 0) {
      patrolTimer = params.patrolChangeDirInterval
      if (options.nextPatrolDir) {
        ;[patrolDirX, patrolDirZ] = options.nextPatrolDir
      } else {
        // Seed-free golden-angle wander (matches the soldier FSM, FLO-412).
        const prev = Math.atan2(patrolDirZ, patrolDirX)
        const angle = prev + 2.399963229728653
        patrolDirX = Math.cos(angle)
        patrolDirZ = Math.sin(angle)
      }
    }
    moveDX = patrolDirX * params.patrolSpeed * dt
    moveDZ = patrolDirZ * params.patrolSpeed * dt
  } else if (phase === 'engage') {
    // Standoff kiting: hold `preferredRange`. Too close → back-pedal; too far (or
    // no clear shot) → edge in to close the gap / regain line of sight.
    if (d > 0 && d < params.minRange) {
      moveDX = -aimDirX * params.repositionSpeed * dt
      moveDZ = -aimDirZ * params.repositionSpeed * dt
    } else if (d > params.preferredRange || !hasLineOfSight) {
      moveDX = aimDirX * params.repositionSpeed * dt
      moveDZ = aimDirZ * params.repositionSpeed * dt
    }

    // Fire only with a clear shot, off cooldown, and inside engage range.
    if (hasLineOfSight && attackCooldown <= 0 && d <= params.engageRange) {
      fired = true
      attackCooldown = params.attackCooldown
    }
  }

  return {
    state: { phase, health, attackCooldown, patrolTimer, patrolDirX, patrolDirZ },
    moveDX,
    moveDZ,
    fired,
    aimDirX,
    aimDirZ,
  }
}

/**
 * Apply incoming damage to the archer. Returns updated state; transitions to
 * `dead` once HP hits zero. Caller-driven, exactly like the soldier funnel.
 */
export function applyDamageToArcher(state: ArcherFSMState, amount: number): ArcherFSMState {
  const health = applyDamage(state.health, amount)
  const phase = isAlive(health) ? state.phase : 'dead'
  return { ...state, health, phase }
}
