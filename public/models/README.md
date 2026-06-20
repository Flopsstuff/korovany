# public/models/

Web-ready GLB models, served by Cloudflare Pages at `/models/<name>.glb` and
loaded at runtime via `loadModel()` (`src/scenes/modelLoader.ts`).

- These `*.glb` files are tracked by **Git LFS** (`.gitattributes`). Run
  `git lfs install` once before cloning or committing.
- Generate with the `meshy-3d` skill (`tools/meshy-3d/`), review the output
  against the asset budget, then move the approved GLB here.

## Current models

- `chest.glb` — textured low-poly chest (FLO-261/263).
- `korovany_hero_player-default.glb` — player hero, low-poly (2,894 tris ·
  471 KB · 4× 1024 PBR), within the v1.2 §5 Hero budget (FLO-260). Source
  render + reproducible spec sheet in `assets/models/hero/`. Also serves as the
  **Phase-1 elf player avatar** (reuse-first; faction elf deferred to Phase 4 —
  FLO-299).
- `forest-tree.glb` — faceted low-poly forest conifer (1,357 tris · 77 KB · no
  textures, flat-shaded in-engine), v1.2 ≤3,000-tri budget. Streamed by the
  Phase-1 forest slice (E1.3). Spec + reference render in `assets/models/props/`
  (FLO-299).
- `wooden-hut.glb` — low-poly gabled wooden hut (1,893 tris · 90 KB · no
  textures, flat-shaded in-engine), v1.2 ≤3,000-tri budget. Streamed by the
  Phase-1 forest slice (E1.3). Spec + reference render in `assets/models/props/`
  (FLO-299).

See `docs/decisions/0001-asset-hosting.md` and `0002-glb-import-contract.md`.
