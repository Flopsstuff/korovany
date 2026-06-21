# korovany_hero_player-default — hero asset #1

## v12 — natural arms-down idle (FLO-434, reposes v11)

- Role: Hero (player avatar). Spec: visual language v1.2 (low-poly).
- Final GLB: `public/models/korovany_hero_player-default.glb` — 2,884 tris, 455 KB, 4× 1024 PBR maps.
- Budget check (v1.2 §5 Hero): tris 2,884 / 3,000 cap OK; size 0.46 / 1.0 MB OK; tex tier 1024 OK.
- Pipeline: text preview (target_polycount=2800) -> refine (enable_pbr) -> resize textures to 1024.
- Meshy tasks: preview `019ee92c-e565-7b9c-b7e5-cad74053e786` (20cr); refine `019ee92e-c84f-74ba-9053-6798430a6e6a` (10cr). Total 30cr.
- Source render: `korovany_hero_player-default.idle.png` (Meshy 512² textured preview, front 3/4).
- **Repose rationale:** v11 baked a Meshy *"standing in a neutral T-pose"* prompt, so the
  arms were splayed straight out — read as a scarecrow in-scene (FLO-420). The mesh is a
  single welded mesh with NO skeleton, so the pose could not be fixed in scene code. v12
  regenerates the identical outfit/palette with the T-pose clause swapped for a relaxed
  arms-down idle (negative prompt blocks T/A-pose & raised arms). Bbox width fell 1.21 → 0.69
  at the same 1.91 height — objective proof the arms are now in. Same longest extent, so
  `loadModel(targetSize: 1.8)` is unchanged — drop-in, no scene change.
- Concept: brown bomber-jacket survivor; grey hoodie, olive cargo pants, brown boots,
  fingerless gloves, bearded male.

## Reproducible prompt (v12)

> a male survivor hero character in a brown leather bomber jacket, grey hooded sweater,
> olive-green cargo pants, brown work boots and fingerless gloves, standing in a relaxed
> neutral idle pose with both arms hanging straight down at the sides, upper arms pressed
> against the torso, elbows slightly bent, hands resting near the thighs, korovany action
> game player avatar, low-poly stylized 3D, faceted shading, flat color zones, simple
> geometry, game-ready, clean single-subject, muted earthy palette: ochre, terracotta, deep
> teal, wheat gold, charcoal, three distinct value tertiles, no logos, no text, no infringing IP

Negative: `T-pose, A-pose, arms raised, arms outstretched, splayed arms, arms away from body,
hands above waist, spread arms, high-poly, smooth subdivision surfaces, photorealistic,
hyperreal, realistic skin, complex topology, busy patterns, neon, pastel, brand marks,
watermarks, signature`

---

## v11 (superseded — splayed T-pose)

- Final GLB: korovany_hero_player-default_v11.glb — 2,894 tris, 471 KB, 4× 1024 JPEG PBR maps.
- Meshy tasks: preview 019ee505-baea-73e0-9bab-6e444010fcdb (20cr); refine 019ee506-b803-7794-ae16-2cc3552b9e31 (10cr).
- Prompt ended in "...standing in a neutral T-pose..." — the cause of the splayed arms.
- Style note: at ~2,894 tris Meshy reads semi-realistic, not hard-faceted — flagged for Iris.
