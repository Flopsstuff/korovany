/**
 * UI audio cue helpers — thin wrappers over the shared {@link audioBus} so menu
 * surfaces never call `play()` with raw SFX names. Hover is rate-limited so
 * keyboard/mouse focus sweeps do not spam the bus.
 */
import { audioBus } from './audioBus'

/** Minimum ms between hover cues (prevents focus/mouseenter bursts). */
const UI_HOVER_COOLDOWN_MS = 80

let lastHoverAt = 0

/** Play the standard UI button-press blip. */
export function playUiClick(): void {
  audioBus.play('uiClick')
}

/** Play the softer UI hover/focus tick (cooldown-gated). */
export function playUiHover(): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastHoverAt < UI_HOVER_COOLDOWN_MS) return
  lastHoverAt = now
  audioBus.play('uiHover')
}

/** Wrap a click handler so it always plays the click cue first. */
export function onUiClick(handler?: () => void): () => void {
  return () => {
    playUiClick()
    handler?.()
  }
}

/** Props to spread on buttons/links for hover + keyboard-focus cues. */
export function uiHoverProps(): { onMouseEnter: () => void; onFocus: () => void } {
  return { onMouseEnter: playUiHover, onFocus: playUiHover }
}

/** Reset hover cooldown — test-only. */
export function resetUiHoverCooldownForTests(): void {
  lastHoverAt = 0
}
