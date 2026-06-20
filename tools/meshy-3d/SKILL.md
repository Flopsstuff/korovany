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

## Core workflow (text → 3D)

Meshy text-to-3D is **two stages**: a cheap `preview` (geometry only) then an
optional `refine` (adds PBR textures). Always preview first, look at the result,
and only refine when the geometry is good — this is the credit-saving discipline.

```bash
# 1. Preview: create → poll → fetch, save GLB + thumbnail
python tools/meshy-3d/meshy.py text "a low-poly stylized treasure chest, game asset" \
    --art-style realistic --out ./assets/chest --download

# 2. Refine the preview into a textured model (uses the preview task id)
python tools/meshy-3d/meshy.py refine <PREVIEW_TASK_ID> --out ./assets/chest_final --download
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

## Options

| Flag | Default | Notes |
|------|---------|-------|
| `--out` | — | output path prefix (no extension) |
| `--download` | off | save model + thumbnail locally |
| `--format` | `glb` | `glb`/`fbx`/`obj`/`usdz`/`mtl`; **use `glb` for the browser** |
| `--art-style` | `realistic` | text mode; e.g. `realistic`, `sculpture` |
| `--negative-prompt` | — | text mode |
| `--no-remesh` | off | disable Meshy auto-remesh (keep dense topology) |
| `--interval` / `--timeout` | 5s / 900s | poll cadence and ceiling |

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
- See `API-FITNESS.md` in this folder for the full measured fitness report,
  latency, modes, and licensing terms.

## Reproducibility

Every generation records a **task id**. Re-fetch any past result with
`status <task_id>` — Meshy keeps the model URLs available (signed URLs expire,
so re-download via `status` when needed).
