import { useEffect } from 'react'
import { audioBus } from '../game/audio'
import { onAttack, onDamage, onKill, onShake } from '../game/combat/damageEvents'
import type { AppPhase } from '../store'

/**
 * Bridges game events to the audio bus. Mirrors how the HUD consumes the same
 * `damageEvents` bridge — no `play()` calls live in the scene. Subscriptions:
 *
 * - `onDamage` → enemy hit thud
 * - `onKill`   → enemy death sting
 * - `onShake`  → player-hurt buzz (shake fires only when the player is struck)
 * - `onAttack` → player swing whoosh
 * - `phase`    → win / lose stings on the app-state transition
 *
 * Browsers block audio until a user gesture, so the bus is unlocked from the
 * first pointer/key event (then the listeners detach). Keep this hook mounted
 * for the app's lifetime — call it once from the app shell.
 */
export function useGameAudio(phase: AppPhase): void {
  // Subscribe the bus to combat events for the app's lifetime.
  useEffect(() => {
    const unsubscribes = [
      onDamage(() => audioBus.play('hit')),
      onKill(() => audioBus.play('kill')),
      onShake(() => audioBus.play('playerHurt')),
      onAttack(() => audioBus.play('attack')),
    ]
    return () => {
      for (const off of unsubscribes) off()
    }
  }, [])

  // Resume the AudioContext on the first user gesture (autoplay policy).
  useEffect(() => {
    let done = false
    const unlock = () => {
      if (done) return
      done = true
      void audioBus.unlock()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Win/lose stings ride the app-phase transition (no scene emitter needed).
  useEffect(() => {
    if (phase === 'won') audioBus.play('win')
    else if (phase === 'lost') audioBus.play('lose')
  }, [phase])
}
