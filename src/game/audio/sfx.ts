/**
 * SFX recipe registry: each named sound is a stack of synth voices, rendered to
 * mono PCM on demand. Recipes are short (≤ 0.6 s) and deliberately punchy so
 * every action lands with audible feedback (board goal MPG / FLO-355).
 *
 * Add a sound by adding a key here and a matching `play()` trigger via the event
 * bridge — never scatter raw audio calls through the scene. See `audioBus`.
 */
import { renderClip, type ToneSpec } from './synth'

/** Every sound the game can play. */
export type SfxName =
  | 'hit' // an enemy takes a hit
  | 'kill' // an enemy dies
  | 'playerHurt' // the player takes damage
  | 'attack' // the player swings (whiff/swing)
  | 'uiClick' // a UI button press
  | 'win' // run won
  | 'lose' // run lost

/** name → the voices that make up that clip. */
const RECIPES: Record<SfxName, ToneSpec[]> = {
  // Meaty thud: a low body sine plus a short noise transient.
  hit: [
    { type: 'sine', freq: 150, freqEnd: 80, duration: 0.16, gain: 0.9, decay: 0.05 },
    { type: 'noise', freq: 0, duration: 0.06, gain: 0.35, decay: 0.02 },
  ],
  // Death sting: a falling tone with a darker tail.
  kill: [
    { type: 'triangle', freq: 420, freqEnd: 120, duration: 0.35, gain: 0.6, decay: 0.12 },
    { type: 'sine', freq: 210, freqEnd: 60, duration: 0.35, gain: 0.4, decay: 0.12 },
  ],
  // Player hurt: a harsh low buzz — distinct from the enemy-hit thud.
  playerHurt: [
    { type: 'square', freq: 110, freqEnd: 70, duration: 0.22, gain: 0.45, decay: 0.08 },
    { type: 'noise', freq: 0, duration: 0.1, gain: 0.3, decay: 0.04 },
  ],
  // Swing: a quick filtered-noise whoosh rising slightly in pitch.
  attack: [
    { type: 'noise', freq: 0, duration: 0.1, gain: 0.22, decay: 0.04, attack: 0.02 },
    { type: 'triangle', freq: 300, freqEnd: 520, duration: 0.1, gain: 0.18, decay: 0.04 },
  ],
  // UI click: a tiny high blip.
  uiClick: [{ type: 'sine', freq: 880, duration: 0.05, gain: 0.3, decay: 0.02 }],
  // Win sting: a bright ascending major triad (C5-E5-G5), each note delayed by
  // layering longer attacks so they bloom in sequence.
  win: [
    { type: 'triangle', freq: 523, duration: 0.5, gain: 0.4, decay: 0.18 },
    { type: 'triangle', freq: 659, duration: 0.5, gain: 0.38, decay: 0.18, attack: 0.12 },
    { type: 'triangle', freq: 784, duration: 0.5, gain: 0.36, decay: 0.18, attack: 0.24 },
  ],
  // Lose sting: a descending minor fall (A4 → C4).
  lose: [
    { type: 'triangle', freq: 440, freqEnd: 262, duration: 0.55, gain: 0.45, decay: 0.2 },
    { type: 'sine', freq: 220, freqEnd: 131, duration: 0.55, gain: 0.3, decay: 0.2 },
  ],
}

/** All registered sound names (stable order). */
export const SFX_NAMES = Object.keys(RECIPES) as SfxName[]

/** Render a named sound to mono PCM at the given sample rate. */
export function renderSfx(name: SfxName, sampleRate: number): Float32Array {
  return renderClip(RECIPES[name], sampleRate)
}
