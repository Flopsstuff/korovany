# Forest zone stub

The forest zone (E1.3) is the first playable environment in the Phase-1 vertical
slice. It lives in `src/scenes/forestScene.ts` and wires together the full
gameplay spine — streaming assets, third-person controller, follow camera — over
a grassy ground plane with a sparse scatter of low-poly trees, huts, and
lightweight stump/log/rock/shrub clutter around the spawn clearing.

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

1. **Ground** — a `WORLD_SIZE` (600 × 600 unit) `MeshBuilder.CreateGround`
   tessellated with `subdivisions: 6` and `isPickable: true` so the character
   controller's downward ray lands correctly. The shared `createWorldBounds`
   (`src/scenes/worldBounds.ts`) builds it; the forest passes a muted olive-green
   `Color3(0.29, 0.37, 0.23)` (P7.4) — desaturated from the old pure grass green
   so the ground recedes and props/enemies read as the foreground. The ground
   material is **matte** (near-zero `specularColor`) for the flat-shaded low-poly
   look of visual-language v1.2, not a plasticky lit plane.
2. **Streaming** — `AssetRegistry` + `AssetStreamLoader` (same system as E1.2).
   `seedForestAssets` registers the tree and hut URLs. Each prop calls
   `spawnStreamedInstance` which shows a placeholder box immediately and swaps
   to the GLB on load.
3. **Props** — 12 streamed trees and 3 streamed huts placed at hard-coded (x, z)
   coordinates, plus cheap procedural stumps, logs, rocks, and shrubs around the
   spawn clearing. The inner 3.5-unit radius stays clear so the first combat
   beats have readable movement space.
4. **Controller + camera** — the same `CharacterController` and `ThirdPersonCamera`
   from E1.1, spawned at `(0, 2, 0)` above the ground.

## Avatar & ground feel

The player is rendered by the hero GLB (`heroUrl`, default
`/models/korovany_hero_player-default.glb`), loaded through `modelLoader`'s
`loadModel` with `targetSize: 1.8` and `groundIt: true`. The collision capsule
itself is invisible; the GLB root is parented to it at `(0, -0.9, 0)` so the
avatar's feet sit on the ground plane (the "ground feel"), and all hero meshes
are `isPickable: false` so they never intercept the controller's downward ray.
The root is handed to `controller.animator.node` for procedural motion.

**Pose constraint (P7.4 / FLO-420).** The default hero GLB is a single welded
mesh (`node0`, 2894 tris, one material, **no skeleton/bones**). Its arms are
baked into the geometry in a splayed A-pose, so they **cannot be reposed in
code** — there is no rig to rotate and no separable arm sub-mesh. Procedural
animation can only move the whole root (bob/lean), not individual limbs. Bringing
the arms into a natural idle requires re-authoring (rig + repose, or regenerate)
the asset; that is tracked as a 3D-art follow-up, not a scene-code change.

## Scene options

```ts
interface ForestSceneOptions {
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine  // for tests
  heroUrl?: string | null                                       // hero GLB path
  onPlayerDamaged?: (amount: number) => void                    // enemy hit → dispatch
  corpseStore?: CorpseStore                                     // E2.4 persistence
  corpseGlbUrl?: string | null                                  // corpse GLB path
  isPaused?: () => boolean                                      // pause gate (FLO-326)
}
```

Pass `heroUrl: null` / `corpseGlbUrl: null` and inject a `NullEngine` in tests to
skip network fetches.

The returned `ForestScene` exposes `step(dt)` — the exact per-frame function the
render loop runs — so tests can advance the simulation deterministically instead
of relying on `requestAnimationFrame`.

## Pause gating

While the game is **paused** (ESC), the whole forest simulation freezes — soldier
AI, player movement, and melee damage do not advance — so the player **cannot take
damage or die on the pause screen** (FLO-326). The scene still renders the frozen
frame so it stays visible under the React pause overlay.

The gate is the `app.phase` state machine, the single source of truth for "is the
sim live". `GameCanvas` passes `isPaused: () => phase === 'paused'` (read live via
a ref so a pause toggle never remounts the scene), and `step()` early-returns
after `scene.render()` whenever it reports `true`. Death is likewise only processed
while `phase === 'playing'` (see [state-management.md](./state-management.md)),
never while paused.

## Enemies & corpses

The forest spawns at least five Empire soldier patrols (MPG.5, see
[enemy-ai.md](enemy-ai.md)), placed from the zone-content `encounterAnchors`
(`src/game/world/zoneContent.ts`, FLO-411). When a soldier dies the scene
converts it into a persistent, inert corpse via `reapDeadSoldiers` +
`CorpseManager`. Corpses are capped and survive a zone re-enter within a session
— full details in [corpses.md](corpses.md).

## Safe spawn & difficulty curve (P7.1 / FLO-412)

A live audit of the deployed build found the forest first session **unwinnable**:
the player spawned at the origin with a soldier seeded ~8.5 m away — *inside* its
10 m aggro radius — so two patrols converged instantly (~20 HP/s) and killed a
fresh player in ~15 s, before they reached any caravan. The first session is now
made survivable **by placement first, lethality second**:

- **Soldier-free spawn buffer.** No soldier anchor sits within
  `SAFE_SPAWN_BUFFER` (18 m, comfortably above the 10 m `detectionRadius`) of the
  player spawn. An idle player at the origin is never aggroed, and the nearest
  caravan (`caravan-1`, 10 m) sits inside the buffer for a free first raid.
- **Ramped encounter.** The five soldier anchors are distributed by distance:
  one lone first encounter just past the buffer (19 m, dead ahead), the other
  four clustered in pairs guarding the two far caravans (24–26 m). The player
  meets **one** soldier first, not a wall of five on spawn. Total counts are
  unchanged from MPG.5 — only the distribution. The anchors live in
  `zoneContent.ts` (the single source of truth) so the curve is data, not magic
  numbers in the scene.
- **Spawn grace.** As a lethality backstop, soldier hits deal **zero damage** for
  the first `SPAWN_GRACE_SECONDS` (2 s) of live play (`spawnGraceDamageScale`),
  so a player who walks straight into a patrol gets a beat to react instead of
  being deleted on contact. The grace clock advances only while unpaused.

- **Patrol leash.** The buffer above is a *placement* guarantee — but soldiers
  patrol. Each soldier is leashed to within `patrolLeashRadius` (6 m) of its
  spawn anchor (`soldierFSM`, FLO-412), so the lone 19 m soldier can approach the
  origin no closer than 13 m — still outside its 10 m `detectionRadius`. Without
  the leash a patrol drifts unbounded and re-enters the cleared spawn within
  ~30 s, which is exactly the regression the survival guard test now catches.

The player walks at 4 m/s versus the soldier chase speed of 3 m/s, so a careful
player can kite a cluster and pull patrols one at a time — challenge is retained,
not removed. Global `DEFAULT_SOLDIER_PARAMS` are untouched (the human-lands zone
keeps its tuning); all changes are local to the forest zone.

## Tests

- `forestScene.test.ts` — `seedForestAssets` (registry entries + sizes), spawn
  clutter placement, scene boot (live camera, capsule, ground pickable), dispose
  idempotency, corpse re-spawn on boot, the `reapDeadSoldiers` live→corpse
  transition, the **pause-gating** regression (FLO-326): stepping the scene while
  paused moves no soldier and deals no player damage, with a live control proving
  combat does advance when unpaused, and the **safe-spawn & difficulty curve**
  guards (FLO-412): no soldier within `SAFE_SPAWN_BUFFER` of the spawn, exactly
  one first-encounter soldier, and the spawn grace nullifying then restoring damage.
