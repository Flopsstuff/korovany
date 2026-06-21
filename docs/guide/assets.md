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

| Asset | File | Tris | Size | Rig | Meshy task id |
|-------|------|------|------|-----|---------------|
| Player hero (elf) | `public/models/korovany_hero_player-default.glb` | 2894 | — | static (no skeleton) | — |
| Conifer tree | `public/models/forest-tree.glb` | 1357 | — | static | — |
| Wooden hut | `public/models/wooden-hut.glb` | 1893 | — | static | — |
| Chest | `public/models/chest.glb` | — | — | static | — |
| **Empire soldier (enemy)** | `public/models/empire-soldier.glb` | **2794** | 130 KiB | static (no skeleton) | `019ee601-93f0-7988-86f8-e35ce1067881` |
| **Roadside shrine (Salt Road)** | `public/models/roadside-shrine.glb` | **1984** | 394 KiB | static | `019ee73a-c8a6-73bd-a2ec-e21137a6dba2` (preview) / `019ee747-ae35-786a-a8c7-490e65d0cddd` (retexture) |
| **Empire toll gate** | `public/models/toll-gate.glb` | **1947** | 4.1 MiB | static | preview `019ee748-205e-763a-a883-bdda11e91c7e` · retexture `019ee749-ae59-7680-aa94-e6a8842c7bd5` |
| **Caravan wagon (Salt Road)** | `public/models/caravan-wagon.glb` | **2827** | 394 KiB | static | `019ee749-d4cf-79b9-b813-d98be2201197` (preview) / `019ee74d-2300-772c-8a22-612c27dd99dc` (retexture) |
| **Ruined watchtower (Salt Road)** | `public/models/watchtower.glb` | **2564** | 379 KiB | static | `019ee749-6051-7990-b286-98be4ecf82b4` (retexture) |

### Empire toll gate — Phase 3.5 (Salt Road pack)

Salt Road landmark and navigation anchor (world-specs.md §1). Generated for [FLO-373](/FLO/issues/FLO-373).

- **Budget:** 1947 tris ≤ 2500 (v1.2). Bounding box ≈ 2.0 × 1.6 × 0.7 units (road-spanning prop). Textured (retexture pass).
- **Provenance:** Meshy text-to-3D preview at `--target-polycount 2000 --art-style realistic`, followed by retexture pass. Prompt: *"low-poly stylized empire toll gate, two wooden barrier arms across a road, small wooden ledger booth, tall flagpole with imperial banner, weathered wood and iron, faceted flat-shaded, austere straight imperial design, readable silhouette"*. Retexture style: *"weathered wood planks, rusted iron fittings, imperial red and gold banner, stone road surface, earthy tones, flat low-poly colors"*. 20 preview + 10 retexture = 30 Meshy credits.
- **Rig:** static mesh, no skeleton.
- **Verification:** loads headless via `node tools/meshy-3d/smoke_load_glb.mjs public/models/toll-gate.glb` → 2 meshes, 1947 tris, no errors.
- **Handoff:** scene wiring (replacing the placeholder box in `humanLandsScene.ts`) is engineering scope — see [FLO-373](/FLO/issues/FLO-373).

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
- **Handoff:** wiring the GLB into the scene (replacing the procedural
  watchtower box at `humanLandsScene.ts:60`) is engineering's job — for
  Daedalus/CTO, not done here.

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
- **Handoff:** wiring this GLB into the scene (replacing the procedural box in
  `caravanEnemy.ts`) is engineering's job — handed to Daedalus/CTO.
