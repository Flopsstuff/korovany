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
| Commander orders / squad AI    | `src/game/ai/orders.ts` + `src/game/ai/soldierFSM.ts` — see [Enemy AI](./enemy-ai) |
| Character progression (XP/stats/skills) | `src/game/progression/` + `src/store/progressionSlice.ts` — see [Character progression](./character-progression) |
| Asset streaming (GLB on demand)| `src/game/streaming/`               |
| Zone landmark/encounter content| `src/game/world/zoneContent.ts` (data) — seeded from `docs/guide/worlds/*.md` |
| Zone map population (greybox)  | `src/game/world/mapProps.ts` (20×20 grid → prop data) + `src/scenes/mapPropsRenderer.ts` (thin-instanced render) — FLO-445 |
| Persistent enemy corpses       | `src/game/corpses/` + `src/scenes/corpseManager.ts` — see [Corpses](./corpses) |
| Save/load (IndexedDB)          | `src/game/save/`                    |
| User settings (rebind, quality)| `src/game/settings/` — see [Settings](./settings) |
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

## Tree impostors (distance LOD)

The dense forest (Phase 5) cannot afford to draw every tree's full GLB
(~1357 tris) hundreds of times. `src/game/streaming/treeImpostor.ts` collapses
distant trees to a single camera-facing **billboard impostor** (2 tris) using
Babylon's native per-mesh LOD (`mesh.addLODLevel`), so the engine swaps full mesh
↔ billboard by camera distance with no per-frame loop. A mesh used as an LOD
level is "linked" and never drawn independently, so there is no double-draw, and
instances inherit their source's LOD levels — keeping the layer compatible with
the future thin-instanced forest (E5.3). A dense-forest benchmark scene is
reachable at `?dev=impostor`. See
[Asset streaming › Tree impostors](./asset-streaming.md#tree-impostors-distance-lod).

## Performance budget (60fps on mid hardware)

The dense-forest layers above exist to hold a frame inside a fixed budget. That
budget lives as data in `src/game/perf/budget.ts` (60fps / 16.67ms; draw-call and
active-index ceilings) with a pure evaluator, a scene `FrameProfiler` that grades
a rolling mean, and a DOM `PerfHud` overlay. A live profiling bench over a
576-tree forest is reachable at `?dev=perf`. See
[Performance budget](./performance-budget.md) (E5.4).
