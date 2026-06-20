# Engine Input API

`InputSystem` is the DOM input layer for gameplay code. It has no Babylon
dependency: pass it the render canvas, query it during each fixed update, and
dispose it with the rest of the engine lifecycle.

```ts
import { InputSystem } from './input'

const input = new InputSystem(canvas)

function fixedUpdate() {
  if (input.isDown('KeyW')) {
    // move forward
  }

  if (input.justPressed('Space')) {
    // jump once
  }

  const look = input.readMouseDelta()
  // apply look.x / look.y to camera yaw and pitch

  input.endFrame()
}
```

- `isDown(code)` reports held keyboard state using `KeyboardEvent.code`.
- `justPressed(code)` and `justReleased(code)` are true only until
  `endFrame()` is called.
- `readMouseDelta()` returns accumulated pointer-locked mouse movement since
  the previous read, then resets it to `{ x: 0, y: 0 }`.
- `isButtonDown(button)` reports held mouse buttons by `MouseEvent.button`.
- Clicking the canvas requests pointer lock when the browser supports it.
  Mouse-look delta is accumulated only while that canvas owns pointer lock.
- `dispose()` removes every DOM listener and clears tracked state.
