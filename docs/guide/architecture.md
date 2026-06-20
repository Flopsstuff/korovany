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
│   ├── engine/            # Babylon lifecycle plus DOM input (createGameEngine, InputSystem)
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
| Engine/render-loop/input       | `src/engine/`                       |
| Reusable UI (buttons, HUD)     | `src/components/`                    |
| Game logic (no React/Babylon)  | `src/game/`                         |
| Shared state                   | `src/store/` (a new slice)          |
| A 3D model / texture / sound   | `assets/` (tracked by Git LFS)      |
| Documentation                  | `docs/` (same change as the code)   |

## Data flow

`main.tsx` mounts React inside a Redux `<Provider>` and renders the full-page
app shell (`src/app/App.tsx`): a `100vw × 100vh` stage holding the 3D canvas
with a HUD overlay. UI reads state via the typed `useAppSelector` hook and
dispatches via `useAppDispatch` (both from `src/store`).

The engine layer lives in `src/engine/`: `createGameEngine(canvas)` owns the
Babylon `Engine`/`Scene`, the render loop, the high-DPI resize handler, and
`dispose()`. `InputSystem` owns DOM keyboard/mouse state and pointer lock for
that same canvas, exposing frame-queryable held state, key edges, mouse buttons,
and mouse-look delta. The React side stays thin — `src/scenes/GameCanvas.tsx`
only mounts the engine against a ref'd canvas and disposes it on unmount. Engine
code can read/dispatch to the same store, so game systems and UI stay in sync
through Redux.
