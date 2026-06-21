# korovany_hero_player-attack — hero strike-pose variant (FLO-480 / FLO-474)

Second hero GLB of the **same character** as `korovany_hero_player-default`, in an
**attack pose** (поза атаки) for the combat-state avatar swap. Pattern: FLO-440
(re-author the identity, bake the pose into bind-pose geometry — the loader
renders GLBs statically, so a rig cannot apply a pose; lesson FLO-434).

## v1 — forward lunging strike (flat-unlit retexture)

- Role: Hero player avatar, attack state. Spec: visual language v1.2 (low-poly).
- Final GLB: `public/models/korovany_hero_player-attack.glb` — **2,905 tris, 295 KB,
  1× 1024 flat unlit base-color** (matches the default hero's v13 treatment).
- Budget check (v1.2 §5 Hero): tris 2,905 / 3,000 cap OK; size 0.30 / 1.0 MB OK; tex 1024 OK.
- Pipeline (FLO-440 pattern): text preview (target_polycount=2800) → refine
  (enable_pbr, for clean welded geometry) → **flat retexture** (no `--enable-pbr`,
  default removes baked lighting → flat/unlit albedo) → resize textures to 1024.
  The PBR refine was only a geometry step; the shipped texture is flat, killing the
  semi-realism FLO-440 removed from the default — so the two heroes are coherent.
- Meshy tasks: preview `019eead7-8fc8-743b-a550-8c54b344a2d3` (20cr); refine
  `019eead9-26e6-78f4-94b6-e7e9b7ac3a01` (10cr); flat retexture
  `019eeadc-c569-72af-b3dc-642406681f6a` (10cr). Total 40cr.
- Art evidence: `korovany_hero_player-attack.preview.png` (Meshy 512² untextured
  preview — silhouette/pose truth) and `korovany_hero_player-attack.strike.png`
  (Meshy 512² flat-textured render — palette truth).

## Pose — forward lunging melee strike (NOT raised-overhead, NOT surrender)

Lead fist clenched and raised forward in a jab/strike with a wide combat lunge
stance; rear arm low; bare fists, no weapon (the default hero is empty-handed →
silhouette match). Reads as aggression, deliberately **not** arms-out-to-the-sides
(which reads as surrender — the retired off-spec FLO-260 failure mode).

**Why forward, not overhead:** `modelLoader.fitScale` normalizes by the *longest*
bbox extent and grounds at y=0. An overhead raise would make the vertical extent
exceed the standing height and silently shrink the body on swap. A forward strike
keeps **height** as the longest extent, identical to the default — so the swap is a
true drop-in with no vertical jump or rescale.

## Drop-in parity vs default-hero (measured via Babylon NullEngine smoke loader)

| asset   | tris  | bbox x | bbox y (height) | bbox z | longest extent |
|---------|-------|--------|-----------------|--------|----------------|
| attack  | 2,905 | 0.88   | **2.0**         | 0.531  | y (height)     |
| default | 2,884 | 0.723  | **2.0**         | 0.494  | y (height)     |

Both have **height = 2.0** as the longest extent, so `loadModel(targetSize: 1.8)`
scales each to 1.8 units tall, grounded at y=0 and centred on x/z. The in-scene
character height is identical between states; only the width grows slightly (0.79 vs
0.65 after normalization) because the lead fist extends forward — expected for a
strike. No scene-code change required to swap; `targetSize` is unchanged.

In-engine shading: same as every character — `convertToFlatShadedMesh` facets it
(FLO-452 coherence), so the PBR gloss of the bare GLB is not what ships.

## Reproducible prompt (v1)

> a male survivor hero character in a brown leather bomber jacket, grey hooded
> sweater, olive-green cargo pants, brown work boots and fingerless gloves, in a
> dynamic aggressive melee fighting pose, lunging forward in a deep combat stance,
> torso twisted, one clenched fist cocked back at the shoulder and the other
> clenched fist thrust forward in a powerful punch, leaning into a forceful strike,
> fierce and aggressive, mid-attack, bare fists and no weapon, korovany action game
> player avatar, low-poly stylized 3D, faceted shading, flat color zones, simple
> geometry, game-ready, clean single-subject, muted earthy palette: ochre,
> terracotta, deep teal, wheat gold, charcoal, three distinct value tertiles, no
> logos, no text, no infringing IP

Negative: `T-pose, A-pose, arms outstretched sideways, arms spread horizontally,
arms out to the sides, surrender pose, hands up surrendering, relaxed idle,
standing still, arms hanging limp, weapon, sword, gun, staff, holding object,
high-poly, smooth subdivision surfaces, photorealistic, hyperreal, realistic skin,
complex topology, busy patterns, neon, pastel, brand marks, watermarks, signature`

Outfit/palette clause is identical to `korovany_hero_player-default` v12; only the
pose clause and the pose-related negatives differ.
