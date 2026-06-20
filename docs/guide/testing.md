# Testing

Tests are mandatory: every feature or bugfix ships with tests in the same change
(see [Project rules §4](/guide/project-rules)). This page explains how the test
suite is wired and the two patterns that let Babylon.js code run under a headless
test runner.

## Run model

We use [Vitest](https://vitest.dev/). The suite runs in **jsdom** with globals
enabled, so `describe` / `it` / `expect` / `vi` are available without imports
(most files import them explicitly anyway for clarity).

| Command              | What it does                          |
| -------------------- | ------------------------------------- |
| `npm test`           | Run the whole suite once (CI uses this) |
| `npm run test:watch` | Re-run affected tests on save           |

CI runs `npm test` and it must be green before merge. Locally, the full
pre-push gate is `npm run lint && npm test && npm run build`.

The config lives in `vite.config.ts`:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  css: false,
}
```

## Co-location

Tests live **next to the code they cover**, named `*.test.ts` (logic) or
`*.test.tsx` (components). For example `src/game/controller/movement.ts` is
tested by `src/game/controller/movement.test.ts`. There is no separate `tests/`
tree — find a unit's tests in its own folder.

## Shared setup

`src/test/setup.ts` is the single global setup file. Today it just registers the
jest-dom matchers so assertions like `toBeInTheDocument()` work:

```ts
import '@testing-library/jest-dom/vitest'
```

Add genuinely global test wiring here; keep per-test stubs in the test file.

## Babylon.js in tests

jsdom has **no WebGL context**, so Babylon cannot create a real engine in tests.
There are two patterns, depending on what you're testing.

### Component tests: stub the canvas

When you render React that mounts the 3D canvas, stub `GameCanvas` with
`vi.mock` so the component tree renders without a GPU. The engine bootstrap is
covered separately (see below), so nothing is lost.

```ts
// jsdom has no WebGL, so stub the canvas; render the rest of the app normally.
vi.mock('../scenes/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas" />,
}))
```

See [`src/app/App.test.tsx`](https://github.com/Flopsstuff/korovany/blob/main/src/app/App.test.tsx)
for the full pattern, including a Redux `Provider` with `preloadedState` and a
`vi.mock` of the IndexedDB save layer.

### Engine / game-logic tests: inject `NullEngine`

To exercise engine and scene code directly, inject Babylon's headless
[`NullEngine`](https://doc.babylonjs.com/typedoc/classes/BABYLON.NullEngine)
through the factory each subsystem accepts. `NullEngine` runs the full Babylon
object graph (scenes, cameras, meshes, dispose) with no rendering, so you can
assert behaviour without a browser.

```ts
import { NullEngine, Scene } from '@babylonjs/core'

function boot() {
  const canvas = document.createElement('canvas')
  return createGameEngine(canvas, {
    streamAssetId: null,            // skip the GLB fetch
    createEngine: () => new NullEngine(),
  })
}
```

See [`src/engine/index.test.ts`](https://github.com/Flopsstuff/korovany/blob/main/src/engine/index.test.ts).
The same injection seam appears across the codebase: pass `streamAssetId: null`
/ `heroUrl: null` to skip network fetches, and a `NullEngine` factory to skip
WebGL (see [Asset streaming](/guide/asset-streaming),
[Character controller](/guide/character-controller), and
[Forest zone](/guide/forest-zone)).

### Prefer pure cores

Where practical, subsystems split a **pure logic core** (no React/Babylon
imports — directly unit-testable in jsdom) from a thin Babylon binding. The
movement math, health model, and input intent layers follow this shape, which
keeps most tests free of any engine setup at all. See
[Architecture](/guide/architecture).

## Fixtures & golden files

There are currently **no snapshot or golden-file conventions** — we assert on
explicit expected values rather than `toMatchSnapshot()`, which keeps tests
readable and intentional. The repo's two fixture-style patterns are:

- **Redux `preloadedState`** — build a store with a known slice state to drive a
  component into a specific scenario (see the `renderApp` helper in
  `src/app/App.test.tsx`).
- **`vi.mock` / `vi.fn` stubs** — replace IO boundaries (the IndexedDB save
  layer, the canvas) with deterministic doubles.

If you introduce snapshot or binary golden fixtures later, document the
convention here so it stays the single source of truth.
