# Generated 3D assets

Catalog of the game's generated 3D models. All models are produced **per
concrete character/prop ticket only** (never speculatively — board directive
[FLO-270](/plan/game-plan)) via the `tools/meshy-3d` pipeline, in **low-poly
visual language v1.2** (≤ 3000 tris/object, flat-shaded palette materials).

Files live under `public/models/*.glb` and stream into the scene through the
[asset-streaming](./asset-streaming) registry. Binaries are stored in **Git
LFS** (see `.gitattributes`). Generation is reproducible from the recorded Meshy
task id (`python tools/meshy-3d/meshy.py status <task_id> --kind text-to-3d`).

> **Audio:** this catalog covers **binary visual assets only**. The game ships
> **no audio files** — sound effects are synthesized procedurally at runtime
> (raw Web Audio), so there is nothing to license or store in LFS. See
> [`audio.md`](./audio) for the SFX system and the synthesis rationale.

## Licensing

Generated assets are cleared for FlopBut's intended (incl. commercial) use under
the Meshy paid-plan terms, which grant full commercial ownership of generated
output. No infringing reference inputs are used, and these assets are kept out of
any Community/showcase page.

## Characters & props

> **Player avatar — flat-albedo survivor GLB, faceted in-engine, live (FLO-440 → FLO-443).**
> The live player visual is the `korovany_hero_player-default.glb` survivor avatar
> (2,884 tris · 1× 1024 flat base-color), mounted by `mountSurvivorAvatar`
> (`src/scenes/survivorAvatar.ts`) across the forest, human-lands, and
> controller-playground scenes. An earlier interim used a procedural box-fighter
> (`playerAvatar.ts`, FLO-422) while the GLB carried two defects — a wide arms-out
> "scarecrow" T-pose and a semi-realistic surface; **both are fixed in the GLB**:
> FLO-434 reposed it to a natural arms-down survivor idle, FLO-440 re-textured it to
> a flat, matte, unlit base-color (v1.2-compliant — see hero README v13), and FLO-443
> wired it in (retiring the box-fighter). The GLB is **rig-less**: the mount applies
> `mesh.convertToFlatShadedMesh()` + a matte material at load (as `worldBounds.ts`
> does for the ground) so the faceted hard-edge read lands, and whole-body
> bob/lean/lunge/topple drive the single `root` via the animator contract.
>
> **Combat-state swap (FLO-481 / plan step 2 of FLO-474).** The player now has two
> distinct visual states. Alongside the neutral `…-default.glb`, combat scenes mount
> `korovany_hero_player-attack.glb` — a drop-in strike-pose twin (2,905 tris, same
> bbox/scale/identity, FLO-480) — and toggle which one renders by combat state:
> **default while idle, attack while a melee swing is in flight** (the
> windup/active/recovery phases). `mountSurvivorAvatar(scene, mount, heroUrl,
> attackUrl)` loads both and parents them under the capsule at the same foot offset;
> `CharacterController.setAttackPhase` edge-fires a registered swap on the
> idle↔swing transition (so it flips twice per swing, not every frame). Because the
> two GLBs share a bbox the swap needs no scale/position correction, and there is no
> animation playback — the static loader simply switches the visible mesh (FLO-440
> swap-by-URL pattern). Live in forest, human-lands, mountains, and empire (every
> scene with melee); the controller-playground (no combat) stays default-only.

> **Art coherence — every character is faceted in-engine (FLO-452).**
> The player is not the only character that gets the flat-shaded treatment. The
> shipped enemy/hero GLBs are smooth, semi-glossy meshes, so the same in-engine
> facet+matte conform is applied at GLB-load time to **every** character so they
> all read in one v1.2 low-poly band: the **enemy soldier** (`soldierEnemy.ts`),
> the **corpse body** (`corpseManager.ts`), and the **menu / won / lost "defeat
> screen" backdrop hero** (`engine/index.ts`, streamed via `createGameEngine`).
> The treatment is single-sourced in `src/game/util/flatShade.ts`
> (`facetMeshes` / `mattenMaterial` / `flatShade`), which `survivorAvatar.ts` also
> uses — so all characters share exactly one definition of "flat low-poly." Note
> this supersedes the interim procedural-box approach once explored for FLO-452:
> with the player now a faceted GLB (FLO-447), box enemies would *break* coherence,
> not create it; matching the player's faceted-GLB read is the correct conform.
> As with the player, the faceting only manifests at runtime, so the visual-truth
> gate is an in-scene screenshot, never code inspection.

| Asset | File | Tris | Size | Rig | Meshy task id |
|-------|------|------|------|-----|---------------|
| **Player hero (survivor) — neutral/idle** *(v1.2-compliant; live)* | `public/models/korovany_hero_player-default.glb` | 2884 | 298 KiB | static (no skeleton); arms-down idle (FLO-434) + flat-albedo re-author (FLO-440, v13) | `019ee92c-e565-7b9c-b7e5-cad74053e786` (geometry preview) / `019ee94d-b328-7308-a8fa-d5274bcc1a99` (flat retexture) |
| **Player hero (survivor) — attack pose** *(v1.2-compliant; live, swapped by combat state FLO-481)* | `public/models/korovany_hero_player-attack.glb` | 2905 | 295 KiB | static (no skeleton); forward strike, drop-in twin of default (FLO-480) | — |
| Conifer tree | `public/models/forest-tree.glb` | 1357 | — | static | — |
| Wooden hut | `public/models/wooden-hut.glb` | 1893 | — | static | — |
| Chest *(wired: forest static loot decor, FLO-470)* | `public/models/chest.glb` | — | — | static | — |
| **Empire soldier (enemy)** | `public/models/empire-soldier.glb` | **2794** | 130 KiB | static (no skeleton) | `019ee601-93f0-7988-86f8-e35ce1067881` |
| **Roadside shrine (Salt Road)** | `public/models/roadside-shrine.glb` | **1984** | 394 KiB | static | `019ee73a-c8a6-73bd-a2ec-e21137a6dba2` (preview) / `019ee747-ae35-786a-a8c7-490e65d0cddd` (retexture) |
| **Empire toll gate** *(wired: human-lands landmark, FLO-478)* | `public/models/toll-gate.glb` | **1947** | 378 KiB | static | preview `019ee748-205e-763a-a883-bdda11e91c7e` · retexture `019ee749-ae59-7680-aa94-e6a8842c7bd5` |
| **Caravan wagon (Salt Road)** *(wired: caravan enemy visual + forest static prop, FLO-470)* | `public/models/caravan-wagon.glb` | **2827** | 394 KiB | static | `019ee749-d4cf-79b9-b813-d98be2201197` (preview) / `019ee74d-2300-772c-8a22-612c27dd99dc` (retexture) |
| **Cargo crate (Salt Road)** *(wired: forest cargo decor, FLO-470)* | `public/models/cargo-crate.glb` | **1022** | 296 KiB | static | `019ee743-a02c-7878-a22e-7b67cdfbafa6` (preview) |
| **Ruined watchtower (Salt Road)** *(wired: forest landmark, FLO-476)* | `public/models/watchtower.glb` | **2564** | 379 KiB | static | `019ee749-6051-7990-b286-98be4ecf82b4` (retexture) |
| **Ranged enemy (archer)** | `public/models/ranged-archer.glb` | **2589** | 258 KiB | static (no skeleton) | preview `019ee91a-3128-705b-8acc-3d10e03e9930` · retexture `019ee91c-7315-78b1-8841-a90f77930d17` |
| **Empire palace-guard** | `public/models/empire-palace-guard.glb` | **2793** | 357 KiB | static (no skeleton) | retexture `019ee91c-7f15-78b4-9665-5f7c18268eec` (of soldier `019ee601-93f0-7988-86f8-e35ce1067881`) |

### Empire toll gate — Phase 3.5 (Salt Road pack)

Salt Road landmark and navigation anchor (world-specs.md §1). Generated for [FLO-373](/FLO/issues/FLO-373).

- **Budget:** 1947 tris ≤ 2500 (v1.2). Bounding box ≈ 2.0 × 1.6 × 0.7 units (road-spanning prop). Textured (retexture pass). Web payload **378 KiB** — in line with the other Salt Road props (296–394 KiB).
- **Provenance:** Meshy text-to-3D preview at `--target-polycount 2000 --art-style realistic`, followed by retexture pass. Prompt: *"low-poly stylized empire toll gate, two wooden barrier arms across a road, small wooden ledger booth, tall flagpole with imperial banner, weathered wood and iron, faceted flat-shaded, austere straight imperial design, readable silhouette"*. Retexture style: *"weathered wood planks, rusted iron fittings, imperial red and gold banner, stone road surface, earthy tones, flat low-poly colors"*. 20 preview + 10 retexture = 30 Meshy credits.
- **Texture budget (FLO-477):** Meshy retexture embedded a single 2048² PBR JPEG (~4.0 MiB), pushing the GLB to 4.1 MiB — ~10× over the Salt Road web budget on a 1947-tri mesh. Downscaled to **1024²** (q85) via `tools/meshy-3d/resize_glb_textures.py`, recompacting the BIN chunk; mesh/accessor data is byte-identical, so the faceted/matte silhouette is untouched (texture 4015 KiB → 263 KiB; GLB 4130 KiB → 378 KiB). No Meshy credits spent (purely local repack).
- **Rig:** static mesh, no skeleton.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs public/models/toll-gate.glb` → 2 meshes, 1947 tris, no errors. Resized texture atlas inspected: empire palette (grey planks, red/gold banner) and matte stylized read preserved.
- **Wired (FLO-478):** `spawnTollGateProp` in `src/scenes/tollGateProp.ts` mounts the GLB at the `toll-gate` landmark position from `zoneContent`, applies the shared `flatShade()` matte/faceted conform, and removes the procedural greybox placeholder from `humanLandsScene.ts`.

### Ruined watchtower (Salt Road landmark) — Phase 3.5 / MPG

Tall round ruined stone tower, 3–4 stories, two crenellated tiers, a doorway at
the base and a rubble skirt — a strong vertical silhouette to serve as a
navigation anchor on the Velya Salt Road
([world-specs](./worlds/velya-salt-road), `world-specs.md` landmark list).
Generated for [FLO-374](/plan/game-plan); replaces the placeholder colored box
in `src/scenes/humanLandsScene.ts`.

- **Budget:** 2564 tris — 64 over the per-asset 2500 target but within the
  binding v1.2 cap (≤ 3000 tris/object). Kept the clean retextured mesh rather
  than decimating a *textured* model (post-texture `simplify` risks UV-seam
  artifacts; this is a single static landmark, not an instanced prop, so the 2.5%
  overage costs nothing at runtime). Bounding box ≈ 1.12 × 2.0 × 1.12 Meshy
  units — engineering should scale it up in-scene to read as a 3–4 story tower
  (real-world ≈ 10–14 m tall); up-axis +Y, pivot at base centre.
- **Textured (board mandate — not grey):** weathered pale grey stone with cracked
  stonework, baked into a single 1024² base-color map (JPEG, lighting removed for
  flat low-poly shading). Geometry-preserving **Meshy retexture** (preferred over
  PBR refine for low-poly), then textures resized 3.6 MB → 241 KiB via
  `tools/meshy-3d/resize_glb_textures.py --max 1024 --quality 85`, taking the GLB
  from 3.7 MB to **379 KiB** for the web payload budget.
- **Provenance:** Meshy text-to-3D preview → retexture.
  - Preview prompt: *"low-poly stylized ruined stone watchtower, tall round
    tower 3-4 stories, cracked broken stonework, partly collapsed top, weathered
    pale grey stone, faceted flat-shaded, strong vertical silhouette visible from
    distance, fantasy ruin"*.
  - Retexture style prompt: *"weathered pale grey stone, faceted flat-shaded
    low-poly, dusty sun-bleached fantasy ruin, cracked broken stonework, muted
    earthy palette"*. Retexture task id `019ee749-6051-7990-b286-98be4ecf82b4`,
    10 Meshy credits.
- **Rig:** ships **static** (no skeleton) — it is scenery, not animated.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/watchtower.glb` → 2 meshes, 2564 tris, no errors.
- **Wiring:** FLO-476 places the GLB in the first forest map as
  `landmark.forest-watchtower`, streamed through `defaultLoadGlb()` with the
  matte/faceted conform. The canonical Salt Road / human-lands landmark remains a
  separate scene-wiring concern; this forest placement is the board-requested
  first-map landmark.

### Empire soldier (enemy) — Phase 2

Napoleonic-era Empire infantryman: bicorne hat, greatcoat, boots, musket held
across the body. Generated for [FLO-311](/plan/game-plan) (feeds the enemy-NPC
ticket E2.3).

- **Budget:** 2794 tris ≤ 3000 (v1.2). Bounding box ≈ 0.97 × 1.90 × 0.84 units
  (humanoid, ~1.9 tall). Preview-only — no PBR textures (refine is skipped for
  v1.2; PBR refine drifts the faceted low-poly look into a semi-realistic band).
- **Provenance:** Meshy text-to-3D preview, `--art-style realistic
  --target-polycount 3000`. Prompt: *"low-poly stylized empire soldier enemy,
  humanoid game character standing in a neutral A-pose, military uniform with
  peaked helmet and boots, holding a musket rifle, faceted flat-shaded surfaces,
  muted grey-green palette, full body, single character"*. Meshy emitted 3105
  tris; welded + decimated to 2794 with `gltf-transform` (`weld` → `simplify
  --ratio 0.9 --error 0.01`) to fit the budget — silhouette/bbox unchanged. 20
  Meshy credits (preview only).
- **Rig:** ships **unrigged (static mesh, no skeleton/animation clips)** — this
  matches the player hero GLB, which is also a static mesh, so the same loader /
  controller code handles it without special-casing. There is **no hero rig to
  reuse** (hero has 0 skeletons). E2.3 must therefore drive idle/walk/attack/death
  either procedurally (transform-level) or by adding a skeletal rig in a separate
  pass (Meshy auto-rigging is available but was out of scope for this asset-only
  ticket). Flag rig needs to Pygmalion if a skeletal pass is wanted.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/empire-soldier.glb` → 2 meshes, 2794 tris, no errors.

### Ranged enemy (archer) — Phase 8

A ranged-combat archetype with a **deliberately distinct silhouette from the
empire soldier** (the soldier holds a musket across the body; this archer holds
a drawn longbow with a back quiver and a hood). Feeds Phase 8 zones and combat
depth ([FLO-426](/FLO/issues/FLO-426), parent [FLO-423](/plan/game-plan)).

- **Budget:** 2589 tris ≤ 3000 (v1.2), within the char tier. Bounding box ≈
  0.62 × 2.0 × 1.12 units (humanoid; the bow extends the Z depth — that's the
  silhouette). Textured, **357 KiB → 258 KiB** GLB. Up-axis +Y, pivot at base.
- **Provenance:** Meshy text-to-3D **preview** at `--art-style realistic
  --target-polycount 2500 --topology triangle`, then a geometry-preserving
  **retexture** (flat/unlit albedo — the v1.2-preferred path over PBR refine,
  which drifts low-poly into a semi-realistic band, see
  `tools/meshy-3d/API-FITNESS.md`).
  - Preview prompt: *"low-poly stylized archer enemy, humanoid game character
    standing drawing a longbow, hooded leather jerkin and soft cap, quiver of
    arrows on the back, lean ranger build, faceted flat-shaded surfaces, muted
    earthy palette, full body, single character"* (negative: *"high-poly, smooth
    subdivision, photorealistic, gun, musket, rifle"*).
  - Retexture style: *"hooded woodland ranger archer, dark forest-green hood and
    cloak, brown leather jerkin and bracers, tan leather quiver of arrows, plain
    wooden longbow, weathered brown boots, flat low-poly unlit faceted color
    zones, muted earthy forest palette"*. Embedded maps resized to ≤1024 via
    `tools/meshy-3d/resize_glb_textures.py --max 1024 --quality 85` (2.9 MB →
    258 KiB). 20 preview + 10 retexture = 30 Meshy credits.
- **Rig:** ships **static (no skeleton)** — matches the soldier/hero, so the same
  loader/controller handles it. A skeletal/animation pass (Meshy auto-rig) is a
  separate future ticket; flag Pygmalion if wanted.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/ranged-archer.glb` → 2 meshes, 2589 tris, no errors.

### Empire palace-guard — Phase 8

An ornate **ceremonial** variant for the Empire zone — crimson dress coat with
gold braid and epaulettes, white crossbelts, plumed bicorne — reading clearly
distinct from the field soldier's muted grey-green. **Reuse-first
([FLO-426](/FLO/issues/FLO-426)): no fresh generation** — this is a
geometry-preserving **retexture of the existing empire-soldier mesh**, which
also gives that shared silhouette a *textured* delivery (the soldier itself
ships preview-only/untextured).

- **Budget:** 2793 tris ≤ 3000 (v1.2). Bounding box ≈ 1.01 × 2.0 × 0.88 units —
  identical geometry to the soldier. Textured, **357 KiB** GLB.
- **Provenance:** Meshy **retexture** of the locally-decimated 2794-tri soldier
  GLB, sourced via a `data:` URI (not the soldier's *task id* — Meshy's stored
  task is the undecimated 3105-tri original, which would land over the 3000-tri
  ceiling; texturing the shipped decimated GLB keeps it in budget without a
  post-texture decimation that risks UV-seam artifacts). Retexture style:
  *"imperial palace ceremonial guard, ornate crimson red dress coat with gold
  braid and shoulder epaulettes, white crossbelts over the chest, tall black
  bearskin ceremonial helmet, polished black boots, flat low-poly unlit faceted
  color zones, regal imperial crimson and gold palette"*. Maps resized to ≤1024
  (3.2 MB → 357 KiB). 10 Meshy credits.
- **Rig:** ships **static (no skeleton)** — inherits the soldier's mesh.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/empire-palace-guard.glb` → 2 meshes, 2793 tris, no errors.
- **In-scene (Human Lands):** two static ceremonial guards flank the Empire toll
  gate on the Salt Road, spawned by `spawnPalaceGuardProps` in
  `src/scenes/palaceGuardProp.ts` and wired from `humanLandsScene.ts` (FLO-471).
  No AI or combat registration — pure decor. The textured GLB gets the same
  in-engine `flatShade` conform as other characters (FLO-452).

### Roadside shrine (Salt Road) — Phase 3.5 (MPG)

Humble rural Salt Road landmark ([world-specs](/plan/world-specs) §1), replacing
the placeholder colored box in `src/scenes/humanLandsScene.ts`. Small weathered
stone structure with an arched niche, aged-wood back, and a low offering ledge —
a readable, distinct silhouette. Generated for [FLO-375](/plan/game-plan).

- **Budget:** 1984 tris ≤ 2000 (within ticket budget), **394 KiB** web payload.
  Bounding box ≈ 1.52 × 2.00 × 1.15 units (real-world scale, ~2 m tall).
- **Textured** (board mandate — never grey): single 1024² base-color map,
  flat/unlit albedo (worn pale stone with moss accents + aged grey-brown wood).
- **Provenance:** Meshy text-to-3D **preview** (`019ee73a-…`, geometry only,
  1985 tris, 20 cr) → **retexture** (`019ee747-…`, geometry-preserving UV-unwrap
  + paint, 10 cr) → `resize_glb_textures.py --max 1024 --quality 85` (4.3 MiB →
  394 KiB, mesh bytes untouched). Retexture over PBR refine keeps the faceted
  low-poly silhouette ([meshy PBR drift](#) — see `API-FITNESS.md`). Prompt:
  *"low-poly stylized roadside shrine, small weathered stone structure with an
  arched niche, simple offering ledge, worn pale stone and aged wood, faceted
  flat-shaded, humble rural fantasy aesthetic, readable silhouette"*; retexture
  style prompt: *"worn pale weathered stone shrine with aged grey-brown wood,
  humble rural fantasy, flat low-poly muted earthy palette, faceted unlit
  albedo"*.
- **Rig:** static prop — no skeleton.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/roadside-shrine.glb` → 2 meshes, 1984 tris, 1 embedded texture,
  no errors.
- **Handoff:** wiring this GLB into the scene (replacing the procedural box in
  `humanLandsScene.ts`) is engineering's job — handed to Daedalus/CTO.

### Caravan wagon (Salt Road) — Phase 3.5 (MPG)

The raid-loop centerpiece ("грабить корованы", E3.3; MPG.5 spawns caravans across
forest + human-lands). Replaces the procedural brown box stand-in in
`src/scenes/caravanEnemy.ts` (~line 94, `CreateBox 1.6 × 1.2 × 2.4`). Merchant
wagon with a wooden frame, fabric canopy cover, four spoked wheels and a cargo
bed — a readable wagon silhouette turns the abstract crate into a tactile target.
Generated for [FLO-371](/plan/game-plan).

- **Budget:** 2827 tris ≤ 3000 (v1.2), **394 KiB** web payload. Bounding box ≈
  2.00 × 1.69 × 1.09 units (real-world scale; wagon length runs along **+X**).
  Note for wiring: the placeholder box is `1.6 (w) × 1.2 (h) × 2.4 (d)` with the
  long axis on **Z** — engineering should rotate ~90° about Y and scale to taste
  so the wagon length aligns with the caravan's travel axis.
- **Textured** (board mandate — never grey): single 1024² base-color map,
  flat/unlit albedo (weathered tan-brown wood, off-white travel-worn canopy,
  dark iron-banded wheels).
- **Provenance:** Meshy text-to-3D **preview** (`019ee749-…`, `--art-style
  realistic --target-polycount 3000`, 3042 tris, 5 cr) → `gltf-transform` weld +
  `simplify --ratio 0.93 --error 0.01` to 2827 tris (silhouette/bbox unchanged) →
  **retexture** (`019ee74d-…`, geometry-preserving UV-unwrap + paint of the
  decimated mesh via data-URI, 10 cr) → `resize_glb_textures.py --max 1024
  --quality 85` (3.6 MiB → 394 KiB, mesh bytes untouched). Retexture over PBR
  refine keeps the faceted low-poly silhouette. Preview prompt: *"low-poly
  stylized merchant wagon, wooden frame with fabric canopy cover, four spoked
  wooden wheels, weathered travel-worn wood and cloth, faceted flat-shaded,
  neutral tan-brown palette, readable side and front silhouette, fantasy medieval
  cargo wagon"*; retexture style prompt: *"weathered tan-brown wooden wagon frame,
  off-white travel-worn fabric canopy cover, dark iron-banded wheel rims, flat
  muted low-poly colors, no gloss, fantasy medieval merchant cargo wagon"*.
- **Rig:** static prop — no skeleton.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/caravan-wagon.glb` → 2 meshes, 2827 tris, 1 embedded texture,
  no errors.
- **Wiring:** connected in FLO-470. `CaravanEnemy` now keeps the procedural box
  as the invisible gameplay proxy and mounts this GLB as the visible wagon body,
  with `flatShade()` applied at load. The forest manifest also places one static
  wagon prop near the spawn-side raid route.

### Cargo crate (Salt Road) — Phase 3.5 (MPG)

Instanceable static loot prop for caravan cargo clusters and roadside scatter
(Salt Road pack). Small weathered wooden crate with iron corner bands — a
readable, stackable silhouette for loot piles beside the caravan wagon.
Generated for [FLO-372](/FLO/issues/FLO-372).

- **Budget:** 1022 tris ≤ 1200 (ticket budget), **296 KiB** web payload.
  Bounding box ≈ 2.00 × 1.35 × 1.34 units (real-world scale).
- **Textured** (board mandate — never grey): single 1024² base-color map,
  flat/unlit albedo (weathered brown planks + iron corner bands).
- **Provenance:** Meshy text-to-3D **preview** (`019ee743-a02c-7878-a22e-7b67cdfbafa6`,
  `--art-style realistic`, 1022 tris, 20 cr) → geometry-preserving **local**
  retexture via data-URI (server retexture `019ee8d6-…` produced a 28k-tri blob
  and was rejected to preserve the faceted silhouette) →
  `resize_glb_textures.py --max 1024 --quality 85` (mesh bytes untouched).
  Preview prompt: *"low-poly stylized wooden cargo crate, rough rectangular
  planks, iron corner bands, weathered wood, faceted flat-shaded, neutral brown,
  small stackable game prop"*.
- **Rig:** static prop — no skeleton.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs
  public/models/cargo-crate.glb` → 2 meshes, 1022 tris, 1 embedded texture,
  no errors.
- **Wiring:** connected in FLO-470 as static forest loot decor via
  `FOREST_CARGO_CRATE_ASSET_ID` in the zone streaming manifest.

### Forest leftover props — FLO-470

FLO-470 wires the remaining visible-but-unused GLBs into the forest scene through
the same streaming manifest used by the tree/hut props:

- `chest.glb` → `prop.forest-chest`, four forest healing chests. Standing within
  2.25 m restores 5 HP every 0.5 s; the chests are reusable cooldown stations.
- `cargo-crate.glb` → `prop.forest-cargo-crate`, one static cargo prop beside the
  forest wagon camp.
- `caravan-wagon.glb` → `prop.forest-caravan-wagon`, one prominent static wagon
  prop; also the live `CaravanEnemy` visual.
- `korovany_hero_player-default.glb` → `npc.forest-static-elf`, two static
  decorative forest elves.
- `watchtower.glb` → `landmark.forest-watchtower`, one large static ruined tower
  placed near the first forest map as a visible silhouette landmark (FLO-476).

All streamed GLBs go through `defaultLoadGlb`, which normalizes them with
`loadModel()` and applies the shared `flatShade()` matte/faceted conform before
placement so they stay in the v1.2 low-poly visual band.
