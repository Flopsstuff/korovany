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
  across the forest, human-lands, mountains, empire, and controller-playground
  scenes via `mountSurvivorAvatar` (`src/scenes/survivorAvatar.ts`);
  `loadModel(targetSize: 1.8)`. This is the **neutral/idle** pose — combat scenes
  also mount `korovany_hero_player-attack.glb` and swap to it while a melee swing
  is in flight (FLO-481, see below). Source render + reproducible spec sheet in
  `assets/models/hero/`. Also
  serves as the **Phase-1 elf player avatar** (reuse-first; faction elf deferred
  to Phase 4 — FLO-299).
- `korovany_hero_player-attack.glb` — same hero in an **attack pose** (forward
  lunging strike, lead fist raised), low-poly (2,905 tris · 295 KB · 1× 1024 flat
  unlit base-color), within the v1.2 §5 Hero budget (FLO-480 / FLO-474). Flat-matte
  retexture (FLO-440 pattern) so it stays coherent with the default — no PBR gloss.
  Drop-in twin of the default: same outfit/palette/identity, **height (2.0) as
  longest bbox extent** so `loadModel(targetSize:1.8)` renders it at the same
  in-scene height — no scene change needed to swap normal↔attack by combat state.
  **Wired live (FLO-481):** `mountSurvivorAvatar` loads both GLBs and parents them
  under the player capsule; `CharacterController` toggles which renders from its
  melee state (default while idle, this strike pose while a swing is in flight —
  windup/active/recovery), so the player has two clearly distinct states in every
  combat scene (forest, human-lands, mountains, empire). Static swap, no animation
  playback. Spec + preview/textured renders in `assets/models/hero/`.
- `forest-tree.glb` — faceted low-poly forest conifer (1,357 tris · 77 KB · no
  textures, flat-shaded in-engine), v1.2 ≤3,000-tri budget. Streamed by the
  Phase-1 forest slice (E1.3). Spec + reference render in `assets/models/props/`
  (FLO-299).
- `wooden-hut.glb` — low-poly gabled wooden hut (1,893 tris · 90 KB · no
  textures, flat-shaded in-engine), v1.2 ≤3,000-tri budget. Streamed by the
  Phase-1 forest slice (E1.3). Spec + reference render in `assets/models/props/`
  (FLO-299).

See `docs/decisions/0001-asset-hosting.md` and `0002-glb-import-contract.md`.
