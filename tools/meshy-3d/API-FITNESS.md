# Meshy API — Fitness Report (FLO-256)

Verified end-to-end on **2026-06-20** against the live Meshy API with the
board-supplied `MESHY_API_KEY`.

## Verdict: ✅ Fit for purpose

The Meshy API authenticates, runs the full async text-to-3D lifecycle, and
returns a valid, web-ready **GLB** that loads in a browser engine (Babylon.js).
Suitable for generating `korovany` game assets.

## Auth & account

- Endpoint `GET /openapi/v1/balance` → `200 {"balance": <credits>}`. Key read
  from env only; never logged.
- Starting balance: **1495 credits**. After one preview: **1475**.

## End-to-end run (evidence)

| Field | Value |
|-------|-------|
| Mode | text-to-3D, `preview` |
| Task id | `019ee4d2-86f7-7b80-9914-1b99fbe1aca3` |
| Prompt | `a low-poly stylized treasure chest, game asset, clean topology` |
| Params | `art_style=realistic`, `should_remesh=true`, `seed=2246466193` |
| Latency | **~114 s** (preview) |
| Credits | **20** |
| Output GLB | 996 KiB, **29,992 triangles**, 26,202 vertices, 1 mesh |
| Textures | none (geometry-only preview; refine adds PBR) |
| Formats returned | `glb`, `fbx`, `obj`, `usdz`, `stl` + `preview.png` thumbnail |

GLB validated by parsing the binary header (magic/version OK) and accessor
counts; thumbnail visually confirms a correct treasure-chest mesh.

## Lifecycle

`POST /openapi/v2/text-to-3d` (mode=preview) → `202 {"result": "<task_id>"}` →
poll `GET /openapi/v2/text-to-3d/{id}` until `status: SUCCEEDED` (`PENDING` →
`IN_PROGRESS` with `progress` % → terminal) → read `model_urls` / `thumbnail_url`.
Model URLs are signed (long expiry here, but treat as expiring — re-fetch via
`status` to re-download).

## Available modes & credit cost

| Mode | Endpoint | Credits |
|------|----------|---------|
| Text→3D preview | `v2/text-to-3d` (mode=preview) | **20** (Meshy-6 / low-poly); 5 (other models) |
| Text→3D refine (adds PBR) | `v2/text-to-3d` (mode=refine) | **10** |
| Image→3D | `v1/image-to-3d` | 20 no-tex / 30 w-tex (Meshy-6); 5 / 15 (other) |
| Retexture (text-to-texture) | retexture | 10 |
| Remesh | remesh | 5 |
| Rigging (auto-rig) | rigging | 5 |
| Animation | animation | 3 |

Also exposed: multi-image-to-3D, convert, resize, UV-unwrap, text-to-image,
image-to-image, and 3D-print utilities.

## Limits / caveats

- Rate limiting exists (HTTP `429`); exact thresholds not published — back off
  on 429. Our wrapper polls at 5 s, well under any practical limit.
- Preview is **geometry only** (0 materials). For a finished, textured asset you
  must run a **refine** pass (+10 credits) — budget for two stages per asset.
- Poly count (~30k tris) is high for a single low-poly web prop. For real-time
  use, plan a **remesh** pass (5 credits) to hit a leaner budget, or set a target
  polycount. State the budget per asset before refining.

## Licensing / commercial use — ⚠️ confirm before shipping to prod

The pricing/API docs do not state ownership or commercial terms. Meshy's product
marketing states paid plans grant commercial usage rights to generated assets and
that users own their generations, but the **exact ToS clause governing our API
plan must be confirmed** before assets ship in the production game. Flagged to
Iris/CEO. Until confirmed, treat generated assets as cleared for internal
prototyping only. Action owner: CEO (Prospero) to confirm plan-level commercial
license.

## Recommended production workflow

1. `preview` (20cr) → inspect thumbnail/geometry.
2. If good: `refine` (10cr) for PBR textures **or** `remesh` (5cr) to hit poly
   budget, then refine.
3. Export GLB → host per CTO (Daedalus) guidance → load in Babylon.js.
4. Always report poly/size/texture vs. web payload budget; open the asset before
   marking delivered.

## Finished-asset e2e run (FLO-263) — low-poly + textured + web-sized

Produced the first **delivered** chest (not the geometry-only preview above),
verified rendering in the live app.

| Stage | Task id | Params | Output |
|-------|---------|--------|--------|
| preview | `019ee4ef-e318-7dea-bdfa-259948486ce6` | `target_polycount=3000`, `topology=triangle` | **2,805 tris**, 135 KiB, untextured |
| refine | (same lineage) | `enable_pbr=true` | **2,781 tris**, 4× ~2K JPEG PBR maps, **8.0 MiB** |
| resize | `resize_glb_textures.py --max 1024` | local, no credits | 2,781 tris, 4× 1024² maps, **565 KiB** |

- Credits: preview 20 + refine 10 = **30**. Resize is free (local Pillow repack).
- Key lesson: **set `target_polycount` at the preview stage** — Meshy's 30k
  default is what made the original `chest.glb` 29,992 tris. Refine preserves the
  preview topology, so the budget is locked in at preview, not refine.
- Refine embeds full-res maps; the 8 MiB → 565 KiB downscale is mandatory for a
  web payload. 1024² PBR is ample for a small prop.
- Rendered in `MainScene` (Babylon `loadModel`) at a real viewport — lit,
  textured, correct. Screenshot attached to [FLO-263](/FLO/issues/FLO-263).

## Retexture / rig / animate wrapped + verified (FLO-330)

The wrapper now covers the full **texture → rig → animate** chain so every
character we ship can be textured (and, when it needs to move, rigged/animated)
in one toolset — `meshy.py {retexture,rig,animate}`. Endpoint shapes confirmed
against the live docs (`v1/retexture`, `v1/rigging`, `v1/animations`).

**Live retexture proof** — textured the previously-untextured empire soldier
(`019ee601-…`, 2794 tris, shipped grey on main) **without remeshing**:

| Stage | Tool | Output |
|-------|------|--------|
| retexture | `meshy.py retexture --input-task-id 019ee601-… --text-style-prompt "…empire infantry…"` | textured GLB, geometry preserved (3105 tris), embedded ~2K maps, 3.0 MiB |
| resize | `resize_glb_textures.py --max 1024` | **323 KiB** web GLB, 2 meshes, loads clean in Babylon NullEngine |

Thumbnail visually confirms a correctly-textured soldier (green coat, leather
webbing, brown boots, rifle). This is the standard path for any mesh that
shipped untextured — **no regeneration, geometry untouched.**

- `retexture` preferred over text-to-3D `refine` for v1.2 low-poly: refine's PBR
  pass drifts faceted geometry into a semi-realistic band; retexture paints the
  exact input mesh. `--keep-lighting` off (default) bakes flat/unlit albedo.
- **Rigging requires textured input** and a +Z-facing humanoid ≤300k faces — so
  texturing is always step one for a character that will animate.
