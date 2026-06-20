import { describe, expect, it } from 'vitest'
import { defaultBindings, rebind } from './bindings'
import {
  createInputState,
  inputReducer,
  toIntent,
  type InputEvent,
  type InputState,
} from './intent'

/** Apply a sequence of events with the given bindings. */
function run(events: InputEvent[], bindings = defaultBindings): InputState {
  return events.reduce((s, e) => inputReducer(s, e, bindings), createInputState())
}

describe('inputReducer + toIntent', () => {
  it('starts neutral', () => {
    expect(toIntent(createInputState())).toEqual({
      moveX: 0,
      moveY: 0,
      jump: false,
      sprint: false,
      attack: false,
      lookDX: 0,
      lookDY: 0,
    })
  })

  it('maps WASD to move axes', () => {
    expect(toIntent(run([{ type: 'keydown', code: 'KeyW' }])).moveY).toBe(1)
    expect(toIntent(run([{ type: 'keydown', code: 'KeyS' }])).moveY).toBe(-1)
    expect(toIntent(run([{ type: 'keydown', code: 'KeyD' }])).moveX).toBe(1)
    expect(toIntent(run([{ type: 'keydown', code: 'KeyA' }])).moveX).toBe(-1)
  })

  it('cancels opposing keys to zero', () => {
    const intent = toIntent(
      run([
        { type: 'keydown', code: 'KeyW' },
        { type: 'keydown', code: 'KeyS' },
      ]),
    )
    expect(intent.moveY).toBe(0)
  })

  it('maps jump and sprint to booleans', () => {
    const intent = toIntent(
      run([
        { type: 'keydown', code: 'Space' },
        { type: 'keydown', code: 'ShiftLeft' },
      ]),
    )
    expect(intent.jump).toBe(true)
    expect(intent.sprint).toBe(true)
  })

  it('clears an action on keyup', () => {
    const intent = toIntent(
      run([
        { type: 'keydown', code: 'KeyW' },
        { type: 'keyup', code: 'KeyW' },
      ]),
    )
    expect(intent.moveY).toBe(0)
  })

  it('ignores unbound keys', () => {
    const state = createInputState()
    expect(inputReducer(state, { type: 'keydown', code: 'KeyZ' }, defaultBindings)).toBe(state)
  })

  it('is idempotent on key repeat (returns same reference)', () => {
    const down = inputReducer(createInputState(), { type: 'keydown', code: 'KeyW' }, defaultBindings)
    expect(inputReducer(down, { type: 'keydown', code: 'KeyW' }, defaultBindings)).toBe(down)
  })

  it('accumulates look deltas and clears them', () => {
    const looked = run([
      { type: 'look', dx: 3, dy: -2 },
      { type: 'look', dx: 1, dy: 5 },
    ])
    expect(toIntent(looked)).toMatchObject({ lookDX: 4, lookDY: 3 })
    const cleared = inputReducer(looked, { type: 'clearLook' }, defaultBindings)
    expect(toIntent(cleared)).toMatchObject({ lookDX: 0, lookDY: 0 })
  })

  it('releaseAll clears every held action but keeps look untouched', () => {
    const held = run([
      { type: 'keydown', code: 'KeyW' },
      { type: 'keydown', code: 'Space' },
      { type: 'look', dx: 2, dy: 2 },
    ])
    const released = inputReducer(held, { type: 'releaseAll' }, defaultBindings)
    expect(toIntent(released)).toMatchObject({ moveY: 0, jump: false, lookDX: 2, lookDY: 2 })
  })

  it('rebinding a key changes the produced intent', () => {
    // Rebind forward from W to the up arrow; W should no longer move forward.
    const bindings = rebind(defaultBindings, 'moveForward', 'ArrowUp')
    expect(toIntent(run([{ type: 'keydown', code: 'KeyW' }], bindings)).moveY).toBe(0)
    expect(toIntent(run([{ type: 'keydown', code: 'ArrowUp' }], bindings)).moveY).toBe(1)
  })
})
