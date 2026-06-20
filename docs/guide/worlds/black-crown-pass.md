# Black Crown Pass

**Zone role:** Mountain lands, villain fortress approach, vertical combat map.

**Design promise:** A dangerous climb toward a hostile fort where the same
geometry supports two fantasies: assault the villain's stronghold, or defend it
as the villain's faction.

## Lore

Black Crown Pass is older than the current war. The fort at the top was built by
a dead kingdom that carved wells into the mountain and locked its inner doors
from the outside. Nobody agrees why. Shepherds say the wells still echo with
voices below the snow line. Empire officers say that is superstition. The
villain says nothing and keeps the deepest gate barred.

Caravans do not travel the pass willingly. They end up here after raids, broken
wheels, or false guides. Prisoners are kept in cages in the outer yard until
they can be ransomed, recruited, or marched deeper into the keep. From below,
the broken crown tower is visible for miles, which is exactly why the villain
keeps signal fires lit there after every raid.

## Mood and visual language

- Grey stone, snow patches, black banners, cold blue shadows, orange signal fire.
- The fortress should dominate the view from every lower route.
- Mountain geometry must look dangerous without making the controller miserable:
  broad ledges, readable ramps, clear blocker rails.
- Villain props should feel scavenged and intimidating: cages, spikes, patched
  barricades, stolen caravan wood.

## Player-facing flow

1. Start at the lower switchback with the fort visible above.
2. Choose the safer road, the goat trail flank, or a risky bridge route.
3. Fight or avoid patrol pairs positioned on elevation differences.
4. Reach the outer yard and decide whether to free prisoners, raid supplies, or
   open a defense route.
5. Use the keep gate as a future expansion boundary.

## 20-by-20 text map

Each row contains 20 cells. North is row 01, west is column 01.

| Symbol | Meaning |
| ------ | ------- |
| `^` | Cliff or steep mountain wall |
| `r` | Walkable road / switchback |
| `g` | Goat trail flank |
| `b` | Bridge |
| `v` | Ravine / fall boundary |
| `F` | Fort wall or yard |
| `K` | Inner keep gate |
| `C` | Prison cages |
| `B` | Barricades |
| `S` | Signal fire |
| `T` | Broken crown tower |
| `A` | Avalanche scar / boulder arena |
| `W` | Broken wagon debris |
| `.` | Snowy open ground |

| Row | 20-cell map |
| --- | ----------- |
| 01 | `^^^^^^TTTTFFFF^^^^^^` |
| 02 | `^^^^^TTTSFFFFFK^^^^^` |
| 03 | `^^^^..TTFFFFCCF^^^^^` |
| 04 | `^^^...FFFFFCCFF^^^^^` |
| 05 | `^^^..BFFFFBBBB..^^^^` |
| 06 | `^^..BB...rr....^^^^^` |
| 07 | `^..B....rrr..^^^^^^^` |
| 08 | `^..vvvvbbrr..^^^^^^^` |
| 09 | `^^.vvvvvbr...gg^^^^^` |
| 10 | `^^^vvvv..r..ggg^^^^^` |
| 11 | `^^^^....rr..g..^^^^^` |
| 12 | `^^^..AAArr..g..^^^^^` |
| 13 | `^^..AAAArr.....^^^^^` |
| 14 | `^..AAA..r..W...^^^^^` |
| 15 | `^......rr.WW..^^^^^^` |
| 16 | `^^....rr.....^^^^^^^` |
| 17 | `^^^..rr....^^^^^^^^^` |
| 18 | `^^^^rr..^^^^^^^^^^^^` |
| 19 | `^^^rr..^^^^^^^^^^^^^` |
| 20 | `^rrr...^^^^^^^^^^^^^` |

## Landmark briefs

| Landmark | Player use | Implementation notes |
| -------- | ---------- | -------------------- |
| Broken crown tower | Main silhouette, signal fire platform | Visible from rows 20, 15, 10, and yard entrance. |
| Hanging bridge | Traversal risk and route choice | Start as a wide bridge with rails; visual danger can exceed mechanical danger. |
| Avalanche scar | Mid-map combat arena | Boulders provide cover and break charge lines. |
| Prison cages | Objective anchor and moral pressure | Place near yard edge so the player sees prisoners before entering the keep. |
| Inner keep gate | Expansion boundary | Large locked door; no interior required for first map. |

## Faction pressure

| Faction | Presence | Behavior |
| ------- | -------- | -------- |
| Villain forces | Fort yard, patrol road, tower | Defend high ground, retreat upward, use prisoners as stakes. |
| Empire | Lower road or assault wave | Can become attackers against the fort in a three-faction fight. |
| Human caravaners | Cages and broken wagons | Rescue targets, later reputation and reward source. |
| Forest Elves | Rare rescue ally or scout | Uses goat trail rather than main road. |

## Encounter set pieces

- **Lower ambush:** two villain soldiers attack near broken wagon debris while a
  lookout retreats upward.
- **Avalanche arena:** boulders split melee movement and let the player break
  line of sight.
- **Bridge standoff:** enemy on the far side delays the player while another
  patrol approaches from the goat trail.
- **Prison yard:** cages create a choice between freeing prisoners and pushing
  toward the keep gate.
- **Defense variant:** if the player is villain-aligned, Empire attackers move
  from rows 20 to 05 while the player uses barricades and the tower.

## Traversal and camera notes

- Roads and goat trails should be wider than their art implies. Use cliff meshes
  outside the walkable path to create danger visually.
- The third-person camera will be stressed by walls on one side and ravine on
  the other. Greybox camera tests should happen before art placement.
- Avoid true fall damage in the first version. Ravines can be blocked by low
  collision rails hidden as rocks, snow banks, or broken fence.
- Fort yard should be broad enough for at least five NPCs plus the player.

## Streaming and save notes

- Suggested cells: `black_crown_lower_road`, `black_crown_avalanche`,
  `black_crown_bridge`, `black_crown_outer_yard`, `black_crown_tower`.
- Save payload should track freed prisoners, opened yard barriers, and whether
  the tower signal fire is lit.
- The keep gate is a clean streaming boundary for future interiors.
- Defense and assault variants can share geometry but swap spawn tables and
  objective markers.

## Asset list

| Asset | Priority | Notes |
| ----- | -------- | ----- |
| Mountain rock kit | High | Needs broad collision-friendly pieces. |
| Fort wall and gate kit | High | Main zone identity and expansion boundary. |
| Prison cages | High | Objective anchor. |
| Rope bridge | Medium | Traversal set piece; can share with forest variant only if restyled. |
| Broken wagon debris | Medium | Connects pass to caravan loop. |
| Barricades | Medium | Used in assault and defense variants. |
| Signal fire | Low | Strong atmosphere, simple interaction later. |
| Snow patches | Low | Cheap visual breakup. |

## Open implementation questions

- Should the villain faction start inside the fort, or still climb the pass in
  an introductory mission?
- Do rescued prisoners follow the player immediately, or become a delayed reward
  resolved after leaving the map?
- How should the map handle defeat near cliffs if fall damage is not implemented?
