# Asset streaming

The streaming layer lives in
[`src/game/streaming/`](https://github.com/Flopsstuff/korovany/tree/main/src/game/streaming)
and provides an **id → URL registry**, a **lazy GLB loader** with cache and
reference counting, and a **placeholder box** while assets resolve. Load phases
are mirrored into Redux so the HUD can show “Loading…”.

## Layers

| File / export           | Responsibility                                                       |
| ----------------------- | -------------------------------------------------------------------- |
| `registry.ts`           | `AssetRegistry` — register and resolve static `id → { url, metadata }`. |
| `defaults.ts`           | `seedDefaultAssets` — ships the player hero GLB id (FLO-270).        |
| `loader.ts`             | `AssetStreamLoader` — lazy load, cache, ref-count, dispose.          |
| `loadGlb.ts`            | Default `LoadGlbFn` delegating to `loadModel` (normalization).       |
| `placeholder.ts`        | `createPlaceholderBox` — 1×1 box until the GLB arrives.              |
| `streamedInstance.ts`   | `spawnStreamedInstance` — placeholder → model swap (error-safe).     |
| `index.ts`              | `createAssetStreaming` factory + public barrel.                      |

Babylon imports are isolated to the loader glue and placeholder helpers; the
registry and ref-count logic are unit-tested with injected `LoadGlbFn` stubs (no
WebGL).

## Register an asset

At boot (or in a zone setup hook), register ids before requesting them:

```ts
import { AssetRegistry, seedDefaultAssets } from '../game/streaming'

const registry = new AssetRegistry()
seedDefaultAssets(registry) // hero.player-default → /models/korovany_hero_player-default.glb

registry.register('prop.chest', {
  url: '/models/chest.glb',
  metadata: { label: 'Chest', targetSize: 1.5 },
})
```

Duplicate ids throw — typos are caught at registration time, not at fetch time.

## Request and release

Use `createAssetStreaming(scene)` to get a wired registry + loader, then
`spawnStreamedInstance` for the placeholder swap:

```ts
import {
  createAssetStreaming,
  spawnStreamedInstance,
  HERO_PLAYER_ASSET_ID,
} from '../game/streaming'

const { loader } = createAssetStreaming(scene, {
  onLoadingState: (id, phase) => dispatch(setAssetPhase({ id, phase })),
})

const instance = await spawnStreamedInstance(loader, scene, HERO_PLAYER_ASSET_ID)
// instance.root is in the scene; call instance.release() when done
```

- **`acquire(id)`** — loads on first call; concurrent callers share one fetch.
- **`release(id)`** — decrements ref-count; at zero meshes/materials dispose.
- **Load error** — phase becomes `error`; the placeholder stays (no crash).

## HUD wiring

`GameCanvas` passes `onAssetLoadingState` into `createGameEngine`, which
dispatches `setAssetPhase` into the `streaming` Redux slice. `App` reads
`selectIsStreamingLoading` and shows a “Loading…” line while any asset is in the
`loading` phase.

## Tests

Vitest stubs `LoadGlbFn` in `loader.test.ts` (cache hit, dispose, error phase).
Registry resolution is covered in `registry.test.ts`. Engine bootstrap skips
streaming when `streamAssetId: null` (jsdom / `NullEngine`).
