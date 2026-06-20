# assets/models/props/ — Phase-1 forest slice props

Reproducible spec sheets + reference renders for the streamed forest props
(FLO-299, unblocks E1.3 / FLO-295). Final web-ready GLBs live in
`public/models/`; these PNGs are the Meshy preview renders kept as visual
reference.

All assets conform to **low-poly visual language v1.2** (≤3,000 tris/object;
board-locked rev 4). Generated via the `tools/meshy-3d` pipeline in
**preview-only** mode — no PBR refine — per the Meshy PBR-drift note (the
realistic refine band pushes faceted low-poly geometry into a semi-realistic
surface; faceted/flat shading is applied in-engine instead). Licensing: Meshy
paid-plan output grants full commercial ownership, cleared for korovany
production (FLO-258).

## forest-tree.glb

- Role: scattered forest tree (E1.3 streamed prop). Faceted low-poly conifer.
- **1,357 tris · 2 meshes · 77 KB · no textures** (preview geometry, flat-shaded
  in-engine). bbox ≈ 0.96 × 1.91 × 0.98 (tall — trunk + tiered canopy).
- Budget check (v1.2 ≤3,000 tris): 1,357 / 3,000 OK; payload 77 KB OK.
- Meshy: text-to-3d preview task `019ee5ce-f6d7-7d03-affe-8368fecab866`
  (`--art-style realistic --target-polycount 1400`, 20 cr).
- Prompt: "a low-poly stylized forest pine tree, faceted flat-shaded conical
  foliage in layered tiers, simple straight tapered wooden trunk, clean
  game-asset geometry, single tree, neutral studio background".

## wooden-hut.glb

- Role: forest wooden hut (E1.3 streamed prop). Small gabled cabin.
- **1,893 tris · 2 meshes · 90 KB · no textures** (preview geometry, flat-shaded
  in-engine). bbox ≈ 1.47 × 1.47 × 1.91 (single building w/ door + window).
- Budget check (v1.2 ≤3,000 tris): 1,893 / 3,000 OK; payload 90 KB OK.
- Meshy: text-to-3d preview task `019ee5cf-0b6a-7ae6-a16a-ca3c4780b82a`
  (`--art-style realistic --target-polycount 2200`, 20 cr).
- Prompt: "a low-poly stylized wooden hut, small single cabin with vertical
  plank timber walls, simple sloped gable roof, a door and one small window,
  faceted flat-shaded game-asset geometry, single building, neutral studio
  background".

## Verify

```sh
node tools/meshy-3d/smoke_load_glb.mjs \
  public/models/forest-tree.glb public/models/wooden-hut.glb
```

Loads each GLB headlessly through the same `@babylonjs/loaders/glTF` plugin the
app uses (Babylon `NullEngine`) and prints tri count + bbox. Non-zero exit if a
model fails to import.
