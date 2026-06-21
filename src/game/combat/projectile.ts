/**
 * Pure projectile model for ranged combat (FLO-432).
 *
 * An archer's arrow is a small kinematic body: it travels in a straight line,
 * decays after a time-to-live, and on contact with a {@link Damageable} reports
 * an impact the caller funnels through the *exact same* damage path as melee
 * (`target.takeDamage` + the `damageEvents` juice bridge). Keeping the model pure
 * — no Babylon, no side effects — makes the hit geometry and the projectile
 * *budget cap* unit-testable without a GL context. The Babylon side
 * (`src/scenes/arrowVolley.ts`) owns only the meshes.
 *
 * Budget is real: a {@link ProjectileField} never holds more than `cap` live
 * arrows, so a runaway fire rate can't grow the frame cost unbounded — excess
 * spawns are dropped (the field is already saturated with threats).
 */
import type { Damageable, Vec3 } from './meleeAttack'

export interface Projectile {
  /** World position (metres). */
  readonly x: number
  readonly y: number
  readonly z: number
  /** Velocity (metres / second). */
  readonly vx: number
  readonly vy: number
  readonly vz: number
  /** HP dealt on contact. */
  readonly damage: number
  /** Seconds of life remaining; the arrow despawns at or below zero. */
  readonly ttl: number
  /** Cleared once the arrow has hit something or expired. */
  readonly alive: boolean
}

/** Default arrow muzzle speed (m/s). */
export const DEFAULT_PROJECTILE_SPEED = 20
/** Default seconds an arrow lives before despawning (caps travel distance). */
export const DEFAULT_PROJECTILE_TTL = 3
/** Default contact radius (m) — arrow point vs target capsule. */
export const DEFAULT_PROJECTILE_HIT_RADIUS = 0.7
/** Frame-budget cap on concurrent live arrows across the whole field. */
export const MAX_LIVE_PROJECTILES = 24

export interface CreateProjectileOptions {
  readonly speed?: number
  readonly damage?: number
  readonly ttl?: number
}

/**
 * Spawn an arrow at `origin` heading along `dir` (need not be normalised — a
 * zero-length direction yields a stationary, immediately-decaying arrow).
 */
export function createProjectile(
  origin: Vec3,
  dir: Vec3,
  options: CreateProjectileOptions = {},
): Projectile {
  const {
    speed = DEFAULT_PROJECTILE_SPEED,
    damage = 0,
    ttl = DEFAULT_PROJECTILE_TTL,
  } = options
  const len = Math.hypot(dir.x, dir.y, dir.z)
  const inv = len === 0 ? 0 : speed / len
  return {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: dir.x * inv,
    vy: dir.y * inv,
    vz: dir.z * inv,
    damage,
    ttl,
    alive: true,
  }
}

/** Advance a single arrow by `dt`; clears `alive` once its ttl runs out. */
export function stepProjectile(p: Projectile, dt: number): Projectile {
  const ttl = p.ttl - dt
  return {
    ...p,
    x: p.x + p.vx * dt,
    y: p.y + p.vy * dt,
    z: p.z + p.vz * dt,
    ttl,
    alive: p.alive && ttl > 0,
  }
}

export interface ProjectileField {
  readonly projectiles: readonly Projectile[]
  /** Maximum concurrent live arrows (budget cap). */
  readonly cap: number
}

export function createProjectileField(cap: number = MAX_LIVE_PROJECTILES): ProjectileField {
  return { projectiles: [], cap: Math.max(0, Math.floor(cap)) }
}

/**
 * Add an arrow to the field. When the field is already at `cap` the new arrow is
 * dropped (returns the field unchanged) — the budget is a hard ceiling, not a
 * FIFO ring, because the player is already under maximum fire.
 */
export function spawnProjectile(field: ProjectileField, p: Projectile): ProjectileField {
  if (field.projectiles.length >= field.cap) return field
  return { ...field, projectiles: [...field.projectiles, p] }
}

export interface ProjectileImpact {
  readonly target: Damageable
  readonly damage: number
}

export interface StepProjectileFieldResult {
  readonly field: ProjectileField
  /** Impacts this tick — caller applies `target.takeDamage` + damage juice. */
  readonly impacts: readonly ProjectileImpact[]
}

function dist3dSq(a: Vec3, bx: number, by: number, bz: number): number {
  const dx = a.x - bx
  const dy = a.y - by
  const dz = a.z - bz
  return dx * dx + dy * dy + dz * dz
}

/**
 * Advance every arrow, resolve contacts against `targets`, and drop arrows that
 * hit or expired. An arrow hits the first living target within `hitRadius`;
 * mirroring `getMeleeHits`, this reports impacts rather than mutating the target,
 * so the caller drives `takeDamage` + the `damageEvents` bridge on one code path.
 * Pass only living targets (the scene filters dead enemies, as the melee loop does).
 */
export function stepProjectileField(
  field: ProjectileField,
  dt: number,
  targets: readonly Damageable[],
  hitRadius: number = DEFAULT_PROJECTILE_HIT_RADIUS,
): StepProjectileFieldResult {
  const rSq = hitRadius * hitRadius
  const survivors: Projectile[] = []
  const impacts: ProjectileImpact[] = []

  for (const prev of field.projectiles) {
    const p = stepProjectile(prev, dt)
    if (!p.alive) continue // expired this tick — despawn silently

    let hit: Damageable | null = null
    for (const t of targets) {
      if (dist3dSq(t.position, p.x, p.y, p.z) <= rSq) {
        hit = t
        break
      }
    }
    if (hit) {
      impacts.push({ target: hit, damage: p.damage })
      continue // arrow is consumed by the hit
    }
    survivors.push(p)
  }

  return { field: { ...field, projectiles: survivors }, impacts }
}
