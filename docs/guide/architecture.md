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
| Seeded RNG (reproducible rolls)| `src/game/util/rng.ts` — see [Seeded RNG](./seeded-rng) |
| Faction definitions/reputation | `src/game/faction/` + `src/store/factionSlice.ts` — see [Faction system](./faction-system) |
| Asset streaming (GLB on demand)| `src/game/streaming/`               |
| Persistent enemy corpses       | `src/game/corpses/` + `src/scenes/corpseManager.ts` — see [Corpses](./corpses) |
| Save/load (IndexedDB)          | `src/game/save/`                    |
| Shared state                   | `src/store/` (a new slice) — see [State management](./state-management) |
| A 3D model / texture / sound   | `assets/` (tracked by Git LFS)      |
| Documentation                  | `docs/` (same change as the code)   |

## Data flow

`main.tsx` mounts React inside a Redux `<Provider>` and renders the full-page
app shell (`src/app/App.tsx`): a `100vw × 100vh` stage holding the 3D canvas
with a HUD overlay. UI reads state via the typed `useAppSelector` hook and
dispatches via `useAppDispatch` (both from `src/store`).

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

## Character controller

The capsule character and its third-person follow camera live in
`src/game/controller/` and `src/game/camera/`. Like the input system, each
splits a pure, NullEngine-tested math core (gravity, ground clamp, jump,
coyote-time, camera boom) from a thin Babylon binding that runs as a loop
`System`. A self-contained dev scene is reachable at `?dev=controller`. See
[Character controller](./character-controller.md).
