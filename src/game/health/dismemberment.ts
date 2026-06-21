/**
 * Combat → dismemberment resolver (E6.1.2).
 *
 * Pure, engine-agnostic decision layer that turns a combat hit into an optional
 * limb severance. It owns *whether* and *which* limb a hit takes off; applying
 * the result (dispatching `severPlayerLimb`, firing feedback) is the caller's
 * job — see `GameCanvas.onPlayerDamaged`.
 *
 * Design (boring + testable):
 *   - Light hits never dismember; the chance ramps with damage above a
 *     threshold and is capped so even a huge hit is never a guaranteed sever.
 *   - Only *intact* limbs can be lost; once every slot is gone the roll is a
 *     no-op (the player is already maximally maimed).
 *   - Randomness is injected as an {@link Rng} so combat is unit-testable; the
 *     wiring passes a plain `Math.random`-backed generator (reproducibility is
 *     not required for hit-by-hit combat — see `seededRandom.ts`).
 *
 * The three canonical outcomes themselves (bleed-out, half-screen blackout,
 * crawl) live in `injuryModel.ts` and fire automatically off the resulting
 * `InjuryState`; this module only decides what gets severed.
 */

import type { InjuryState, Limb } from './injuryModel'
import { LIMBS } from './injuryModel'
import type { Rng } from '../util/rng'
import { pick } from '../util/rng'

/**
 * Hit damage (HP) below which a hit can never dismember. Raised in P7.2 (from
 * 15) so ordinary blows in the spawn area can't lop a limb off a fresh player —
 * dismemberment is reserved for genuinely heavy hits.
 */
export const DISMEMBER_DAMAGE_THRESHOLD = 20
/** Dismemberment probability for a hit exactly at the threshold. */
export const DISMEMBER_BASE_CHANCE = 0.05
/** Extra probability per HP of damage above the threshold. */
export const DISMEMBER_CHANCE_PER_DAMAGE = 0.01
/**
 * Ceiling on the per-hit chance — even an overkill blow is never a sure sever.
 * Softened in P7.2 (from 0.6) to ~1-in-7 so losing a limb stays a rare, dramatic
 * event with real counterplay (the bandage pickup stops the resulting bleed),
 * not a routine outcome of every big hit.
 */
export const DISMEMBER_MAX_CHANCE = 0.15

/**
 * Probability that a hit of `amount` HP severs a limb, ignoring how many limbs
 * remain. Returns 0 below {@link DISMEMBER_DAMAGE_THRESHOLD} and is clamped to
 * {@link DISMEMBER_MAX_CHANCE}.
 */
export function dismemberChance(amount: number): number {
  if (amount < DISMEMBER_DAMAGE_THRESHOLD) return 0
  const scaled =
    DISMEMBER_BASE_CHANCE +
    (amount - DISMEMBER_DAMAGE_THRESHOLD) * DISMEMBER_CHANCE_PER_DAMAGE
  return Math.min(scaled, DISMEMBER_MAX_CHANCE)
}

/** Limbs still attached — the only ones a hit can take off. */
export function intactLimbs(state: InjuryState): Limb[] {
  return LIMBS.filter((limb) => state[limb] === 'intact')
}

/**
 * Decide whether a hit of `amount` HP severs a limb. Pure given `rng`; consumes
 * exactly one value from it. False when no intact limbs remain.
 */
export function shouldSever(amount: number, state: InjuryState, rng: Rng): boolean {
  if (intactLimbs(state).length === 0) return false
  return rng() < dismemberChance(amount)
}

/**
 * Pick which intact limb a hit takes off (uniform among those remaining), or
 * `null` if none are left. Consumes one value from `rng` when it picks.
 */
export function pickLimb(state: InjuryState, rng: Rng): Limb | null {
  const candidates = intactLimbs(state)
  if (candidates.length === 0) return null
  return pick(rng, candidates)
}

/**
 * Resolve a combat hit into the limb to sever, or `null` for no dismemberment.
 * Combines {@link shouldSever} and {@link pickLimb}; pure given `rng`.
 */
export function resolveDismemberment(
  amount: number,
  state: InjuryState,
  rng: Rng,
): Limb | null {
  if (!shouldSever(amount, state, rng)) return null
  return pickLimb(state, rng)
}
