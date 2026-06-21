# public/models/

Web-ready GLB models, served by Cloudflare Pages at `/models/<name>.glb` and
loaded at runtime via `loadModel()` (`src/scenes/modelLoader.ts`).

- These `*.glb` files are tracked by **Git LFS** (`.gitattributes`). Run
  `git lfs install` once before cloning or committing.
- Generate with the `meshy-3d` skill (`tools/meshy-3d/`), review the output
  against the asset budget, then move the approved GLB here.

## Current models

- `chest.glb` — textured low-poly chest (FLO-261/263).
- `korovany_hero_player-default.glb` — player survivor avatar, low-poly (2,884
  tris · 298 KB · 1× 1024 flat base-color), within the v1.2 §5 Hero budget. Flat,
  matte, unlit albedo (v1.2-compliant — see hero README v13); re-textured in
  FLO-440 to kill the prior PBR semi-realism. Arms rest in a natural relaxed
  survivor idle (no splayed A/T-pose). Single welded, **rig-less** mesh: the
  in-engine procedural animator drives whole-body bob/lean/lunge/topple, and the
  scene loader applies `convertToFlatShadedMesh()` + a matte material at load so
  the faceted hard-edge read lands (FLO-443). Mounted live as the player visual
  across the forest, human-lands, and controller-playground scenes via
  `mountSurvivorAvatar` (`src/scenes/survivorAvatar.ts`); `loadModel(targetSize:
  1.8)`. Source render + reproducible spec sheet in `assets/models/hero/`. Also
  serves as the **Phase-1 elf player avatar** (reuse-first; faction elf deferred
  to Phase 4 — FLO-299).
- `forest-tree.glb` — faceted low-poly forest conifer (1,357 tris · 77 KB · no
  textures, flat-shaded in-engine), v1.2 ≤3,000-tri budget. Streamed by the
  Phase-1 forest slice (E1.3). Spec + reference render in `assets/models/props/`
  (FLO-299).
- `wooden-hut.glb` — low-poly gabled wooden hut (1,893 tris · 90 KB · no
  textures, flat-shaded in-engine), v1.2 ≤3,000-tri budget. Streamed by the
  Phase-1 forest slice (E1.3). Spec + reference render in `assets/models/props/`
  (FLO-299).

See `docs/decisions/0001-asset-hosting.md` and `0002-glb-import-contract.md`.
