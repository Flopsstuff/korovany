export type { AttackPhase, Damageable, MeleeAttackParams, MeleeAttackState, Vec3 } from './meleeAttack'
export {
  createMeleeAttack,
  DEFAULT_MELEE_PARAMS,
  getMeleeHits,
  stepMeleeAttack,
} from './meleeAttack'
export { HitFlashManager, DEFAULT_HIT_FLASH_PARAMS } from './hitFlash'
export type { HitFlashParams } from './hitFlash'
export { DeathEmphasisManager, DEFAULT_DEATH_EMPHASIS_PARAMS } from './deathEmphasis'
export type { DeathEmphasisParams, TimeScaleable } from './deathEmphasis'
export {
  emitDamage,
  emitShake,
  emitKill,
  emitAttack,
  emitDismember,
  onDamage,
  onShake,
  onKill,
  onAttack,
  onDismember,
} from './damageEvents'
export type {
  DamageEventListener,
  KillEventListener,
  ShakeEventListener,
  AttackEventListener,
  DismemberEventListener,
} from './damageEvents'
export { lineOfSightClear } from './lineOfSight'
export type { SightObstacle } from './lineOfSight'
export type {
  CreateProjectileOptions,
  Projectile,
  ProjectileField,
  ProjectileImpact,
  StepProjectileFieldResult,
} from './projectile'
export {
  createProjectile,
  createProjectileField,
  DEFAULT_PROJECTILE_HIT_RADIUS,
  DEFAULT_PROJECTILE_SPEED,
  DEFAULT_PROJECTILE_TTL,
  MAX_LIVE_PROJECTILES,
  spawnProjectile,
  stepProjectile,
  stepProjectileField,
} from './projectile'
