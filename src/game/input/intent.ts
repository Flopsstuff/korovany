// Pure, engine-agnostic input intent model.
//
// This module holds NO DOM or Babylon references. It turns a stream of abstract
// input events into a data-driven "intent" — what the player wants to do this
// frame (move, jump, sprint, look). The DOM adapter (./domAdapter) is the only
// place that touches `window`/`document`; it feeds events into `inputReducer`
// and reads the result via `toIntent`. Keeping the model pure makes it fully
// unit-testable without a real DOM or GPU.

import { actionForCode, type KeyBindings } from './bindings'

/** Semantic actions a player can perform, independent of which key triggers them. */
export type InputAction =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'sprint'

/**
 * The resolved intent for a single frame. `move*` are normalised to -1..1,
 * `look*` are the accumulated mouse-look deltas (in raw pixels) since the last
 * sample. The consumer (camera/character controller) reads this each frame.
 */
export interface Intent {
  /** Strafe axis: +1 = right, -1 = left. */
  readonly moveX: number
  /** Forward axis: +1 = forward, -1 = back. */
  readonly moveY: number
  readonly jump: boolean
  readonly sprint: boolean
  /** Accumulated yaw delta (horizontal mouse movement). */
  readonly lookDX: number
  /** Accumulated pitch delta (vertical mouse movement). */
  readonly lookDY: number
}

/**
 * Internal reducer state: the set of currently-held actions plus the look delta
 * accumulated since the last `clearLook`. Treated as immutable — the reducer
 * always returns a new value when something changes.
 */
export interface InputState {
  readonly pressed: ReadonlySet<InputAction>
  readonly lookDX: number
  readonly lookDY: number
}

/** A fresh, neutral input state (nothing pressed, no look delta). */
export function createInputState(): InputState {
  return { pressed: new Set<InputAction>(), lookDX: 0, lookDY: 0 }
}

/** Events the reducer understands. The DOM adapter translates browser events into these. */
export type InputEvent =
  /** A key (identified by `KeyboardEvent.code`) went down. */
  | { readonly type: 'keydown'; readonly code: string }
  /** A key went up. */
  | { readonly type: 'keyup'; readonly code: string }
  /** Mouse moved while pointer-locked; `dx`/`dy` are raw movement deltas. */
  | { readonly type: 'look'; readonly dx: number; readonly dy: number }
  /** Zero the accumulated look delta (call after sampling each frame). */
  | { readonly type: 'clearLook' }
  /** Release every held action (e.g. on window blur / pointer-lock loss). */
  | { readonly type: 'releaseAll' }

/**
 * The single pure transition. Given the current state, an event, and the active
 * key bindings, produce the next state. Returns the same reference when nothing
 * changes so consumers can cheaply detect no-ops.
 */
export function inputReducer(
  state: InputState,
  event: InputEvent,
  bindings: KeyBindings,
): InputState {
  switch (event.type) {
    case 'keydown': {
      const action = actionForCode(bindings, event.code)
      if (action === undefined || state.pressed.has(action)) return state
      const pressed = new Set(state.pressed)
      pressed.add(action)
      return { ...state, pressed }
    }
    case 'keyup': {
      const action = actionForCode(bindings, event.code)
      if (action === undefined || !state.pressed.has(action)) return state
      const pressed = new Set(state.pressed)
      pressed.delete(action)
      return { ...state, pressed }
    }
    case 'look':
      if (event.dx === 0 && event.dy === 0) return state
      return { ...state, lookDX: state.lookDX + event.dx, lookDY: state.lookDY + event.dy }
    case 'clearLook':
      if (state.lookDX === 0 && state.lookDY === 0) return state
      return { ...state, lookDX: 0, lookDY: 0 }
    case 'releaseAll':
      if (state.pressed.size === 0) return state
      return { ...state, pressed: new Set<InputAction>() }
  }
}

/** Derive the frame-level intent from reducer state. Opposing keys cancel out. */
export function toIntent(state: InputState): Intent {
  const p = state.pressed
  const moveX = (p.has('moveRight') ? 1 : 0) - (p.has('moveLeft') ? 1 : 0)
  const moveY = (p.has('moveForward') ? 1 : 0) - (p.has('moveBack') ? 1 : 0)
  return {
    moveX,
    moveY,
    jump: p.has('jump'),
    sprint: p.has('sprint'),
    lookDX: state.lookDX,
    lookDY: state.lookDY,
  }
}
