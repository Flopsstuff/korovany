# Input system

The input layer lives in [`src/game/input/`](https://github.com/Flopsstuff/korovany/tree/main/src/game/input)
and turns raw keyboard/mouse events into a **data-driven, rebindable intent** —
a small snapshot of what the player wants to do each frame. It is split so the
decision logic is pure and unit-testable, with a thin DOM adapter on top.

## Layers

| File             | Responsibility                                                            |
| ---------------- | ------------------------------------------------------------------------- |
| `intent.ts`      | Pure model: `inputReducer` + `toIntent`. No DOM, no Babylon.              |
| `bindings.ts`    | Data-driven key map (`KeyBindings`), reverse lookup, and `rebind`.        |
| `domAdapter.ts`  | Thin wrapper: wires `window`/`document` events and Pointer Lock.          |
| `index.ts`       | Public barrel.                                                            |

The pure model never imports the DOM or Babylon, so it runs in Vitest without a
real browser or GPU. The adapter is the only place that touches `window`,
`document`, or the canvas.

## Intent shape

`toIntent(state)` returns:

| Field                | Meaning                                              |
| -------------------- | ---------------------------------------------------- |
| `moveX`              | Strafe axis, normalised: `+1` right, `-1` left, `0`. |
| `moveY`              | Forward axis: `+1` forward, `-1` back, `0`.          |
| `jump` / `sprint`    | Booleans, true while held.                           |
| `lookDX` / `lookDY`  | Accumulated mouse-look delta (raw px) since last sample. |

Opposing keys (e.g. forward + back) cancel to `0`. The game loop calls
`controller.sample()` once per frame, which returns the intent and **clears the
accumulated look delta** so deltas never double-count.

## Default bindings

Keys are identified by [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)
(layout-independent — `KeyW` is the same physical key on QWERTY and AZERTY).

| Action        | Default key       |
| ------------- | ----------------- |
| `moveForward` | `W` (`KeyW`)      |
| `moveBack`    | `S` (`KeyS`)      |
| `moveLeft`    | `A` (`KeyA`)      |
| `moveRight`   | `D` (`KeyD`)      |
| `jump`        | `Space`           |
| `sprint`      | left `Shift` (`ShiftLeft`) |

## Rebinding

Bindings are plain data. `rebind(bindings, action, code)` returns a **new** map
with the action pointed at a new key; if that key was already bound to another
action, the old binding is cleared so one physical key never drives two actions.
Cleared bindings are unbound and never match during reverse lookup.
At runtime, `controller.setBinding(action, code)` does the same on the live
controller. A future settings UI can drive this directly.

## Pointer lock and mouselook

Clicking the canvas calls `requestPointerLock()`. While locked, raw
`mousemove` deltas (`movementX`/`movementY`) feed `lookDX`/`lookDY`; when not
locked, mouse movement is ignored. Losing the lock (`pointerlockchange` →
not locked) triggers `releaseAll`, so no key stays stuck "held" after the
player tabs away.

### ESC and pause

The browser **reserves `ESC` to exit Pointer Lock**, and JavaScript cannot
intercept that keydown. To avoid a conflict, the input system **never binds
`ESC`** as a gameplay action. The app shell owns the coarse menu state instead:
`Escape` toggles `playing ⇄ paused` in the Redux `app` slice, while `menu`
ignores it. When pointer lock is wired into the playable scene, losing pointer
lock should dispatch the same pause transition so physical ESC and browser
unlock behavior stay aligned.

The menu overlay exposes only actions that work in the current slice. `New Game`
is the primary focused action on boot. The pause overlay focuses
`Resume`, and also provides a clickable `Quit to Main Menu` path so players do
not need to rely on Escape.

## Usage sketch

```ts
import { createInputController } from '../game/input'

const controller = createInputController(canvas)

// each frame:
const intent = controller.sample()
character.move(intent.moveX, intent.moveY, intent.sprint)
camera.rotate(intent.lookDX, intent.lookDY)

// on teardown:
controller.dispose()
```
