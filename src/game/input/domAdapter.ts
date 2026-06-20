// Thin DOM adapter around the pure input model (./intent, ./bindings).
//
// This is the ONLY input file that touches the browser. It wires keyboard,
// mouse, and Pointer Lock events into `inputReducer` and exposes a small
// controller the game loop samples each frame. It still imports nothing from
// Babylon — it only needs an `HTMLCanvasElement` to request pointer lock on.

import { defaultBindings, rebind, type KeyBindings } from './bindings'
import {
  createInputState,
  inputReducer,
  toIntent,
  type InputAction,
  type Intent,
  type InputState,
} from './intent'

/** Public surface the game loop / UI uses to drive and configure input. */
export interface InputController {
  /**
   * Read the current intent and clear the accumulated look delta. Call once per
   * frame; the returned `lookDX`/`lookDY` cover movement since the last sample.
   */
  sample(): Intent
  /** The active key bindings (immutable snapshot). */
  getBindings(): KeyBindings
  /** Rebind an action to a new `KeyboardEvent.code`. */
  setBinding(action: InputAction, code: string): void
  /** Whether the pointer is currently locked to the canvas. */
  isPointerLocked(): boolean
  /** Detach all listeners and release pointer lock. Safe to call once. */
  dispose(): void
}

export interface InputControllerOptions {
  /** Starting bindings; defaults to {@link defaultBindings}. */
  bindings?: KeyBindings
  /** Window/document to bind to. Defaults to the globals — override in tests. */
  target?: Window & typeof globalThis
}

/**
 * Create an input controller bound to `canvas`. Clicking the canvas requests
 * pointer lock; while locked, mouse movement feeds look deltas and key presses
 * feed the intent state.
 *
 * Pointer Lock & ESC: the browser reserves ESC to exit pointer lock, and JS
 * cannot intercept it. We therefore never bind ESC ourselves. When lock is
 * lost we `releaseAll` so no key is left stuck "held". A future pause system
 * should hook the lock-lost transition (via {@link InputController.isPointerLocked}
 * or a `pointerlockchange` listener) rather than an Escape keydown — see
 * docs/guide/input-system.md.
 */
export function createInputController(
  canvas: HTMLCanvasElement,
  options: InputControllerOptions = {},
): InputController {
  const target = options.target ?? window
  const doc = canvas.ownerDocument
  let bindings = options.bindings ?? defaultBindings
  let state: InputState = createInputState()
  let locked = false

  const dispatch = (event: Parameters<typeof inputReducer>[1]): void => {
    state = inputReducer(state, event, bindings)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const before = state
    dispatch({ type: 'keydown', code: e.code })
    // Swallow the default only for keys we actually consumed (e.g. Space
    // scrolling the page) so unbound keys keep their browser behaviour.
    if (state !== before) e.preventDefault()
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    dispatch({ type: 'keyup', code: e.code })
  }

  const onMouseMove = (e: MouseEvent): void => {
    if (!locked) return
    dispatch({ type: 'look', dx: e.movementX, dy: e.movementY })
  }

  const onClick = (): void => {
    if (!locked) canvas.requestPointerLock()
  }

  const onPointerLockChange = (): void => {
    locked = doc.pointerLockElement === canvas
    // Releasing the pointer (ESC, alt-tab, etc.) should not leave keys stuck.
    if (!locked) dispatch({ type: 'releaseAll' })
  }

  const onBlur = (): void => {
    dispatch({ type: 'releaseAll' })
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)
  doc.addEventListener('mousemove', onMouseMove)
  doc.addEventListener('pointerlockchange', onPointerLockChange)
  canvas.addEventListener('click', onClick)

  return {
    sample(): Intent {
      const intent = toIntent(state)
      dispatch({ type: 'clearLook' })
      return intent
    },
    getBindings(): KeyBindings {
      return bindings
    },
    setBinding(action: InputAction, code: string): void {
      bindings = rebind(bindings, action, code)
    },
    isPointerLocked(): boolean {
      return locked
    },
    dispose(): void {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
      target.removeEventListener('blur', onBlur)
      doc.removeEventListener('mousemove', onMouseMove)
      doc.removeEventListener('pointerlockchange', onPointerLockChange)
      canvas.removeEventListener('click', onClick)
      if (doc.pointerLockElement === canvas) doc.exitPointerLock()
    },
  }
}
