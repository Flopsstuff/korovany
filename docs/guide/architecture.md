# Architecture

## Folder structure

```
korovany/
├── .github/workflows/     # CI/CD: deploy.yml (Cloudflare Pages), docs.yml (GitHub Pages)
├── assets/                # source binary assets, tracked via Git LFS (models, textures, audio)
├── docs/                  # this VitePress documentation site → GitHub Pages
│   ├── .vitepress/        # docs site config
│   ├── guide/             # getting-started, project rules, architecture
│   └── operations/        # deployment & credentials runbooks
├── public/                # static files served as-is at the web root
├── src/
│   ├── app/               # app shell & top-level composition (App.tsx, full-page stage)
│   ├── components/        # reusable React UI components
│   ├── engine/            # Babylon Engine/Scene lifecycle (createGameEngine, resize, dispose)
│   ├── scenes/            # Babylon.js scenes + GameCanvas.tsx (thin React wrapper)
│   ├── game/              # engine-agnostic game logic (systems, entities, rules)
│   ├── store/             # Redux Toolkit store + slices, typed hooks
│   ├── hooks/             # shared React hooks
│   ├── assets/            # assets imported & bundled by Vite
│   ├── styles/            # global styles
│   ├── types/             # shared TypeScript types
│   └── test/              # test setup (setup.ts)
├── AGENTS.md / CLAUDE.md  # rules for automated contributors
└── index.html             # Vite entry
```

## Where new code goes

| You are adding…                | Put it in…                          |
| ------------------------------ | ----------------------------------- |
| A Babylon scene/world          | `src/scenes/`                       |
| Engine/render-loop lifecycle   | `src/engine/`                       |
| Reusable UI (buttons, HUD)     | `src/components/`                    |
| Game logic (no React/Babylon)  | `src/game/`                         |
| Shared state                   | `src/store/` (a new slice)          |
| A 3D model / texture / sound   | `assets/` (tracked by Git LFS)      |
| Documentation                  | `docs/` (same change as the code)   |

## Data flow

`main.tsx` mounts React inside a Redux `<Provider>` and renders the full-page
app shell (`src/app/App.tsx`): a `100vw × 100vh` stage holding the 3D canvas
with React overlays for the HUD, main menu, and pause screen. Coarse app flow
lives in the pure Redux `app` slice (`menu → playing → paused`), so Babylon is
not imported by the state machine. UI reads state via the typed
`useAppSelector` hook and dispatches via `useAppDispatch` (both from
`src/store`).

The Babylon lifecycle lives in `src/engine/`: `createGameEngine(canvas)` owns
the `Engine`/`Scene`, the render loop, the high-DPI resize handler, and
`dispose()`. The React side stays thin — `src/scenes/GameCanvas.tsx` only mounts
the engine against a ref'd canvas and disposes it on unmount. Engine code can
read/dispatch to the same store, so game systems and UI stay in sync through
Redux.

## Game loop

Simulation runs on a fixed timestep decoupled from render FPS, in
`src/game/loop/` (engine-agnostic — no Babylon/React). A Babylon scene drives it
by calling `loop.advance(deltaSeconds)` each render frame. See
[Game loop](./game-loop.md) for the system-registration API and how to add a
system.
