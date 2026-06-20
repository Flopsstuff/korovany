---
name: meshy-3d
description: Generate web-ready 3D assets (GLB/GLTF) from a text prompt or reference image via the Meshy AI API. Use when a task asks for a generated 3D model, texture, remesh, or rig for the korovany browser game. Wraps the full async create→poll→fetch→export lifecycle.
---

# meshy-3d — generative 3D assets via Meshy

Reusable wrapper around the [Meshy AI API](https://docs.meshy.ai/en) for producing
browser-ready 3D models for FlopBut's `korovany` Babylon.js SPA.

## Auth

The Meshy key is read from the environment variable `MESHY_API_KEY` at call time.
**Never print, log, echo, or commit the key.** If it is missing, the script exits
non-zero — mark the issue `blocked` and escalate to the CEO (Prospero) to inject it.

Confirm auth + remaining credits:

```bash
python tools/meshy-3d/meshy.py balance
# -> {"balance": <credits>}
```

## Texturing is mandatory (read first)

**Every model we ship must be textured — never deliver a grey/untextured mesh.**
A `preview` (and an `image`-to-3D) result is geometry only; that is an
intermediate, not a deliverable. Before an asset is "done" it must carry a
baked texture, exactly like the hero/chest. Two ways to get there:

1. **`refine`** — for text-to-3D, refine the preview into a PBR-textured model
   (same lineage, generates new UVs + maps). Heaviest, most realistic surface.
2. **`retexture`** — **UV-unwrap + paint an existing mesh, geometry-preserving.**
   This is the preferred path for v1.2 low-poly: it does not remesh, so the
   faceted silhouette is untouched (refine's PBR pass drifts low-poly geometry
   into a semi-realistic band — see `API-FITNESS.md`). Use it to texture any
   mesh that shipped untextured (e.g. the empire soldier) without regenerating.

Meshy also supports **auto-rig** and **animation** for humanoids — see those
sections below. Rigging *requires a textured input*, so texture first, rig second.

## Core workflow (text → 3D)

Meshy text-to-3D is **two stages**: a cheap `preview` (geometry only) then an
optional `refine` (adds PBR textures). Always preview first, look at the result,
and only refine when the geometry is good — this is the credit-saving discipline.

```bash
# 1. Preview: create → poll → fetch, save GLB + thumbnail.
#    Meshy defaults to target_polycount=30000 — WAY over the v1.1 ≤3000-tri
#    budget. Always pass --target-polycount for a game/web prop.
python tools/meshy-3d/meshy.py text "a low-poly stylized treasure chest, game asset" \
    --art-style realistic --target-polycount 3000 --topology triangle \
    --out ./assets/chest --download

# 2. Refine the preview into a PBR-textured model (uses the preview task id).
#    --enable-pbr generates albedo/normal/roughness/metallic maps.
python tools/meshy-3d/meshy.py refine <PREVIEW_TASK_ID> --enable-pbr \
    --out ./assets/chest_final --download

# 3. Refine embeds ~2K JPEG maps (~8 MiB) — too heavy for the browser. Downscale
#    the textures to a sane web payload (keeps mesh data byte-identical).
python tools/meshy-3d/resize_glb_textures.py \
    ./assets/chest_final.glb ./assets/chest_web.glb --max 1024 --quality 85
```

`--download` writes `<out>.glb` and `<out>.thumb.png`. Drop `--download` to just
print the result JSON (model URLs, thumbnail, credits consumed) without saving.

## Other modes

```bash
# Image → 3D (clean, single-subject, well-lit reference works best)
python tools/meshy-3d/meshy.py image https://example.com/ref.png --out ./assets/thing --download

# Inspect / re-poll any task
python tools/meshy-3d/meshy.py status <TASK_ID> --kind text-to-3d
```

## Texturing an existing mesh (UV-unwrap + paint, geometry-preserving)

`retexture` is the workhorse for "make this untextured mesh textured" without
touching geometry. Source it from a prior Meshy task id **or** any GLB URL/data
URI; describe the look with a text prompt or a reference image.

```bash
# Texture an existing model in place. --keep-lighting is OFF by default, so the
# albedo is baked flat/unlit — ideal for the v1.2 flat-shaded look.
python tools/meshy-3d/meshy.py retexture \
    --input-task-id 019ee601-93f0-7988-86f8-e35ce1067881 \
    --text-style-prompt "Napoleonic empire infantry, green wool coat, leather webbing, flat low-poly muted palette" \
    --out ./assets/soldier_retex --download

# Then bring the embedded maps down to a web-safe size (mesh bytes untouched).
python tools/meshy-3d/resize_glb_textures.py \
    ./assets/soldier_retex.glb ./assets/soldier_web.glb --max 1024 --quality 85
```

`--enable-pbr` also emits metallic/roughness/normal maps; `--original-uv` reuses
the input's UVs instead of unwrapping fresh; `--image-style-url` swaps the text
prompt for a reference image. Cost ≈ 10 credits.

## Rigging + animation (humanoids)

Meshy can auto-rig a **textured** humanoid and apply library animation clips.
Order is strict: **texture → rig → animate**.

```bash
# 1. Auto-rig a TEXTURED humanoid. Mesh must face +Z and be <=300k faces. ~5 cr.
python tools/meshy-3d/meshy.py rig --input-task-id <TEXTURED_TASK_ID> \
    --height-meters 1.8 --out ./assets/soldier_rigged --download
#    Result GLB also carries Meshy's basic walk/run clips.

# 2. Apply an animation library clip to the rig. ~3 cr.
python tools/meshy-3d/meshy.py animate <RIG_TASK_ID> --action-id <ID> \
    --fps 30 --out ./assets/soldier_anim --download
```

`rig`/`animate` results are flat `*_glb_url` fields (not the `model_urls` dict);
the wrapper downloads them automatically. Find `action_id` values in Meshy's
Animation Library Reference. Rigging **rejects untextured input** — this is why
texturing is step one for any character that will move.

## Options

| Flag | Default | Notes |
|------|---------|-------|
| `--out` | — | output path prefix (no extension) |
| `--download` | off | save model + thumbnail locally |
| `--format` | `glb` | `glb`/`fbx`/`obj`/`usdz`/`mtl`; **use `glb` for the browser** |
| `--art-style` | `realistic` | text mode; e.g. `realistic`, `sculpture` |
| `--negative-prompt` | — | text mode |
| `--no-remesh` | off | disable Meshy auto-remesh (keep dense topology) |
| `--target-polycount` | `30000` | text mode; remesh target tris (100–300000). Set low for web/game props |
| `--topology` | `triangle` | text mode; `triangle` (decimated) or `quad` |
| `--enable-pbr` | off | refine/retexture mode; generate PBR maps (albedo/normal/roughness/metallic) |
| `--hd-texture` | off | refine/retexture mode; 4K base-color (heavier payload — leave off for web) |
| `--input-task-id` / `--model-url` | — | retexture/rig source: a prior task id or a GLB URL/data URI |
| `--text-style-prompt` / `--image-style-url` | — | retexture: describe the texture look (text or reference image) |
| `--keep-lighting` | off | retexture: keep baked lighting (default bakes flat/unlit albedo) |
| `--original-uv` | off | retexture: reuse input UVs instead of unwrapping fresh |
| `--height-meters` | 1.8 | rig: character height in meters |
| `--action-id` / `--fps` | — / 0 | animate: library clip id and output fps (0/24/25/30/60) |
| `--interval` / `--timeout` | 5s / 900s | poll cadence and ceiling |

`target_polycount`/`topology` only apply when remesh is on (the default). PBR/HD
flags only apply to `refine`. After a refine, run `resize_glb_textures.py` to bring
the embedded maps down to a web-safe size — Meshy embeds full-res (~2K) JPEGs.

## Output contract for the korovany app

- Default export is **GLB** (single-file, embedded textures) — loads directly in
  Babylon.js via `SceneLoader.ImportMeshAsync`/`LoadAssetContainerAsync`.
- Before shipping an asset: open it (preview the thumbnail / load the GLB) and
  report **poly count, file size, format, texture resolution** against the web
  payload budget. "Task SUCCEEDED" is not proof the mesh is usable.
- Coordinate with the CTO chain (Daedalus) on where binary assets are hosted
  (repo vs. asset host) — do not commit large binaries blindly.

## Credit cost (observed)

- text-to-3D **preview**: ~20 credits, ~1–2 min.
- text-to-3D **refine**: additional credits (textures).
- **retexture**: ~10 credits, ~1–2 min (verified live on the empire soldier).
- **rig**: ~5 credits. **animate**: ~3 credits per clip.
- See `API-FITNESS.md` in this folder for the full measured fitness report,
  latency, modes, and licensing terms.

## Reproducibility

Every generation records a **task id**. Re-fetch any past result with
`status <task_id>` — Meshy keeps the model URLs available (signed URLs expire,
so re-download via `status` when needed).
