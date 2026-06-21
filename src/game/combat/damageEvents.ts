/**
 * Lightweight event bridge: the Babylon scene fires damage/kill/attack events;
 * the React HUD subscribes to render visual feedback (damage numbers, shake) and
 * the audio bus subscribes to play SFX. Both consume the same pub/sub so neither
 * the HUD nor the audio layer reaches into the scene directly.
 *
 * Kept minimal — a typed pub/sub with no external dependencies — so both the
 * 3D layer and the DOM layer can import it without a circular dep.
 */

export type DamageEventListener = (amount: number, screenX: number, screenY: number) => void
export type KillEventListener = () => void
export type ShakeEventListener = () => void
export type AttackEventListener = () => void

let damageListeners: DamageEventListener[] = []
let killListeners: KillEventListener[] = []
let shakeListeners: ShakeEventListener[] = []
let attackListeners: AttackEventListener[] = []

/** Fire from the Babylon scene when any entity takes a hit. */
export function emitDamage(amount: number, screenX: number, screenY: number): void {
  for (const fn of damageListeners) fn(amount, screenX, screenY)
}

/** Fire from the Babylon scene when the player takes a hit (triggers camera shake). */
export function emitShake(): void {
  for (const fn of shakeListeners) fn()
}

/** Fire from the Babylon scene when an enemy is killed. */
export function emitKill(): void {
  for (const fn of killListeners) fn()
}

/** Fire from the Babylon scene when the player starts a melee swing. */
export function emitAttack(): void {
  for (const fn of attackListeners) fn()
}

export function onDamage(fn: DamageEventListener): () => void {
  damageListeners.push(fn)
  return () => { damageListeners = damageListeners.filter((l) => l !== fn) }
}

export function onShake(fn: ShakeEventListener): () => void {
  shakeListeners.push(fn)
  return () => { shakeListeners = shakeListeners.filter((l) => l !== fn) }
}

export function onKill(fn: KillEventListener): () => void {
  killListeners.push(fn)
  return () => { killListeners = killListeners.filter((l) => l !== fn) }
}

export function onAttack(fn: AttackEventListener): () => void {
  attackListeners.push(fn)
  return () => { attackListeners = attackListeners.filter((l) => l !== fn) }
}
