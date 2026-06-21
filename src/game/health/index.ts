export type { HealthState } from './healthModel'
export { applyDamage, createHealth, healDamage, isAlive } from './healthModel'

export type { BleedTick, InjuryState, Limb, LimbStatus } from './injuryModel'
export { coerceInjuryState, isInjuryState } from './injuryModel'
export {
  BLEED_DAMAGE_PER_INTERVAL,
  BLEED_INTERVAL_SECONDS,
  CRAWL_SPEED_MULTIPLIER,
  LIMBS,
  blindedEyeCount,
  createInjuryState,
  fitProsthetic,
  hasHalfScreenBlackout,
  isBleeding,
  isCrawling,
  locomotionSpeedMultiplier,
  severLimb,
  severedLimbs,
  tickBleed,
  treatBleeding,
} from './injuryModel'
