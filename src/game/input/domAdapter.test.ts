import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInputController, type InputController } from './domAdapter'

// jsdom does not implement the Pointer Lock API, so we stub the few surfaces the
// adapter touches. These tests cover only the thin DOM wiring; the intent logic
// is exercised by intent.test.ts without any DOM at all.

let canvas: HTMLCanvasElement
let controller: InputController
let lockElement: Element | null = null

beforeEach(() => {
  canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  canvas.requestPointerLock = vi.fn(() => {
    lockElement = canvas
    document.dispatchEvent(new Event('pointerlockchange'))
    return Promise.resolve()
  })
  document.exitPointerLock = vi.fn(() => {
    lockElement = null
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => lockElement,
  })
  controller = createInputController(canvas)
})

afterEach(() => {
  controller.dispose()
  canvas.remove()
  lockElement = null
})

function mouseMove(dx: number, dy: number): void {
  const e = new MouseEvent('mousemove')
  Object.defineProperty(e, 'movementX', { value: dx })
  Object.defineProperty(e, 'movementY', { value: dy })
  document.dispatchEvent(e)
}

describe('createInputController', () => {
  it('feeds keyboard events into the sampled intent', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(controller.sample().moveY).toBe(1)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
    expect(controller.sample().moveY).toBe(0)
  })

  it('requests pointer lock on canvas click and tracks lock state', () => {
    expect(controller.isPointerLocked()).toBe(false)
    canvas.dispatchEvent(new MouseEvent('click'))
    expect(canvas.requestPointerLock).toHaveBeenCalledOnce()
    expect(controller.isPointerLocked()).toBe(true)
  })

  it('feeds mouse movement into look delta only while locked', () => {
    mouseMove(5, -3)
    expect(controller.sample()).toMatchObject({ lookDX: 0, lookDY: 0 })

    canvas.dispatchEvent(new MouseEvent('click')) // acquire lock
    mouseMove(5, -3)
    mouseMove(2, 1)
    expect(controller.sample()).toMatchObject({ lookDX: 7, lookDY: -2 })
  })

  it('clears look delta after each sample', () => {
    canvas.dispatchEvent(new MouseEvent('click'))
    mouseMove(4, 4)
    expect(controller.sample().lookDX).toBe(4)
    expect(controller.sample().lookDX).toBe(0)
  })

  it('releases held keys when pointer lock is lost', () => {
    canvas.dispatchEvent(new MouseEvent('click'))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(controller.sample().moveY).toBe(1)
    document.exitPointerLock() // ESC equivalent
    expect(controller.isPointerLocked()).toBe(false)
    expect(controller.sample().moveY).toBe(0)
  })

  it('rebinds keys through setBinding', () => {
    controller.setBinding('moveForward', 'ArrowUp')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(controller.sample().moveY).toBe(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    expect(controller.sample().moveY).toBe(1)
  })

  it('stops listening after dispose', () => {
    controller.dispose()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(controller.sample().moveY).toBe(0)
  })
})
