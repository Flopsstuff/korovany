// Data-driven key bindings. A binding maps a semantic action to a physical key,
// identified by `KeyboardEvent.code` (layout-independent: 'KeyW' is the same
// physical key on QWERTY and AZERTY). Rebinding is just producing a new map.

import type { InputAction } from './intent'

/** Maps each action to the `KeyboardEvent.code` that triggers it. */
export type KeyBindings = Readonly<Record<InputAction, string>>

/** Default bindings: WASD to move, Space to jump, left Shift to sprint. */
export const defaultBindings: KeyBindings = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
}

/**
 * Reverse lookup: which action (if any) is bound to a key code. Returns the
 * first matching action; bindings are expected to be one-code-per-action.
 */
export function actionForCode(bindings: KeyBindings, code: string): InputAction | undefined {
  for (const action of Object.keys(bindings) as InputAction[]) {
    if (bindings[action] === code) return action
  }
  return undefined
}

/**
 * Return a new bindings map with `action` rebound to `code`. If `code` was
 * already bound to a different action, that older binding is cleared to a
 * neutral, never-matching value so a physical key never drives two actions.
 */
export function rebind(bindings: KeyBindings, action: InputAction, code: string): KeyBindings {
  const next: Record<InputAction, string> = { ...bindings }
  const previousOwner = actionForCode(bindings, code)
  if (previousOwner !== undefined && previousOwner !== action) {
    next[previousOwner] = ''
  }
  next[action] = code
  return next
}
