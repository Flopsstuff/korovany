export interface MouseDelta {
  readonly x: number
  readonly y: number
}

export interface InputSystemOptions {
  readonly eventTarget?: Window
}

/**
 * Frame-queryable DOM input for gameplay systems.
 *
 * The system listens to keyboard/mouse events, exposes held and edge-triggered
 * state, and owns pointer-lock requests for the game canvas. Call `endFrame()`
 * once after each fixed update to clear edge-triggered key state.
 */
export class InputSystem {
  private readonly canvas: HTMLCanvasElement
  private readonly eventTarget: Window
  private readonly document: Document
  private readonly keysDown = new Set<string>()
  private readonly keysPressed = new Set<string>()
  private readonly keysReleased = new Set<string>()
  private readonly buttonsDown = new Set<number>()
  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private locked = false
  private disposed = false

  constructor(canvas: HTMLCanvasElement, options: InputSystemOptions = {}) {
    this.canvas = canvas
    this.document = canvas.ownerDocument
    this.eventTarget = options.eventTarget ?? this.document.defaultView ?? window
    this.locked = this.document.pointerLockElement === this.canvas

    this.eventTarget.addEventListener('keydown', this.onKeyDown)
    this.eventTarget.addEventListener('keyup', this.onKeyUp)
    this.eventTarget.addEventListener('mousemove', this.onMouseMove)
    this.eventTarget.addEventListener('mousedown', this.onMouseDown)
    this.eventTarget.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('click', this.onCanvasClick)
    this.document.addEventListener('pointerlockchange', this.onPointerLockChange)
  }

  isDown(code: string): boolean {
    return this.keysDown.has(code)
  }

  justPressed(code: string): boolean {
    return this.keysPressed.has(code)
  }

  justReleased(code: string): boolean {
    return this.keysReleased.has(code)
  }

  isButtonDown(button: number): boolean {
    return this.buttonsDown.has(button)
  }

  isPointerLocked(): boolean {
    return this.locked
  }

  readMouseDelta(): MouseDelta {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY }
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
    return delta
  }

  endFrame(): void {
    this.keysPressed.clear()
    this.keysReleased.clear()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.eventTarget.removeEventListener('keydown', this.onKeyDown)
    this.eventTarget.removeEventListener('keyup', this.onKeyUp)
    this.eventTarget.removeEventListener('mousemove', this.onMouseMove)
    this.eventTarget.removeEventListener('mousedown', this.onMouseDown)
    this.eventTarget.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('click', this.onCanvasClick)
    this.document.removeEventListener('pointerlockchange', this.onPointerLockChange)

    this.keysDown.clear()
    this.keysPressed.clear()
    this.keysReleased.clear()
    this.buttonsDown.clear()
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
    this.locked = false
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.keysDown.has(event.code)) {
      this.keysPressed.add(event.code)
    }
    this.keysDown.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.keysDown.delete(event.code)) {
      this.keysReleased.add(event.code)
    }
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return
    this.mouseDeltaX += event.movementX
    this.mouseDeltaY += event.movementY
  }

  private readonly onMouseDown = (event: MouseEvent): void => {
    this.buttonsDown.add(event.button)
  }

  private readonly onMouseUp = (event: MouseEvent): void => {
    this.buttonsDown.delete(event.button)
  }

  private readonly onCanvasClick = (): void => {
    void this.canvas.requestPointerLock?.()
  }

  private readonly onPointerLockChange = (): void => {
    this.locked = this.document.pointerLockElement === this.canvas
  }
}
