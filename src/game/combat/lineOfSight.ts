/**
 * Pure 2D line-of-sight test (FLO-432).
 *
 * A ranged enemy only looses an arrow when nothing solid sits between it and its
 * target. Obstacles are modelled as XZ circles (tree trunks, hut footprints,
 * landmark greyboxes) — the same flat-footprint abstraction the forest scatter
 * already uses. The test is a segment-vs-circle intersection on the ground plane;
 * height is deliberately ignored (everything is treated as a full-height pillar),
 * which is the conservative choice for "can I see you" and keeps the check cheap
 * and engine-agnostic so it is unit-testable without a GL context.
 */
import type { Vec3 } from './meleeAttack'

/** A sight-blocking circle on the XZ ground plane. */
export interface SightObstacle {
  readonly x: number
  readonly z: number
  /** Blocking radius in metres. */
  readonly radius: number
}

/**
 * Squared distance from point (px,pz) to the segment a→b, on the XZ plane.
 * Returns the nearest approach so a single `<= r²` compare decides a hit.
 */
function distSqPointToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax
  const abz = bz - az
  const lenSq = abx * abx + abz * abz
  // Degenerate segment (from === to): fall back to point distance.
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (pz - az) * abz) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * abx
  const cz = az + t * abz
  const dx = px - cx
  const dz = pz - cz
  return dx * dx + dz * dz
}

/**
 * True when the straight line from `from` to `to` clears every obstacle. An
 * empty obstacle list (open ground) is always clear. `padding` inflates each
 * obstacle radius, e.g. to account for the projectile's own girth.
 */
export function lineOfSightClear(
  from: Vec3,
  to: Vec3,
  obstacles: readonly SightObstacle[],
  padding = 0,
): boolean {
  for (const o of obstacles) {
    const r = o.radius + padding
    if (distSqPointToSegment(o.x, o.z, from.x, from.z, to.x, to.z) <= r * r) {
      return false
    }
  }
  return true
}
