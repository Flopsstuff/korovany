# Forest zone stub

The forest zone (E1.3) is the first playable environment in the Phase-1 vertical
slice. It lives in `src/scenes/forestScene.ts` and wires together the full
gameplay spine — streaming assets, third-person controller, follow camera — over
a grassy ground plane with a sparse scatter of low-poly trees and huts.

## Try it

Open the app with the `?dev=forest` flag:

```
https://korovany.aimost.pl/?dev=forest   # or http://localhost:5173/?dev=forest
```

The scene loads immediately with placeholder boxes for each prop; the real GLBs
(forest-tree.glb, wooden-hut.glb) stream in and swap. Controls are identical to
the [character controller](./character-controller.md):

| Action | Key |
| ------ | --- |
| Move | **W A S D** |
| Sprint | hold **Shift** |
| Jump | **Space** |
| Look | mouse (click to lock pointer) |

## Assets

| Asset | Registry id | File | Tris |
| ----- | ----------- | ---- | ---- |
| Conifer tree | `env.forest-tree` | `public/models/forest-tree.glb` | 1357 |
| Wooden hut | `env.wooden-hut` | `public/models/wooden-hut.glb` | 1893 |

Both were generated in [FLO-299](/FLO/issues/FLO-299) by Pygmalion using the
Meshy pipeline under visual-language v1.2 (≤ 3000 tris). Register them via
`seedForestAssets(registry)` from `src/scenes/forestScene.ts`.

## How it works

`createForestScene(canvas, options)` boots a Babylon `Scene` and:

1. **Ground** — a 60 × 60 unit `MeshBuilder.CreateGround` with `isPickable:
   true` so the character controller's downward ray lands correctly.
2. **Streaming** — `AssetRegistry` + `AssetStreamLoader` (same system as E1.2).
   `seedForestAssets` registers the tree and hut URLs. Each prop calls
   `spawnStreamedInstance` which shows a placeholder box immediately and swaps
   to the GLB on load.
3. **Props** — 12 trees and 3 huts placed at hard-coded (x, z) coordinates that
   keep a 4-unit clear zone around the spawn point. Static for the stub; LOD
   and procedural scatter are Phase 5.
4. **Controller + camera** — the same `CharacterController` and `ThirdPersonCamera`
   from E1.1, spawned at `(0, 2, 0)` above the ground.

## Scene options

```ts
interface ForestSceneOptions {
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine  // for tests
  heroUrl?: string | null                                       // hero GLB path
}
```

Pass `heroUrl: null` and inject a `NullEngine` in tests to skip network fetches.

## Tests

- `forestScene.test.ts` — `seedForestAssets` (registry entries + sizes), scene
  boot (live camera, capsule, ground pickable), dispose idempotency.
