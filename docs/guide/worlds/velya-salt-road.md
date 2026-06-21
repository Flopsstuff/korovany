# The Salt Road of Velya

**Zone role:** Human lands, trade corridor, first caravan-robbery map.

**Design promise:** A readable open road where the player can learn the caravan
loop: spot the route, read the escort, choose an approach, strike or protect,
then deal with faction consequences.

## Lore

Velya began as a salt road between three human towns. Each town maintained a
different piece of the route, so the road is full of mismatched stones, old
boundary markers, patched wells, and shrines to local saints. It was neutral by
habit, not by law: merchants paid small tolls, farmers sold water, and guards
looked away when smugglers used the hedges after dusk.

The Empire changed the road without conquering it. First came a ledger clerk at
the eastern gate. Then came soldiers to protect the ledger. Then came confiscated
wagons, "temporary" barriers, and a gallows frame still officially called a sign
post. Forest elves strike from the black pines when axes arrive in the caravan
loads. Mountain scouts take bribes from both sides and report to the broken
watchtower. Everyone still calls Velya neutral because admitting otherwise would
force the towns to choose a war.

## Mood and visual language

- Dust, low sun, pale road stones, yellow grass, torn banners.
- Horizon landmarks are critical: the watchtower, toll gate, and burned inn
  should always orient the player.
- The map must feel wide enough to leave the road but never so open that the
  caravan route disappears.
- Human props should look repaired and reused; Empire props should be straight,
  numbered, and intrusive.

## Player-facing flow

1. Spawn near the burned coaching inn with the road visible in both directions.
2. See or hear a caravan approaching before enemies engage.
3. Pick one of three approaches: road confrontation, pine ambush, or tower
   overlook.
4. Resolve the caravan event: guard it, rob it, or let another faction hit it.
5. Carry loot or reputation consequences toward the toll gate, shrine, or farms.

## 20-by-20 text map

Each row contains 20 cells. North is row 01, west is column 01.

| Symbol | Meaning |
| ------ | ------- |
| `.` | Open grass or scrub |
| `R` | Main salt road |
| `F` | Farms and field props |
| `H` | Hedges, fences, low cover |
| `P` | Black pine ambush trees |
| `D` | Dry riverbed |
| `I` | Burned coaching inn / spawn |
| `S` | Saint Miro's shrine |
| `T` | Empire toll gate |
| `W` | Old watchtower |
| `O` | Rocky overlook |
| `C` | Caravan staging / wagon stop |
| `X` | Road barrier or blockade |

| Row | 20-cell map |
| --- | ----------- |
| 01 | `..............TTTT..` |
| 02 | `............RRRTTTX.` |
| 03 | `..........RRR...HHH.` |
| 04 | `........RRR.....HFF.` |
| 05 | `......RRR.....SS.FF.` |
| 06 | `PP..RRR......SS..FF.` |
| 07 | `PP.RR......HHH......` |
| 08 | `PPRR....DDDDHH......` |
| 09 | `.RR...DDDDDD....OO..` |
| 10 | `.R...DD..C.DD...OO..` |
| 11 | `RR.....CCCCDD.......` |
| 12 | `R....HHH..DD....WWW.` |
| 13 | `R...HH....D.....WWW.` |
| 14 | `RR..............W...` |
| 15 | `.RR....I...........P` |
| 16 | `..RR...I...HH.....PP` |
| 17 | `...RR..I..HHH....PPP` |
| 18 | `FF..RR....HH.....PPP` |
| 19 | `FFF..RR...........PP` |
| 20 | `FFFF..RR............` |

> **Code binding (FLO-445):** this grid + its legend are mirrored verbatim in
> `src/game/world/mapProps.ts` (`HUMAN_LANDS_MAP`) and rendered as greybox
> primitives spread across the full 600 m world by `src/scenes/mapPropsRenderer.ts`
> (thin-instanced, one draw call per symbol). Until real models exist each symbol
> renders as a sized/coloured box, slab, cylinder, cone, or sphere; swap a symbol's
> base mesh for a streamed GLB without touching the placement data. **Keep this
> table and `HUMAN_LANDS_MAP` in sync** — the builder enforces the 20×20 shape.

## Landmark briefs

| Landmark | Player use | Implementation notes |
| -------- | ---------- | -------------------- |
| Burned coaching inn | Spawn, safe tutorial space, later merchant shell | Keep the roof collapsed so the player can see through it; use warm ash colors against pale grass. |
| Saint Miro's shrine | Midpoint marker, possible save fiction | Place on a slight rise so it is visible over hedges; keep combat space around it circular. |
| Broken toll gate | Empire checkpoint and escalation point | Build as two lane barriers plus a ledger table; soldiers need clear patrol points. |
| Old watchtower | Ambush overlook and villain scout perch | The climb can be blocked in the first pass; it still needs a strong silhouette. |
| Dry riverbed | Natural arena around caravans | Use shallow banks and stones for cover without trapping the controller. |

## Faction pressure

| Faction | Presence | Behavior |
| ------- | -------- | -------- |
| Human townsfolk | Farms, inn ruins, water carts | Neutral by default, flee from combat, later provide rumors and prices. |
| Empire | Toll gate, patrols near barriers | Searches wagons, becomes hostile if stolen cargo is visible. |
| Forest Elves | Pine pockets west of the road | Ambushes caravans carrying timber or Empire weapons. |
| Villain scouts | Watchtower and overlook | Observes fights, retreats with information if not stopped. |

## Encounter set pieces

- **First caravan pass:** one wagon, two guards, slow road movement, no faction
  complication unless the player attacks.
- **Treefall blockade:** elves drop a pine near the dry riverbed, stopping the
  caravan and creating a three-sided fight.
- **Ledger shakedown:** Empire soldiers delay a caravan at the toll gate; the
  player can bribe, attack, steal during confusion, or escort the wagon away.
- **Tower witness:** a scout watches a robbery from the tower and flees north;
  catching them prevents later retaliation.

## Traversal and camera notes

- Keep the main road at least 4 meters wide in gameplay scale so wagons, guards,
  and the player can share it.
- Hedges should stop line of sight but not create tight camera tunnels.
- The dry riverbed should have ramps at both ends and no sharp lip that catches
  the capsule controller.
- The tower and overlook are optional vertical beats; the first greybox can keep
  them as blocked props.

## Streaming and save notes

- Suggested cells: `velya_farms`, `velya_inn`, `velya_riverbed`,
  `velya_toll_gate`, `velya_watchtower`.
- Save payload should track active caravan state: route progress, wagon health,
  cargo status, and surviving guards.
- Later reputation flags can attach to the road: Empire wanted level, elf favor,
  town merchant trust, villain witness escaped.

## Asset list

| Asset | Priority | Notes |
| ----- | -------- | ----- |
| Low-poly wagon | High | Needs cargo sockets and damaged state. |
| Cargo crates and salt sacks | High | Lootable, stackable silhouettes. |
| Toll gate | High | Barrier arm, ledger table, Empire banner. |
| Burned inn shell | Medium | Spawn landmark and future shop shell. |
| Shrine stones | Medium | Small unique landmark with readable shape. |
| Watchtower | Medium | Can be non-climbable at first. |
| Hedge/fence kit | Medium | Reused across human lands. |

## Open implementation questions

- Does caravan robbery immediately mark the player hostile to Empire, or only
  when witnesses survive?
- Should the first playable version include mounted road blockers, or fake them
  as static props?
- How much loot can be carried before inventory weight or movement penalties
  exist?
