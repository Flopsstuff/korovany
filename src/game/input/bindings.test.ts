import { describe, expect, it } from 'vitest'
import { actionForCode, defaultBindings, rebind } from './bindings'

describe('bindings', () => {
  it('resolves a code to its action', () => {
    expect(actionForCode(defaultBindings, 'KeyW')).toBe('moveForward')
    expect(actionForCode(defaultBindings, 'Space')).toBe('jump')
  })

  it('returns undefined for an unbound code', () => {
    expect(actionForCode(defaultBindings, 'KeyZ')).toBeUndefined()
  })

  it('rebinds an action without mutating the original map', () => {
    const next = rebind(defaultBindings, 'jump', 'KeyJ')
    expect(actionForCode(next, 'KeyJ')).toBe('jump')
    expect(actionForCode(next, 'Space')).toBeUndefined()
    // original untouched
    expect(actionForCode(defaultBindings, 'Space')).toBe('jump')
  })

  it('clears a conflicting binding so one key drives one action', () => {
    // Bind sprint onto W, which already moves forward.
    const next = rebind(defaultBindings, 'sprint', 'KeyW')
    expect(actionForCode(next, 'KeyW')).toBe('sprint')
    expect(next.moveForward).toBe('')
    expect(actionForCode(next, '')).toBeUndefined()
  })

  it('is a no-op-shaped rebind when binding an action to its own key', () => {
    const next = rebind(defaultBindings, 'moveForward', 'KeyW')
    expect(next.moveForward).toBe('KeyW')
  })
})
