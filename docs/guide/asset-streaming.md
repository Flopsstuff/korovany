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
| `zoneStreaming.ts`      | `ZoneStreamingManager` — load a zone's content on entry, dispose the zone left behind (FLO-333). |
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

## Zone streaming (load/unload on travel)

`ZoneStreamingManager` keeps resident memory bounded as the player travels. A
zone's environment is a `ZoneManifest` — a list of placed assets — and the
manager loads the entered zone's content while **disposing the zone left
behind**, so memory never grows with travel distance.

```ts
import { ZoneStreamingManager } from '../game/streaming'

const zones = new ZoneStreamingManager(scene, loader)

await zones.enterZone({
  id: 'forest',
  placements: [
    { assetId: 'forest.tree', position: { x: 3, y: 0, z: -5 }, rotationY: 1.5 },
    { assetId: 'forest.hut' },
  ],
})

await zones.enterZone({ id: 'village', placements: [/* … */] })
// 'forest' content is disposed; only 'village' stays resident.
```

- **Lifecycle, not a new cache** — each placement is a `spawnStreamedInstance`
  (acquire → ref-count++); eviction calls `release()` (ref-count-- → dispose at
  zero). The `loader` cache stays the single authority on which GLBs are in
  memory, so assets shared between zones are not re-fetched on travel and not
  disposed while any resident zone still holds them.
- **Memory budget** — `maxResidentZones` (default `1`) caps how many zones stay
  loaded; crossing a border evicts the least-recently-used zone beyond the
  budget. Raise it to keep neighbours warm at the cost of memory.
- **Serialised transitions** — overlapping `enterZone` calls (rapid travel) run
  in order, so an in-flight load can never leak past its own eviction.
- **`dispose()`** releases every resident zone (scene teardown / return to menu).

### Wired into travel (E3.2 / FLO-345)

The per-zone content lives in **`src/game/streaming/zoneManifests.ts`** as pure,
engine-agnostic data — `getZoneManifest(zoneId)` returns the `ZoneManifest` for a
zone id (matching `playerSlice.zoneId` and the E3.1 registry), falling back to an
empty manifest for zones whose environment is still procedural or not yet built.

The travel trigger is the **`GameCanvas` scene remount keyed on
`playerSlice.zoneId`** (see [world map](./world-map)): a zone change disposes the
current zone scene and boots the destination's. Each zone scene owns its manager
and enters its manifest on boot:

```ts
const zoneManager = new ZoneStreamingManager(scene, loader)
console.info(`[zone] enter ${FOREST_ZONE_ID}`)
void zoneManager.enterZone(getZoneManifest(FOREST_ZONE_ID))
// …on teardown (border crossing / return to menu):
zoneManager.dispose()
```

Because the destination scene is a fresh engine + scene, the previous zone's
content is released both by its manager's `dispose()` and by the engine teardown
— meshes stay bounded across an A→B→A round-trip. The `[zone] enter` /
`[zone] dispose` console lines make the load/unload observable in a browser smoke.

## HUD wiring

`GameCanvas` passes `onAssetLoadingState` into `createGameEngine`, which
dispatches `setAssetPhase` into the `streaming` Redux slice. `App` reads
`selectIsStreamingLoading` and shows a “Loading…” line while any asset is in the
`loading` phase.

## Tests

Vitest stubs `LoadGlbFn` in `loader.test.ts` (cache hit, dispose, error phase).
Registry resolution is covered in `registry.test.ts`. Engine bootstrap skips
streaming when `streamAssetId: null` (jsdom / `NullEngine`).
`zoneStreaming.test.ts` drives the manager over a real loader on a `NullEngine`
and asserts dispose-on-cross, no leak across repeated A↔B round-trips, LRU
eviction, and ref-counted asset sharing between zones.
