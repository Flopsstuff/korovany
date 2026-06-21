import { applyDamage, createHealth, isAlive, type HealthState } from '../health'
import type { Vec3 } from '../combat'
import type { SoldierOrder } from './orders'

export type SoldierPhase =
  | 'patrol'
  | 'chase'
  | 'attack'
  | 'follow'
  | 'hold'
  | 'move-to'
  | 'attack-target'
  | 'dead'

export interface SoldierFSMState {
  phase: SoldierPhase
  health: HealthState
  /** Seconds until next attack is allowed. */
  attackCooldown: number
  /** Patrol: seconds until direction changes. */
  patrolTimer: number
  /** Patrol wander direction (x, z), normalised. */
  patrolDirX: number
  patrolDirZ: number
}

export interface SoldierFSMParams {
  maxHp: number
  /** Metres — player inside this triggers chase. */
  detectionRadius: number
  /** Metres — player inside this triggers attack. */
  attackRadius: number
  /** HP dealt to the player per hit. */
  attackDamage: number
  /** Seconds between attacks. */
  attackCooldown: number
  /** m/s patrol speed. */
  patrolSpeed: number
  /** m/s chase speed. */
  chaseSpeed: number
  /** Seconds between patrol direction changes. */
  patrolChangeDirInterval: number
  /**
   * Metres — a patrolling soldier stays within this radius of its spawn anchor.
   * Once it wanders past the leash it steers straight back, so a patrol guards
   * its post instead of drifting unbounded across the map (FLO-412). Only
   * enforced when an `anchorPos` is passed to `stepSoldierFSM`.
   */
  patrolLeashRadius: number
  /** Metres — follower stops once this close to its commander. */
  followDistance: number
  /** Metres — move-to order completes inside this radius. */
  moveToArrivalRadius: number
}

export const DEFAULT_SOLDIER_PARAMS: SoldierFSMParams = {
  maxHp: 60,
  detectionRadius: 10,
  attackRadius: 1.8,
  attackDamage: 15,
  attackCooldown: 1.5,
  patrolSpeed: 1.5,
  chaseSpeed: 3.0,
  patrolChangeDirInterval: 3.0,
  patrolLeashRadius: 6,
  followDistance: 2.5,
  moveToArrivalRadius: 0.35,
}

export function createSoldierFSM(params: SoldierFSMParams = DEFAULT_SOLDIER_PARAMS): SoldierFSMState {
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

export interface SoldierStepResult {
  state: SoldierFSMState
  /** Movement delta this tick (m). */
  moveDX: number
  moveDZ: number
  /** True if the soldier attacked this tick — caller deals attackDamage to player. */
  attacked: boolean
  /** Distinguishes default player aggro from an explicit attack-target order. */
  attackedTarget: 'player' | 'order-target' | null
}

export interface SoldierOrderContext {
  readonly order: SoldierOrder | null
  readonly leaderPos?: Vec3
  readonly targetPos?: Vec3
  readonly targetAlive?: boolean
}

/**
 * Advance the soldier state machine by `dt` seconds.
 * `soldierPos` and `playerPos` are XZ positions (Y ignored for state transitions).
 * Returns the new state plus movement and attack signals the caller must apply.
 */
export function stepSoldierFSM(
  state: SoldierFSMState,
  soldierPos: Vec3,
  playerPos: Vec3,
  dt: number,
  params: SoldierFSMParams = DEFAULT_SOLDIER_PARAMS,
  /** Deterministic patrol dir override (x, z). Optional: random in prod, injected in tests. */
  nextPatrolDir?: [number, number],
  /** Optional trusted order context; order legality is validated before intake. */
  orderContext?: SoldierOrderContext,
  /**
   * Optional spawn anchor (XZ). When supplied, patrol movement is leashed to
   * `params.patrolLeashRadius` around it so the soldier never drifts off its
   * post into the player's safe-spawn buffer (FLO-412).
   */
  anchorPos?: Vec3,
): SoldierStepResult {
  if (state.phase === 'dead') {
    return { state, moveDX: 0, moveDZ: 0, attacked: false, attackedTarget: null }
  }

  const d = dist2d(soldierPos.x, soldierPos.z, playerPos.x, playerPos.z)
  let { phase, health, attackCooldown, patrolTimer, patrolDirX, patrolDirZ } = state
  let moveDX = 0
  let moveDZ = 0
  let attacked = false
  let attackedTarget: SoldierStepResult['attackedTarget'] = null

  attackCooldown = Math.max(0, attackCooldown - dt)

  if (orderContext?.order) {
    const order = orderContext.order
    if (order.type === 'hold') {
      phase = 'hold'
    } else if (order.type === 'follow') {
      phase = 'follow'
      if (orderContext.leaderPos) {
        const movement = moveToward(soldierPos, orderContext.leaderPos, params.chaseSpeed, dt, params.followDistance)
        moveDX = movement.x
        moveDZ = movement.z
      }
    } else if (order.type === 'move-to') {
      const movement = moveToward(soldierPos, order.destination, params.chaseSpeed, dt, params.moveToArrivalRadius)
      phase = movement.arrived ? 'hold' : 'move-to'
      moveDX = movement.x
      moveDZ = movement.z
    } else {
      if (orderContext.targetAlive === false || !orderContext.targetPos) {
        phase = 'hold'
      } else {
        const targetDistance = dist2d(soldierPos.x, soldierPos.z, orderContext.targetPos.x, orderContext.targetPos.z)
        if (targetDistance <= params.attackRadius) {
          phase = 'attack-target'
          if (attackCooldown <= 0) {
            attacked = true
            attackedTarget = 'order-target'
            attackCooldown = params.attackCooldown
          }
        } else {
          phase = 'attack-target'
          const movement = moveToward(soldierPos, orderContext.targetPos, params.chaseSpeed, dt, params.attackRadius)
          moveDX = movement.x
          moveDZ = movement.z
        }
      }
    }

    return {
      state: { phase, health, attackCooldown, patrolTimer, patrolDirX, patrolDirZ },
      moveDX,
      moveDZ,
      attacked,
      attackedTarget,
    }
  }

  if (phase === 'follow' || phase === 'hold' || phase === 'move-to' || phase === 'attack-target') {
    phase = 'patrol'
  }

  // ── Phase transitions ──────────────────────────────────────────────────
  if (phase === 'patrol') {
    if (d <= params.detectionRadius) phase = 'chase'
  } else if (phase === 'chase') {
    if (d <= params.attackRadius) {
      phase = 'attack'
    } else if (d > params.detectionRadius * 1.3) {
      phase = 'patrol'
    }
  } else if (phase === 'attack') {
    if (d > params.attackRadius * 1.5) phase = 'chase'
  }

  // ── Phase behaviours ───────────────────────────────────────────────────
  if (phase === 'patrol') {
    patrolTimer -= dt
    // Leash: if the soldier has wandered past its post, head straight back so a
    // patrol never drifts into the player's safe-spawn buffer (FLO-412). The
    // leash overrides the wander so it takes priority over the timer below.
    const anchorDist = anchorPos
      ? dist2d(soldierPos.x, soldierPos.z, anchorPos.x, anchorPos.z)
      : 0
    if (anchorPos && anchorDist > params.patrolLeashRadius) {
      const len = anchorDist || 1
      patrolDirX = (anchorPos.x - soldierPos.x) / len
      patrolDirZ = (anchorPos.z - soldierPos.z) / len
      // Hold this heading until we're back near the post before re-rolling.
      patrolTimer = params.patrolChangeDirInterval
    } else if (patrolTimer <= 0) {
      patrolTimer = params.patrolChangeDirInterval
      if (nextPatrolDir) {
        ;[patrolDirX, patrolDirZ] = nextPatrolDir
      } else {
        // Deterministic wander: rotate the current heading by the golden angle.
        // Seed-free (no Date.now()) so behaviour is reproducible in tests and CI
        // while still spreading directions evenly over many turns (FLO-412).
        const prev = Math.atan2(patrolDirZ, patrolDirX)
        const angle = prev + 2.399963229728653 // golden angle (rad)
        patrolDirX = Math.cos(angle)
        patrolDirZ = Math.sin(angle)
      }
    }
    moveDX = patrolDirX * params.patrolSpeed * dt
    moveDZ = patrolDirZ * params.patrolSpeed * dt
  } else if (phase === 'chase') {
    const dx = playerPos.x - soldierPos.x
    const dz = playerPos.z - soldierPos.z
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len > 0) {
      moveDX = (dx / len) * params.chaseSpeed * dt
      moveDZ = (dz / len) * params.chaseSpeed * dt
    }
  } else if (phase === 'attack') {
    if (attackCooldown <= 0) {
      attacked = true
      attackedTarget = 'player'
      attackCooldown = params.attackCooldown
    }
  }

  return {
    state: { phase, health, attackCooldown, patrolTimer, patrolDirX, patrolDirZ },
    moveDX,
    moveDZ,
    attacked,
    attackedTarget,
  }
}

function moveToward(
  from: Vec3,
  to: Vec3,
  speed: number,
  dt: number,
  stopDistance: number,
): { x: number; z: number; arrived: boolean } {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len <= stopDistance || len === 0) return { x: 0, z: 0, arrived: true }
  const travel = Math.min(speed * dt, len - stopDistance)
  return {
    x: (dx / len) * travel,
    z: (dz / len) * travel,
    arrived: false,
  }
}

/**
 * Apply incoming damage to the soldier. Returns updated state.
 * The caller (melee hit loop) drives this — the FSM itself does not poll for damage.
 */
export function applyDamageToSoldier(
  state: SoldierFSMState,
  amount: number,
): SoldierFSMState {
  const health = applyDamage(state.health, amount)
  const phase = isAlive(health) ? state.phase : 'dead'
  return { ...state, health, phase }
}
