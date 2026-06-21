# The Emerald Thicket of Lysaen

**Zone role:** Forest Elf homeland, dense woodland, stealth and LOD proving
ground.

**Design promise:** A living defensive forest where trails, trunks, fog pockets,
and elevated huts make the player feel protected if they understand the woods
and hunted if they do not.

## Lore

Lysaen was a marsh before it was a forest. The elves dammed the water with woven
roots, planted cedar and black pine on the raised banks, and let the old pools
remain between them. Over generations the trees grew into rings around dry
ground, so paths curve and return like a knot. Outsiders call it witchcraft.
Elves call it memory.

The village is built around a giant stump from a tree that supposedly held the
first treaty with human traders. Every bridge, charm, and hut points back to
that stump. When Empire axes appear at the border, the forest does not become a
front line all at once. It changes by signs: a missing birdcall, a fresh cut in a
trunk, smoke where there should be mist, and scouts who stop smiling.

## Mood and visual language

- Deep greens, damp bark, pale fog, moonlit water, warm hut lanterns.
- The canopy should make the map feel enclosed, but landmarks must remain
  readable through shape: stump hall, bridges, shrine, clear-cut border.
- Elf structures are grown into trees and lashed with rope, not nailed like
  human buildings.
- Empire intrusion should look straight and violent: cut logs, square tents,
  stacked axes, cleared sight lines.

## Player-facing flow

1. Enter through a curved trail that hides the village until the last turn.
2. Learn that trail rings are safer than cutting straight through dense trees.
3. Use bridges and marsh edges to bypass patrols or flank enemies.
4. Choose whether to defend the border clearing, guide a courier, or raid the
   woodcutting camp.
5. Return to the stump hall, where faction standing and healing fiction can live.

## 20-by-20 text map

Each row contains 20 cells. North is row 01, west is column 01.

| Symbol | Meaning |
| ------ | ------- |
| `T` | Dense tree field |
| `t` | Sparse trees / readable trunks |
| `p` | Trail path |
| `V` | Village ring |
| `G` | Giant stump hall |
| `H` | Elevated hut |
| `B` | Rope bridge |
| `M` | Marsh pool |
| `S` | Moonwell shrine |
| `A` | Axecut clearing / Empire logging |
| `E` | Empire camp props |
| `C` | Courier route marker |
| `.` | Small clearing or grass |

| Row | 20-cell map |
| --- | ----------- |
| 01 | `TTTTTTTTTTTAAAAAEEEE` |
| 02 | `TTTTTTTttpAAAAAAEEE.` |
| 03 | `TTTTTtttpppAAA..EE..` |
| 04 | `TTTTttp...ppA.......` |
| 05 | `TTTttp..SS.pp..TTTTT` |
| 06 | `TTTtp..SS...p..TTTTT` |
| 07 | `TTtp....MMM.p..TTTTT` |
| 08 | `Tttp..MMMMM.pp..TTTT` |
| 09 | `Ttp..MM..CMM.p...TTT` |
| 10 | `ttp..M..VVVMMpp..TTT` |
| 11 | `tp.....VHG.V..p..TTT` |
| 12 | `tp..BB.VGGGV..p..TTT` |
| 13 | `tpp.BB.VHVV...p..TTT` |
| 14 | `T.p.....ppppppp..TTT` |
| 15 | `T.ppp......C.....TTT` |
| 16 | `TT..ppp..MMMM....TTT` |
| 17 | `TTT...ppMMMMMM..TTTT` |
| 18 | `TTTT...pppMMM..TTTTT` |
| 19 | `TTTTT....ppp..TTTTTT` |
| 20 | `TTTTTTTT..ppTTTTTTTT` |

> **Code binding (FLO-445):** this grid + its legend are mirrored verbatim in
> `src/game/world/mapProps.ts` (`FOREST_MAP`) and rendered as greybox primitives
> spread across the full 600 m world by `src/scenes/mapPropsRenderer.ts`
> (thin-instanced, one draw call per symbol). Until real models exist each symbol
> renders as a sized/coloured box, slab, cylinder, cone, or sphere; swap a symbol's
> base mesh for a streamed GLB without touching the placement data. **Keep this
> table and `FOREST_MAP` in sync** — the builder enforces the 20×20 shape.

## Landmark briefs

| Landmark | Player use | Implementation notes |
| -------- | ---------- | -------------------- |
| Giant stump hall | Faction hub, orientation center, future quest source | Make it the largest organic shape; player should see it from most village entrances. |
| Elevated huts | Vertical identity, village density | First pass can be visual-only; later add stairs and interactable interiors. |
| Rope bridge pair | Shortcut and camera stress test | Keep bridge width generous; add side rails until fall rules exist. |
| Moonwell shrine | Healing/prosthetics fiction and quiet space | Use open ground around it so UI/interactions are safe. |
| Axecut clearing | Enemy intrusion and combat arena | Contrast square Empire props against irregular forest shapes. |

## Faction pressure

| Faction | Presence | Behavior |
| ------- | -------- | -------- |
| Forest Elves | Village, trail loops, bridge guards | Friendly or wary depending on campaign; know hidden paths. |
| Empire | Axecut clearing and logging camp | Cuts trees, patrols straight lines, calls soldiers when alarmed. |
| Villain hunters | Night routes through fog and marsh | Avoids village center, tracks wounded targets, uses lanterns. |
| Human traders | Rare courier visits at the south trail | Bring rumors and goods if the road remains safe. |

## Encounter set pieces

- **Silent trail:** the player follows missing birdcall markers to find an
  Empire logging party.
- **Wounded courier:** a courier starts near the marsh and must be guided around
  patrols to the stump hall.
- **Bridge alarm:** cutting a bridge rope or defending it changes patrol routes.
- **Night hunters:** lantern-bearing hunters enter from the western trees and
  make the fog glow before they are visible.

**First-session safety (P7.1 / FLO-412):** the stump-hall spawn is a soldier-free
clearing — no patrol starts within aggro range of the player. The first contact is
a single lone soldier ahead; the rest cluster by the far caravans, so a new player
meets one enemy first and can reach the nearest caravan unmolested. See
[forest-zone.md](../forest-zone.md#safe-spawn--difficulty-curve-p71--flo-412).

## Traversal and camera notes

- Trail paths should be wide enough for the third-person camera to swing without
  constant tree collision.
- Dense tree fields can be collision-light at first; use invisible blockers only
  at map edges and near water.
- Marsh pools should slow or redirect the player later, but first implementation
  can mark them visually and keep them shallow.
- Bridges and huts should avoid tight stair spirals until controller stair logic
  exists.

## Streaming and LOD notes

- Suggested cells: `lysaen_village`, `lysaen_marsh`, `lysaen_shrine`,
  `lysaen_axecut`, `lysaen_south_trail`.
- This map is the strongest candidate for tree impostors. Budget target should
  be tested before authoring hundreds of unique trunks.
- Use trail loops as streaming and NPC navigation boundaries. The player should
  feel surrounded, but the engine should load predictable rings.
- Save payload should track bridge state, courier state, and logging-camp alarm.

## Asset list

| Asset | Priority | Notes |
| ----- | -------- | ----- |
| Tree impostor set | High | Required for dense forest scale. |
| Close tree trunk variants | High | Need readable collision silhouettes. |
| Stump hall | High | Main zone identity asset. |
| Elevated hut kit | Medium | Reusable elf architecture. |
| Rope bridge | Medium | Traversal and silhouette. |
| Marsh reeds and water plane | Medium | Needs cheap rendering. |
| Warning charms | Low | Small faction storytelling prop. |
| Logging camp props | Medium | Empire contrast: axes, logs, tents. |

## Open implementation questions

- Should Lysaen be available as a peaceful hub before the Empire logging camp
  appears, or should the first version start during conflict?
- Can NPCs use authored trail splines only, or do we need local avoidance in the
  village ring?
- How should faction reputation affect access to the stump hall and healing?
