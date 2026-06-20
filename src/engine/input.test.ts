import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputSystem } from './input'

const systems: InputSystem[] = []

function createInput() {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  const input = new InputSystem(canvas)
  systems.push(input)
  return { canvas, input }
}

function setPointerLockElement(element: Element | null): void {
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    value: element,
  })
  document.dispatchEvent(new Event('pointerlockchange'))
}

function mouseMove(movementX: number, movementY: number): MouseEvent {
  const event = new MouseEvent('mousemove')
  Object.defineProperties(event, {
    movementX: { configurable: true, value: movementX },
    movementY: { configurable: true, value: movementY },
  })
  return event
}

afterEach(() => {
  for (const input of systems.splice(0)) input.dispose()
  document.body.replaceChildren()
  setPointerLockElement(null)
  vi.restoreAllMocks()
})

describe('InputSystem keyboard state', () => {
  it('tracks held keys plus just-pressed and just-released frame edges', () => {
    const { input } = createInput()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

    expect(input.isDown('KeyW')).toBe(true)
    expect(input.justPressed('KeyW')).toBe(true)
    expect(input.justReleased('KeyW')).toBe(false)

    input.endFrame()

    expect(input.isDown('KeyW')).toBe(true)
    expect(input.justPressed('KeyW')).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))

    expect(input.isDown('KeyW')).toBe(false)
    expect(input.justReleased('KeyW')).toBe(true)

    input.endFrame()

    expect(input.justReleased('KeyW')).toBe(false)
  })

  it('does not report repeated keydown events as new presses while held', () => {
    const { input } = createInput()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    input.endFrame()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }))

    expect(input.isDown('Space')).toBe(true)
    expect(input.justPressed('Space')).toBe(false)
  })
})

describe('InputSystem mouse state', () => {
  it('accumulates pointer-locked mouse movement and resets on read', () => {
    const { canvas, input } = createInput()

    window.dispatchEvent(mouseMove(30, -7))
    expect(input.readMouseDelta()).toEqual({ x: 0, y: 0 })

    setPointerLockElement(canvas)
    window.dispatchEvent(mouseMove(3, -1))
    window.dispatchEvent(mouseMove(4, 2))

    expect(input.isPointerLocked()).toBe(true)
    expect(input.readMouseDelta()).toEqual({ x: 7, y: 1 })
    expect(input.readMouseDelta()).toEqual({ x: 0, y: 0 })
  })

  it('tracks mouse button state', () => {
    const { input } = createInput()

    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect(input.isButtonDown(0)).toBe(true)

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
    expect(input.isButtonDown(0)).toBe(false)
  })
})

describe('InputSystem pointer lock and cleanup', () => {
  it('requests pointer lock from canvas clicks when the API exists', () => {
    const { canvas } = createInput()
    const requestPointerLock = vi.fn()
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: requestPointerLock,
    })

    canvas.dispatchEvent(new MouseEvent('click'))

    expect(requestPointerLock).toHaveBeenCalledTimes(1)
  })

  it('does not throw on canvas clicks when requestPointerLock is unavailable', () => {
    const { canvas } = createInput()
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: undefined,
    })

    expect(() => canvas.dispatchEvent(new MouseEvent('click'))).not.toThrow()
  })

  it('removes listeners and clears state on dispose', () => {
    const { canvas, input } = createInput()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
    setPointerLockElement(canvas)
    window.dispatchEvent(mouseMove(5, 6))

    input.dispose()

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    window.dispatchEvent(new MouseEvent('mousedown', { button: 1 }))
    window.dispatchEvent(mouseMove(9, 9))

    expect(input.isDown('KeyA')).toBe(false)
    expect(input.isDown('KeyD')).toBe(false)
    expect(input.isButtonDown(1)).toBe(false)
    expect(input.readMouseDelta()).toEqual({ x: 0, y: 0 })
    expect(() => input.dispose()).not.toThrow()
  })
})
