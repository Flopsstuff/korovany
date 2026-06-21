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
| `treeImpostor.ts`       | `attachTreeImpostor` — billboard LOD for distant trees with anti-pop hysteresis + `measureLODRender` (FLO-394/393). |
| `instancedVegetation.ts` | `createInstancedVegetation` — thin-instance a tree GLB across many placements (one draw call per submesh) + `measureVegetationDrawCalls` (FLO-396). |
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

## Tree impostors (distance LOD)

The dense forest (Phase 5, FLO-391) places many copies of one tree GLB
(`forest-tree.glb`, ~1357 tris). Drawing every copy at full detail is wasteful
when, past a few dozen units, only the silhouette is legible.
`attachTreeImpostor(scene, model.meshes, options)` collapses a distant tree to a
single **billboard plane** (2 tris) carrying a flat snapshot of the tree.

```ts
import { attachTreeImpostor, DEFAULT_IMPOSTOR_SWAP_DISTANCE } from '../game/streaming'

const tree = await loadModel(scene, '/models/forest-tree.glb', { targetSize: 4 })
const impostor = attachTreeImpostor(scene, tree.meshes, {
  swapDistance: 35, // camera distance (units) beyond which the billboard takes over
  hysteresisBand: 5, // anti-pop dead-zone half-width (default); 0 = hard cut
  // texture: sharedAtlas, // reuse one bake across many trees of the same species
})
// …on teardown:
impostor.dispose()
```

**Mechanism — Babylon native LOD.** The impostor plane is registered as the
tree's far LOD level via `mesh.addLODLevel(swapDistance, plane)`; sibling meshes
(e.g. a separate trunk) get `addLODLevel(swapDistance, null)` so the far tree is
*exactly one* billboard. Babylon swaps by camera distance during active-mesh
evaluation — no per-frame loop. A mesh used as an LOD level is **linked** and
never rendered on its own, so there is no double-draw, and instances of an
LOD-equipped mesh inherit its levels (compatible with the future thin-instanced
forest, E5.3).

**Texture — one-shot side snapshot.** When no `texture` is supplied, the model
is rendered once from an orthographic side view into a `RenderTargetTexture`
(alpha preserved, alpha-tested at 0.4) — no offline build step. The billboard
uses `BILLBOARDMODE_Y` so trees stay upright and rotate only around the vertical
axis to face the camera. Under a headless `NullEngine` (tests) the bake is a
no-op and the plane falls back to a flat green stand-in; the LOD wiring is
identical.

**Anti-pop hysteresis (E5.2, FLO-393).** A single-distance swap flickers when the
camera lingers right on the threshold. `attachTreeImpostor` wraps the source
meshes' `getLOD` with a small stateful dead-zone: the full→impostor swap fires at
`swapDistance + hysteresisBand` and only reverts at `swapDistance − hysteresisBand`,
so the state can't oscillate inside the band. Because Babylon already calls
`getLOD` once per mesh per frame during active-mesh evaluation, this needs **no
loop of its own** and stays per-instance — there is no separate LOD manager. All
of a tree's meshes share one resolved state (distance measured from the primary's
bounding sphere), so the canopy billboard and the trunk cull in lockstep rather
than a few units apart. `hysteresisBand` defaults to
`DEFAULT_HYSTERESIS_BAND` (5 units); pass `0` for a hard single-distance cut. The
same dead-zone is applied to the optional `cullDistance` boundary, which can drop
the impostor entirely past a far range. Thin-instancing the whole forest remains
**E5.3**.

**Measuring the win.** `measureLODRender(sources, camera)` resolves each source
mesh through its LOD chain (full mesh → impostor → culled) and sums the meshes +
triangles that actually render — pure CPU, so before/after numbers are
deterministic even under `NullEngine`. The `?dev=impostor` benchmark scene
(`src/scenes/impostorBench.ts`) plants a 16×16 grid (256 trees) sharing one
baked texture and logs the full-detail vs. impostor cost to the console and
`window.__korovanyImpostorBench`.

## Instanced vegetation (thin-instances, E5.3)

Impostors cut *triangles* far away; they do nothing for the *draw-call* cost of a
dense forest. Cloning a tree GLB once per position gives one draw call **per
submesh per tree** — a 256-tree forest of a 2-submesh tree is 512 draw calls, and
draw-call submission (not triangle count) is the CPU bottleneck on mid hardware.
`createInstancedVegetation(root, model.meshes, placements)` packs every copy of
each submesh into a single Babylon **thin-instance** matrix buffer, so the whole
scatter renders in **one draw call per submesh** regardless of count.

```ts
import { createInstancedVegetation, measureVegetationDrawCalls } from '../game/streaming'

const tree = await loadModel(scene, '/models/forest-tree.glb', { targetSize: 4 })
const forest = createInstancedVegetation(tree.root, tree.meshes, [
  { position: { x: 0, y: 0, z: 0 } },
  { position: { x: 6, y: 0, z: 0 }, rotationY: Math.PI / 2, scale: 1.2 },
  // …one entry per tree
])
measureVegetationDrawCalls(forest) // { trees, naiveDrawCalls, instancedDrawCalls, drawCallReduction }
// …on teardown:
forest.dispose()
```

**Mechanism — matrix composition.** Babylon composes a thin instance at render
time as `finalWorld = meshWorldMatrix × instanceBuffer`. A tree GLB is a
hierarchy (trunk + canopy submeshes under a transform root), so each submesh
carries a non-trivial pose relative to the root. `createInstancedVegetation`
captures that pose (`protoLocal = submeshWorld · rootWorld⁻¹`), **re-homes each
submesh to an identity world matrix**, and bakes `protoLocal · placement` into the
per-instance buffer — so with the mesh world identity, `finalWorld =
instanceBuffer` is exactly the placed submesh. The now-empty transform root is
disposed; the source submeshes *become* the instanced batch. `staticBuffer`
defaults to `true` (the scatter is fixed once placed).

**Relationship to impostors.** The two layers attack different costs and don't
compose for free: Babylon resolves LOD per-mesh, but a thin-instance batch shares
one mesh, so per-instance impostor LOD over a batch is a later concern (E5.4 perf
budget — the natural shape is distance-bucketed batches: a near full-geometry
batch and a far billboard batch). This module is the batching primitive on its
own.

**Measuring the win.** `measureVegetationDrawCalls(forest)` is pure arithmetic
over the handle (`naiveDrawCalls = submeshes × trees` vs. `instancedDrawCalls =
submeshes`), so it is deterministic under `NullEngine`. The `?dev=vegetation`
benchmark scene (`src/scenes/vegetationBench.ts`) plants a 16×16 grid (256 trees)
as one batch and logs the reduction to the console and
`window.__korovanyVegetationBench`.

**Holding the frame.** The draw-call and triangle ceilings these layers exist to
respect — and the live profiler / `?dev=perf` bench that grades against them — are
documented in [performance-budget.md](performance-budget.md) (E5.4).

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
